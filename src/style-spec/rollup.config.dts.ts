import {dts} from 'rollup-plugin-dts';

import type {RollupOptions} from 'rollup';

// Bundles the style-spec type declarations into a single `dist/index.d.ts`.
// Unlike the main library, style-spec has real runtime `dependencies`, so their
// types stay external `import`s (consumers install them) rather than being inlined.
export default (): RollupOptions => ({
    input: './style-spec.ts',
    output: {
        file: './dist/index.d.ts',
        format: 'es',
    },
    plugins: [
        dts({tsconfig: '../../tsconfig.browser.json'}),
    ],
});
