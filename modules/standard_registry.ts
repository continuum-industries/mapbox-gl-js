// UMD counterpart of `standard_registry_esm`: everything is eager and single-file, so
// the registry is simply the fully-populated Standard object. Substituted for
// `standard_registry_esm` in the ESM build (see `filesToSub` in rollup.config.esm.ts).
export {Standard} from './standard_main_imports';
