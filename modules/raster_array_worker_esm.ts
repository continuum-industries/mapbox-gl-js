import {warnOnce} from '../src/util/util';

// Live binding — set by `prepareRasterArray()` once the raster-array worker chunk finishes
// loading. The worker checks it before invoking the source.
export let RasterArrayTileWorkerSource;

export async function prepareRasterArray(): Promise<void> {
    try {
        const mod = await import('./raster_array_worker_imports');
        RasterArrayTileWorkerSource = mod.RasterArrayTileWorkerSource;
    } catch (error) {
        warnOnce('Could not load raster-array module.');
    }
}
