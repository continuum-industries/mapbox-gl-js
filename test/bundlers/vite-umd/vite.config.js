import {defineConfig} from 'vite';

export default defineConfig({
    build: {
        commonjsOptions: {
            include: [/mapbox-gl/],
        },
    },
});
