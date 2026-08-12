import {warnOnce} from '../src/util/util';

import type {RasterArray as RasterArrayType} from './raster_array_main_imports';

// The raster-array module holds the RasterArrayTileSource / RasterArrayTile classes and the
// MRT decoder. It is loaded lazily on first use of a `raster-array` source (see
// lazy_source_types) so the MRT decoder stays out of the always-loaded core bundle.
export const RasterArray: Partial<typeof RasterArrayType> = {};

export async function prepareRasterArray(): Promise<void> {
    try {
        const {RasterArray: rasterArrayModule} = await import('./raster_array_main_imports');
        Object.assign(RasterArray, rasterArrayModule);
    } catch (error) {
        warnOnce('Could not load raster-array module.');
    }
}
