// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, vi, beforeEach} from '../../util/vitest';
import {mockFetch} from '../../util/network';
import {DedupedRequest, loadVectorTile, resetRequestQueue, MAX_PARALLEL_VECTOR_TILE_REQUESTS} from '../../../src/source/load_vector_tile';

import type {LoadVectorDataCallback} from '../../../src/source/load_vector_tile';

describe('loadVectorTile', () => {
    test('partial dedup abort: one caller aborts, survivor resolves with data', async () => {
        expect.assertions(2);

        mockFetch({
            'http://example.com/0/0/0.pbf': () => new Response(new ArrayBuffer(8), {status: 200})
        });

        const deduped = new DedupedRequest();
        const params = {
            request: {url: 'http://example.com/0/0/0.pbf'},
            uid: 1,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {z: 0, x: 0, y: 0}},
            tileZoom: 0,
            zoom: 0,
        };

        await new Promise<void>((resolve) => {
            const cancelA = loadVectorTile.call({deduped}, params, (_err, _data) => {
                // Caller A cancelled before this fires — should not be called
                expect.unreachable();
            });

            loadVectorTile.call({deduped}, params, (err, data) => {
                // Caller B survives
                expect(err).toBe(null);
                expect(data).not.toBe(null);
                resolve();
            });

            // Cancel A immediately
            cancelA();
        });
    });

    test('converts AJAXError(404) to null result', async () => {
        expect.assertions(2);

        mockFetch({
            'http://example.com/0/0/0.pbf': () => new Response('', {status: 404, statusText: 'Not Found'})
        });

        const deduped = new DedupedRequest();
        const params = {
            request: {url: 'http://example.com/0/0/0.pbf'},
            uid: 1,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {z: 0, x: 0, y: 0}},
            tileZoom: 0,
            zoom: 0,
        };

        await new Promise<void>((resolve) => {
            loadVectorTile.call({deduped}, params, (err, data) => {
                expect(err).toBe(null);
                expect(data).toBe(null);
                resolve();
            });
        });
    });

    test('passes through non-404 errors', async () => {
        expect.assertions(2);

        mockFetch({
            'http://example.com/0/0/0.pbf': () => new Response('', {status: 500, statusText: 'Server Error'})
        });

        const deduped = new DedupedRequest();
        const params = {
            request: {url: 'http://example.com/0/0/0.pbf'},
            uid: 1,
            tileID: {overscaledZ: 0, wrap: 0, canonical: {z: 0, x: 0, y: 0}},
            tileZoom: 0,
            zoom: 0,
        };

        await new Promise<void>((resolve) => {
            loadVectorTile.call({deduped}, params, (err, data) => {
                expect(err).toBeTruthy();
                expect(err.status).toBe(500);
                resolve();
            });
        });
    });

});

// FORK: coverage for the vector tile request cap added to DedupedRequest. See FORK.md.
//
// These drive `DedupedRequest.request()` directly rather than going through `loadVectorTile` and
// mockFetch. That is deliberate: `request()` already takes the request function as an argument, so a
// fake one lets a test decide exactly when each request settles and observe the cap, the drain order
// and cancellation synchronously. Routing through fetch would make the same assertions depend on
// microtask scheduling, and it was the desire to inject here that previously pushed the fork into
// changing `loadVectorTile`'s signature across three files.
describe('DedupedRequest request queue', () => {
    const METADATA = {type: 'parseTile', zoom: 0};
    const MAX = MAX_PARALLEL_VECTOR_TILE_REQUESTS;

    type IssuedRequest = {
        key: string;
        aborted: boolean;
        settle: () => void;
    };

    // A request function that never settles by itself — each test settles or aborts by hand.
    const harness = () => {
        const issued: IssuedRequest[] = [];
        const requestFor = (key: string) => (callback: LoadVectorDataCallback) => {
            const record: IssuedRequest = {
                key,
                aborted: false,
                settle: () => { callback(null, {rawData: new ArrayBuffer(0)}); }
            };
            issued.push(record);
            return () => { record.aborted = true; };
        };
        const find = (key: string): IssuedRequest => {
            const record = issued.find(r => r.key === key);
            if (!record) throw new Error(`no request was issued for '${key}'`);
            return record;
        };
        return {issued, find, keys: () => issued.map(r => r.key), requestFor};
    };

    // Occupy every slot, one distinct key per slot, and return the cancel handles.
    const saturate = (deduped: DedupedRequest, h: ReturnType<typeof harness>) => {
        const cancels: Array<() => void> = [];
        for (let i = 0; i < MAX; i++) {
            cancels.push(deduped.request(`fill-${i}`, METADATA, h.requestFor(`fill-${i}`), () => {}));
        }
        expect(h.issued).toHaveLength(MAX);
        return cancels;
    };

    beforeEach(() => {
        resetRequestQueue();
    });

    test('deduplicates concurrent requests for the same key', () => {
        const h = harness();
        const deduped = new DedupedRequest();

        deduped.request('same', METADATA, h.requestFor('same'), () => {});
        deduped.request('same', METADATA, h.requestFor('same'), () => {});
        deduped.request('same', METADATA, h.requestFor('same'), () => {});

        expect(h.issued).toHaveLength(1);
    });

    test('issues at most MAX_PARALLEL_VECTOR_TILE_REQUESTS at a time', () => {
        const h = harness();
        const deduped = new DedupedRequest();

        for (let i = 0; i < MAX * 2; i++) {
            deduped.request(`k-${i}`, METADATA, h.requestFor(`k-${i}`), () => {});
        }

        expect(h.issued).toHaveLength(MAX);
    });

    test('drains parked requests in FIFO order as in-flight ones settle', () => {
        const h = harness();
        const deduped = new DedupedRequest();
        saturate(deduped, h);

        deduped.request('parked-a', METADATA, h.requestFor('parked-a'), () => {});
        deduped.request('parked-b', METADATA, h.requestFor('parked-b'), () => {});
        expect(h.issued).toHaveLength(MAX);

        h.issued[0].settle();
        expect(h.issued).toHaveLength(MAX + 1);
        expect(h.issued[MAX].key).toBe('parked-a');

        h.issued[1].settle();
        expect(h.issued[MAX + 1].key).toBe('parked-b');
    });

    test('a request cancelled while parked never issues, and yields its slot', () => {
        const h = harness();
        const deduped = new DedupedRequest();
        saturate(deduped, h);

        const cancelParked = deduped.request('cancelled', METADATA, h.requestFor('cancelled'), () => {});
        deduped.request('behind-it', METADATA, h.requestFor('behind-it'), () => {});

        cancelParked();
        h.issued[0].settle();

        // The freed slot goes to the request queued behind it, not to the cancelled one — a
        // cancelled tile must not hold a slot it will never use.
        expect(h.keys()).not.toContain('cancelled');
        expect(h.issued[MAX].key).toBe('behind-it');
    });

    test('cancelling an in-flight request aborts it and yields its slot', () => {
        const h = harness();
        const deduped = new DedupedRequest();
        const cancels = saturate(deduped, h);

        deduped.request('parked', METADATA, h.requestFor('parked'), () => {});
        expect(h.issued).toHaveLength(MAX);

        cancels[0]();

        expect(h.issued[0].aborted).toBe(true);
        expect(h.issued[MAX].key).toBe('parked');
    });

    test('a callback that waited in the queue fires exactly once', () => {
        // Regression test for entry.callbacks being a Set. Admission re-enters request() with a
        // callback already registered on the entry; with upstream's array this fires twice, which
        // parses the tile twice and races two results into one WorkerTile.
        const h = harness();
        const deduped = new DedupedRequest();
        saturate(deduped, h);

        const callback = vi.fn();
        deduped.request('parked', METADATA, h.requestFor('parked'), callback);

        h.issued[0].settle();
        h.find('parked').settle();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    test('the cap is shared across DedupedRequest instances', () => {
        // There is one DedupedRequest per worker source. A per-instance counter would let N sources
        // each open MAX connections, so the cap has to be module-level — and admission has to
        // dispatch back through the instance that parked the request.
        const h = harness();
        const a = new DedupedRequest();
        const b = new DedupedRequest();
        saturate(a, h);

        const callback = vi.fn();
        b.request('via-b', METADATA, h.requestFor('via-b'), callback);
        expect(h.issued).toHaveLength(MAX);

        h.issued[0].settle();
        expect(h.issued[MAX].key).toBe('via-b');

        expect(callback).not.toHaveBeenCalled();
        h.issued[MAX].settle();
        expect(callback).toHaveBeenCalledTimes(1);
    });
});
