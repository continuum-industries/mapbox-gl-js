import {getType, setType} from './source';
import {Standard, prepareStandard} from '../../modules/standard_main';
import {RasterArray, prepareRasterArray} from '../../modules/raster_array_main';

import type {ISource} from './source';
import type {Class} from '../types/class';
import type {Source} from './source_types';

// Source types whose class lives in a lazily-loaded module. The loader is routed
// through the module facade so registration itself does not statically anchor the
// class into core (UMD resolves the facade eagerly, ESM lazily via dynamic import).
//
// This registry lives apart from `source.ts` on purpose: `source.ts` is shared between
// the main and worker bundles, so a dynamic `import()` reachable from it would be pulled
// into the worker's chunk graph. Keeping the main-thread lazy loaders here (imported only
// by `Style`) keeps the Standard main chunk out of the worker bundle.
const lazySourceLoaders: Partial<Record<Source['type'], () => Promise<Class<ISource> | undefined>>> = {
    model: () => prepareStandard().then(() => Standard.ModelSource as Class<ISource> | undefined),
    'batched-model': () => prepareStandard().then(() => Standard.Tiled3dModelSource as Class<ISource> | undefined),
    'raster-array': () => prepareRasterArray().then(() => RasterArray.RasterArrayTileSource as Class<ISource> | undefined)
};

// True for a source type whose class is registered lazily (loaded on demand). Callers
// use this to keep the synchronous `addSource` contract via a placeholder while the
// owning module loads (see `Style#addSource`).
export const isLazySourceType = function (name: string): boolean {
    return Object.hasOwn(lazySourceLoaders, name);
};

// Resolves once the class for `name` is registered. No-op if already registered (fast
// path); awaits the module load for a lazy type; throws for a genuinely unknown type.
// Safe to call concurrently — `import()` is module-cached and `setType` is idempotent.
export const ensureSourceType = async function (name: string): Promise<void> {
    if (getType(name)) return;
    const loader = lazySourceLoaders[name as Source['type']];
    if (!loader) {
        throw new Error(`Unknown source type "${name}"`);
    }
    const type = await loader();
    // A failed module load (warned in the facade) leaves `type` undefined; `createSource`
    // will still throw "Unknown source type" for the caller, matching non-lazy behavior.
    if (type && !getType(name)) {
        setType(name, type);
    }
};
