import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import {getArrayBuffer, isHttpNotFound} from '../util/ajax';

import type {Callback} from '../types/callback';
import type {Cancelable} from '../types/cancelable';
import type {WorkerSourceVectorTileRequest} from './worker_source';
import type {default as Scheduler, TaskMetadata} from '../util/scheduler';

export type LoadVectorTileResult = {
    rawData: ArrayBuffer;
    vectorTile?: VectorTile;
    headers?: Headers;
};

/**
 * Callback for vector tile data loading with a three-state contract:
 * - `(null, data)` — tile has data, render normally
 * - `(null, null)` — tile intentionally empty, render as empty (e.g. HTTP 404 on a sparse tileset)
 * - `(err)` — real error, propagate further (e.g. network error, invalid tile data)
 *
 * @private
 */
export type LoadVectorDataCallback = Callback<LoadVectorTileResult | null>;

export type LoadVectorData = (params: WorkerSourceVectorTileRequest, callback: LoadVectorDataCallback) => Cancelable['cancel'];

type VectorDataRequest = (callback: LoadVectorDataCallback) => Cancelable['cancel'];

type DedupedRequestEntry = {
    result?: [Error | null, LoadVectorTileResult | null];
    cancel?: Cancelable['cancel'];
    // FORK: a Set, where upstream uses an array. A parked request re-enters
    // DedupedRequest.request() when the queue admits it, carrying a callback that is already
    // registered on the entry. Upstream's `push` would register it a second time and the tile
    // would be parsed twice, racing two results into the same WorkerTile. Set membership makes
    // re-entry a no-op. This is not a stylistic choice — see FORK.md.
    callbacks?: Set<LoadVectorDataCallback>;
};

/**
 * FORK: maximum number of vector tile requests allowed in flight at once.
 *
 * Upstream deduplicates concurrent requests for the *same* tile but never limits the number of
 * *distinct* tiles in flight. `getArrayBuffer()`, which is how vector tiles are fetched, has no
 * counter and no queue; the only throttle upstream ships is `config.MAX_PARALLEL_IMAGE_REQUESTS`,
 * which gates `getImage()` and so never sees a vector tile.
 *
 * That is fine against a CDN-fronted, pre-baked tileset. Against many simultaneously-visible
 * layers over a self-hosted tiler that generates tiles on demand, a single pan invalidates every
 * visible layer at once and fans out to hundreds of concurrent fetches — saturating the browser's
 * per-host connection pool and driving the tiler past its concurrency budget.
 *
 * The value matters less than having one. 50 is comfortably above the browser's own per-host
 * limit (so it does not throttle the common case) and low enough to keep the tiler's queue short.
 *
 * @private
 */
export const MAX_PARALLEL_VECTOR_TILE_REQUESTS = 50;

type QueuedRequest = {
    // The DedupedRequest that parked this request. The queue below is module-level and therefore
    // shared between instances, so admission has to go back through the *owning* instance —
    // dispatching via another instance would look up the callback in the wrong `entries` map.
    deduped: DedupedRequest;
    key: string;
    metadata: TaskMetadata;
    request: VectorDataRequest;
    callback: LoadVectorDataCallback;
    cancelled: boolean;
};

/**
 * FORK: module-level state, deliberately, rather than per-DedupedRequest.
 *
 * There is one DedupedRequest per worker source, so a per-instance counter would let N sources each
 * open MAX_PARALLEL_VECTOR_TILE_REQUESTS connections and the cap would bound nothing. Upstream
 * keeps `activeImageRequests` as module state in ajax.ts for exactly the same reason.
 *
 * `Map` iterates in insertion order, so the queue drains FIFO — tiles are issued in the order the
 * map asked for them, rather than in whatever order a hash happens to produce.
 */
let requestQueue: Map<string, QueuedRequest>;
let activeRequests: number;

// FORK: reset the module-level queue. Test-only, because module state outlives an individual test.
// Not re-exported from src/index.ts and not part of the public API.
/**
 * @private
 */
export function resetRequestQueue() {
    requestQueue = new Map();
    activeRequests = 0;
}
resetRequestQueue();

// FORK: issue parked requests while there is headroom under the cap.
//
// Runs after every request settles — including after a cancellation, which is what makes
// cancelling a queued tile actually hand its slot back rather than merely muting it.
//
// Written as `for (;;)` with the cap tested inside rather than as a `while (activeRequests < cap)`,
// because `activeRequests` is decremented indirectly — request() below calls release(), which calls
// back into here — and no-unmodified-loop-condition cannot see through that indirection.
function drainRequestQueue() {
    for (;;) {
        if (activeRequests >= MAX_PARALLEL_VECTOR_TILE_REQUESTS) return;

        const next = requestQueue.values().next();
        if (next.done) return;

        const queued = next.value;
        // Remove before re-entering request(): the admission check there treats presence in the
        // queue as "already parked", so leaving the key in place would park it again forever.
        requestQueue.delete(queued.key);

        if (!queued.cancelled) {
            queued.deduped.request(queued.key, queued.metadata, queued.request, queued.callback);
        }
    }
}

export class DedupedRequest {
    scheduler?: Scheduler;
    entries: {[key: string]: DedupedRequestEntry;};

    constructor(scheduler?: Scheduler) {
        this.entries = {};
        this.scheduler = scheduler;
    }

    request(key: string, metadata: TaskMetadata, request: VectorDataRequest, callback: LoadVectorDataCallback): Cancelable['cancel'] {
        const entry = this.entries[key] = this.entries[key] || {callbacks: new Set()};

        if (entry.result) {
            const [err, result] = entry.result;
            if (this.scheduler) {
                this.scheduler.add(() => {
                    callback(err, result);
                }, metadata);
            } else {
                callback(err, result);
            }
            return () => {};
        }

        entry.callbacks.add(callback);

        const cancel = () => {
            if (entry.result) return;
            entry.callbacks.delete(callback);
            if (entry.callbacks.size > 0) return;

            // FORK: nothing is waiting on this tile any more, so drop it whether it is in flight or
            // still parked. Handing the queue slot back here is the whole point of queueing inside
            // the map rather than letting the browser's connection pool queue for us: a tile that
            // scrolled out of view before it ever started should cost nothing.
            const queued = requestQueue.get(key);
            if (queued) {
                queued.cancelled = true;
                requestQueue.delete(key);
            }

            if (entry.cancel) entry.cancel();
            delete this.entries[key];
        };

        // An `entry.cancel` means this key is already in flight; presence in requestQueue means it
        // is already parked. Either way this caller was attached to the existing entry above and
        // there is nothing new to start — which is how parked requests keep deduplicating.
        if (!entry.cancel && !requestQueue.has(key)) {
            if (activeRequests >= MAX_PARALLEL_VECTOR_TILE_REQUESTS) {
                // FORK: park it. Callers cannot tell parked from in-flight, and do not need to —
                // the cancel handle returned below works identically in both states.
                requestQueue.set(key, {deduped: this, key, metadata, request, callback, cancelled: false});
                return cancel;
            }

            activeRequests++;

            // FORK: the slot must be released exactly once, and two paths reach it. A response
            // releases it; so does an abort, because `makeRequest` below invokes the callback from
            // its own abort handler. Without the guard, a cancelled-then-responded request would
            // decrement twice and slowly inflate the effective cap.
            let released = false;
            const release = () => {
                if (released) return;
                released = true;
                activeRequests--;
                drainRequestQueue();
            };

            const abort = request((err: Error | null, result: LoadVectorTileResult | null) => {
                entry.result = [err, result];
                for (const cb of entry.callbacks) {
                    if (this.scheduler) {
                        this.scheduler.add(() => {
                            cb(err, result);
                        }, metadata);
                    } else {
                        cb(err, result);
                    }
                }
                release();
                setTimeout(() => delete this.entries[key], 1000 * 3);
            });

            entry.cancel = () => {
                abort();
                release();
            };
        }

        return cancel;
    }
}

/**
 * @private
 */
export function loadVectorTile(
    this: {deduped: DedupedRequest},
    params: WorkerSourceVectorTileRequest,
    callback: LoadVectorDataCallback,
    skipParse?: boolean,
): Cancelable['cancel'] {
    const key = JSON.stringify(params.request);

    const makeRequest: VectorDataRequest = (callback: LoadVectorDataCallback) => {
        const controller = new AbortController();
        getArrayBuffer(params.request, controller.signal)
            .then(({data, headers}) => {
                callback(null, {
                    rawData: data,
                    vectorTile: skipParse ? undefined : new VectorTile(new PbfReader(data)),
                    headers
                });
            })
            .catch((err: Error) => {
                if (controller.signal.aborted) return;
                // HTTP 404 on a sparse tileset: the tile intentionally doesn't exist.
                // Convert to empty result — no parent fallback for HTTP sources.
                if (isHttpNotFound(err)) {
                    callback(null, null);
                } else {
                    callback(err);
                }
            });
        return () => {
            controller.abort();
            callback(null, null);
        };
    };

    if (params.data) {
        // if we already got the result earlier (on the main thread), return it directly
        this.deduped.entries[key] = {result: [null, params.data]};
    }

    const metadata: TaskMetadata = {type: 'parseTile', renderSourceType: params.renderSourceType, zoom: params.tileZoom};
    return this.deduped.request(key, metadata, makeRequest, callback);
}
