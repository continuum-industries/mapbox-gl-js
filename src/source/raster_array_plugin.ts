import type {OverscaledTileID} from './tile_id';
import type Painter from '../render/painter';
import type RasterArrayTile from './raster_array_tile';

// Factory seam for the lazily-loaded raster-array module. `RasterArrayTile` is constructed by
// core-resident generic code (`SourceCache`), but the class itself lives in the raster-array
// chunk — a static value import here would re-anchor that whole graph (MRT decoder included)
// into core. The lazy module registers its constructor via `registerRasterArrayTile` on load;
// core builds tiles through `createRasterArrayTile`. `import type` above is erased by tsc, so
// nothing here anchors the chunk.

type RasterArrayTileFactory = (
    tileID: OverscaledTileID,
    size: number,
    tileZoom: number,
    painter?: Painter | null,
    isRaster?: boolean
) => RasterArrayTile;

let factory: RasterArrayTileFactory | undefined;

/**
 * Registers the `RasterArrayTile` constructor. Called as a side effect of loading the
 * raster-array module so `createRasterArrayTile` can build tiles without core statically
 * importing the class.
 * @private
 */
export function registerRasterArrayTile(create: RasterArrayTileFactory) {
    factory = create;
}

/**
 * Builds a `RasterArrayTile` through the registered factory. Throws if the raster-array module
 * has not been loaded yet (should never happen: the source type load precedes tile creation).
 * @private
 */
export function createRasterArrayTile(
    tileID: OverscaledTileID,
    size: number,
    tileZoom: number,
    painter?: Painter | null,
    isRaster?: boolean
): RasterArrayTile {
    if (!factory) {
        throw new Error('Raster-array module is not loaded.');
    }
    return factory(tileID, size, tileZoom, painter, isRaster);
}
