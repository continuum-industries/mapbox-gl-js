import mapboxgl from 'mapbox-gl/dist/mapbox-gl-csp.js';
import MapboxGLWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker.js';

mapboxgl.workerClass = MapboxGLWorker;
mapboxgl.addTileProvider('pmtiles', `${location.origin}/mapbox-gl-pmtiles-provider.js`);

const map = window.map = new mapboxgl.Map({
    container: 'map',
    testMode: true,
    // Adding this source triggers a dynamic import in the worker.
    style: {version: 8, sources: {pmtiles: {type: 'vector', url: `${location.origin}/vector.pmtiles`}}, layers: []}
});
