import {defineConfig, mergeConfig} from 'vitest/config';
import baseConfig, {chromiumBrowser} from './vitest.config.base';

export default mergeConfig(baseConfig, defineConfig({
    test: {
        include: ['test/build/esm.test.ts'],
        browser: chromiumBrowser(),
    }
}));
