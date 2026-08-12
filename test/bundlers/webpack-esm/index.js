import * as mapboxgl from 'mapbox-gl/esm';

mapboxgl.addTileProvider('pmtiles', `${location.origin}/mapbox-gl-pmtiles-provider.js`);

const map = window.map = new mapboxgl.Map({
    container: 'map',
    testMode: true,
    // Adding this source triggers a dynamic import in the worker.
    style: {version: 8, sources: {pmtiles: {type: 'vector', url: `${location.origin}/vector.pmtiles`}}, layers: []}
});
