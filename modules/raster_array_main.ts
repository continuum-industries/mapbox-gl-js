import * as module from './raster_array_main_imports';

export const RasterArray: Partial<typeof module.RasterArray> = module.RasterArray;

export async function prepareRasterArray(): Promise<void> { return Promise.resolve(); }
