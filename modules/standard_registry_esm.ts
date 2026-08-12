import type {Standard as StandardType} from './standard_main_imports';

// The shared Standard registry object, populated by `prepareStandard()` in
// `standard_main_esm`. Kept in its own module — free of the `import()` that loads the
// Standard chunk — so read-only consumers reachable from the worker bundle (e.g.
// `feature_index`, `model_style_layer`) can reference the registry without dragging the
// main-thread Standard chunk into the worker's module graph.
export const Standard: Partial<typeof StandardType> = {};
