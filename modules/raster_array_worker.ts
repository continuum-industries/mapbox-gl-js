// UMD (and untranspiled unit tests): the worker source is resolved synchronously at bundle
// load time. ESM exposes the same shape but lazily.
export {RasterArrayTileWorkerSource} from './raster_array_worker_imports';

export async function prepareRasterArray(): Promise<void> { return Promise.resolve(); }
