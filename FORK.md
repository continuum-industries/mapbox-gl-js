# continuum-industries/mapbox-gl-js — fork notes

This is a fork of [mapbox/mapbox-gl-js](https://github.com/mapbox/mapbox-gl-js). It exists for
exactly one reason, described in [Why this fork exists](#why-this-fork-exists) below. Everything
else in this repository is upstream code and should be kept byte-identical to upstream so that
future syncs stay cheap.

**If you are about to change something here, read
[Rules for changing this fork](#rules-for-changing-this-fork) first.**

---

## Who consumes this fork

`Pareto/FrontEndv2` depends on it directly from a git tag:

```json
"mapbox-gl": "github:continuum-industries/mapbox-gl-js#v1.0.0"
```

Two consequences follow from installing from git rather than from the npm registry, and both are
load-bearing:

1. `dist/` is **not** committed to this repository, but `package.json` `main` points at
   `dist/mapbox-gl.js`. npm runs the `prepare` lifecycle script for git dependencies (it does *not*
   run `prepublishOnly`, which is what upstream relies on for registry publishes). The fork
   therefore adds a `prepare` script so that `npm install` in Pareto produces a usable package.
   Without it, the install succeeds and then every import fails at runtime on a missing file.
2. The dependency is pinned to a **tag**, not a branch. Landing changes on `main` here has no effect
   on Pareto until a new tag is cut *and* Pareto's `package.json` is bumped to it. Cutting the tag
   is part of shipping, not an afterthought.

---

## Why this fork exists

### Upstream places no limit on concurrent vector tile requests

Upstream deduplicates concurrent requests for the *same* tile — that is what
`DedupedRequest` in `src/source/load_vector_tile.ts` does. It does **not** limit the number of
*distinct* vector tile requests in flight at once.

The only request throttle upstream ships applies to images. In `src/util/ajax.ts`, `getImage()`
parks requests once `activeImageRequests` reaches `config.MAX_PARALLEL_IMAGE_REQUESTS` (default
`16`). Vector tiles do not travel that path: they are fetched by `getArrayBuffer()`, which has no
counter and no queue. Every tile the style asks for becomes an immediate `fetch()`.

That is a reasonable default for Mapbox-hosted tilesets fronted by a CDN. It is not a reasonable
default for us:

- Pareto renders many simultaneously-visible vector layers over self-hosted tilesets served by
  `GeodataVectorTiler`, which generates tiles on demand rather than serving pre-baked ones.
- A single pan or zoom invalidates the viewport for *every* visible layer at once, so one gesture
  can fan out to hundreds of distinct tile URLs in the same tick.
- Unbounded fan-out has two failure modes, and we have hit both. The browser's per-host connection
  pool becomes the bottleneck, so tiles queue *invisibly* inside the browser where the map has no
  ability to cancel or reprioritise them; and the tiler itself is driven past its concurrency
  budget by a single client.

The fork's answer is to give vector tiles the throttle that images already have: a bounded number
of in-flight requests, with the excess parked in a queue the map still controls — so that when a
tile scrolls out of view before it ever started, cancelling it actually costs nothing.

### Why not just fix it upstream?

Worth doing, and it should be offered upstream. It is not a substitute for the fork in the
meantime: we need this in production now, and an upstream PR to a hot path in the tile pipeline is
not a short conversation. The change is deliberately shaped to be easy to offer upstream later —
see the footprint rules below.

---

## What the fork actually changes

As of the v3.28.1 sync the fork's entire delta is **one source file and one `package.json` line**.

| File | Change |
| --- | --- |
| `src/source/load_vector_tile.ts` | Bounded request queue inside `DedupedRequest` |
| `package.json` | `prepare` script, so git installs produce `dist/` |
| `test/unit/source/load_vector_tile.test.ts` | Coverage for the queue (new file, no upstream counterpart) |

Nothing else. `vector_tile_source.ts` and `vector_tile_worker_source.ts` are untouched upstream
code — see [Superseded by upstream](#superseded-by-upstream) for why they used to be modified and
why they no longer need to be.

### The queue, mechanically

All of it lives in `DedupedRequest` in `src/source/load_vector_tile.ts`.

- **Module-level state.** `requestQueue: Map<string, QueuedRequest>` and a `numRequests` counter,
  capped at `MAX_PARALLEL_VECTOR_TILE_REQUESTS`. Module-level rather than per-instance
  *deliberately*: the cap has to be global to be meaningful. There is one `DedupedRequest` per
  worker source, so a per-instance counter would let N sources open N × cap connections and the
  cap would bound nothing. This mirrors how upstream tracks `activeImageRequests` as module state
  in `ajax.ts`.

- **Admission.** When a request arrives and `numRequests` is already at the cap, it is parked in
  `requestQueue` instead of being issued, and a handle with a working `cancel()` is returned to the
  caller. The caller cannot tell the difference between parked and in-flight, which is the point.

- **Drain.** Every completed request decrements `numRequests` and then pulls from `requestQueue`
  while there is headroom. `Map` iteration order is insertion order, so the queue is FIFO: tiles
  are served in the order the map asked for them.

- **Queued requests still dedupe.** Parked entries are keyed on the same
  `JSON.stringify(params.request)` key the dedup entries use, and the callback is registered on the
  dedup entry at admission time rather than at issue time. A second request for a tile that is
  currently parked attaches to the existing entry instead of adding a second queue slot.

- **Cancellation is real, not deferred.** Cancelling a parked request marks it `cancelled` and
  removes its callback from the dedup entry; the drain loop skips cancelled entries and drops them.
  Cancelling the last remaining callback for a key also removes that key from `requestQueue`, so a
  cancelled tile does not sit on a queue slot it will never use. This matters more than it sounds:
  the whole benefit of queueing in the map rather than in the browser is that the map can still
  change its mind, and that is only true if cancellation frees the slot.

- **Re-entry must be idempotent.** When a parked entry is issued, it re-enters
  `DedupedRequest.request()` and reaches `entry.callbacks` a second time. Upstream stores callbacks
  in an **array** and `push`es, which on re-entry would register the same callback twice and invoke
  it twice for one tile — parsing the tile twice and racing two results into the same
  `WorkerTile`. The fork stores callbacks in a **`Set`**, which makes re-entry a no-op. This is a
  one-word change with a load-bearing reason; do not "simplify" it back to an array.

- **`resetRequestQueue()` is exported for tests only.** Module-level state persists across tests in
  the same file, so the queue needs an explicit reset in `beforeEach`. It is not part of the public
  API and is not re-exported from `src/index.ts`.

### Superseded by upstream

The pre-sync fork also carried a guard in `src/source/vector_tile_worker_source.ts`:

```js
if (workerTile.status === 'done') {
    return;
}
```

It was needed because the fork's cancel path invoked the load callback directly, so a tile could
see its callback fire twice — once from cancellation, once from the real response landing
afterwards — and the second invocation would re-process an already-finalised tile.

Upstream's async rewrite makes this dead code. `loadTile()` is now `async` and obtains tile data
through `_fetchTileData()`, which wraps the callback in a `Promise`. A `Promise` settles exactly
once, so a second callback invocation is absorbed by the language rather than by our guard. The
guard is therefore **not re-applied**, and `vector_tile_worker_source.ts` returns to being
unmodified upstream code.

The fork also used to change the signature of `loadVectorTile()` — replacing upstream's
`this.deduped` binding with an explicit `deduped` parameter, and threading an injectable
array-buffer-request factory through for testability. That rippled into
`vector_tile_source.ts` and `vector_tile_worker_source.ts` purely to keep call sites compiling.

It is not re-applied either, because the testability problem it solved has a better answer: the
queue lives entirely inside `DedupedRequest.request()`, which already takes the request function as
an argument. Tests drive `DedupedRequest.request()` directly with a fake request function and
observe cap, FIFO drain and cancellation there. No production signature needs to change, so
`loadVectorTile()` keeps upstream's shape and two files leave the fork's diff entirely.

---

## Rules for changing this fork

1. **Keep the diff surface minimal, and prefer internals to signatures.** Every upstream file the
   fork touches is a file that conflicts on every future sync. Every exported signature the fork
   changes is a conflict that ripples into call sites. The v3.5.1 → v3.28.1 sync cut the fork from
   four files to one purely by moving the change inside a class instead of across an API boundary.
2. **Do not "tidy" upstream code.** Whitespace, import ordering and comment rewording in upstream
   files cost real time at merge and buy nothing. If a diff hunk is not implementing the queue,
   it should not be there.
3. **Document the why, at the change.** A future syncer decides whether to re-apply each hunk. That
   decision needs the reason, in a comment next to the code, not in a commit message.
4. **State whether upstream superseded it.** When a hunk stops being necessary because upstream
   solved the problem, say so explicitly in this file and delete the hunk. Silently carrying dead
   workarounds is how forks become unmaintainable.

## How to sync with upstream

```bash
git remote add upstream https://github.com/mapbox/mapbox-gl-js.git   # once
git fetch upstream --tags
```

1. Read this file, then produce the current fork delta:
   `git diff <last-sync-tag>..main -- src/ package.json`.
2. For **each** hunk, decide: still needed, superseded by upstream, or obsolete. Record the verdict
   in this file. Do not carry a hunk forward without a verdict.
3. Merge upstream, resolving conflicts in upstream's favour, so the tree is vanilla upstream.
4. Re-apply the still-needed hunks against the new APIs as a separate, reviewable commit.
5. Verify `prepare` still names scripts that exist — upstream renames build scripts freely. The
   v3.28.1 sync broke it exactly this way: upstream retired `build-prod-min` in favour of
   `build-prod`, and a `prepare` script referencing a script that no longer exists fails the
   install in Pareto rather than in this repository, where nobody is looking.
6. Run `npm run test-unit`, build the bundle, cut a tag, then bump Pareto's pin to it.
