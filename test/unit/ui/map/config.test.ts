// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect, waitFor, createMap} from '../../../util/vitest';
import {createStyle} from '../map/util';

describe('Map#config', () => {
    test('config in constructor', async () => {
        const map = createMap({
            style: createStyle({
                // Style with `schema` property will be wrapped into a fragment with ID `basemap`
                schema: {
                    lightPreset: {type: 'string', default: 'day'}
                }
            }),
            config: {
                basemap: {
                    lightPreset: 'night'
                }
            },
        });

        await waitFor(map, 'style.load');

        expect(map.getConfigProperty('basemap', 'lightPreset')).toEqual('night');
    });

    test('#setStyle', async () => {
        const map = createMap();

        const style = createStyle({
            schema: {
                lightPreset: {type: 'string', default: 'day'}
            }
        });

        map.setStyle(style, {
            config: {
                basemap: {
                    lightPreset: 'night'
                }
            }
        });

        await waitFor(map, 'style.load');

        expect(map.getConfigProperty('basemap', 'lightPreset')).toEqual('night');
    });

    test('#setConfig and #getConfig', async () => {
        const map = createMap({
            style: createStyle({
                schema: {
                    lightPreset: {type: 'string', default: 'day'},
                    showPointOfInterestLabels: {type: 'boolean', default: true}
                }
            })
        });

        await waitFor(map, 'style.load');

        expect(map.getConfig('basemap')).toEqual({
            lightPreset: 'day',
            showPointOfInterestLabels: true
        });

        map.setConfig('basemap', {
            lightPreset: 'night',
            showPointOfInterestLabels: false
        });

        expect(map.getConfig('basemap')).toEqual({
            lightPreset: 'night',
            showPointOfInterestLabels: false
        });
    });

    test('#setConfigProperty and #getConfigProperty', async () => {
        const map = createMap({
            style: createStyle({
                schema: {
                    lightPreset: {type: 'string', default: 'day'},
                    showPointOfInterestLabels: {type: 'boolean', default: true}
                }
            })
        });

        await waitFor(map, 'style.load');

        expect(map.getConfigProperty('basemap', 'lightPreset')).toEqual('day');
        expect(map.getConfigProperty('basemap', 'showPointOfInterestLabels')).toEqual(true);

        map.setConfigProperty('basemap', 'lightPreset', 'night');
        map.setConfigProperty('basemap', 'showPointOfInterestLabels', false);

        expect(map.getConfigProperty('basemap', 'lightPreset')).toEqual('night');
        expect(map.getConfigProperty('basemap', 'showPointOfInterestLabels')).toEqual(false);
    });

    test('color schema default with interpolate of string colors loads successfully', async () => {
        // Reproduces the colorHDRoads schema "default" pattern: a config option
        // declared as `type: "color"` whose default is an interpolate of CSS
        // color strings. The schema-declared type must propagate to the
        // expression parser so the strings are coerced to colors and the
        // interpolate output type resolves as `color`.
        const map = createMap({
            style: createStyle({
                schema: {
                    colorHDRoads: {
                        type: 'color',
                        default: [
                            'interpolate', ['linear'], ['zoom'],
                            10, 'hsl(0, 100%, 63%)',
                            16, 'hsl(240, 100%, 73%)'
                        ]
                    }
                }
            })
        });

        await waitFor(map, 'style.load');

        // After parsing, the constant-folded color literals are serialized as
        // `["rgba", r, g, b, a]`, so check structure plus that the stop colors
        // round-trip to the same RGB values as parsing the source strings.
        expect(map.getConfigProperty('basemap', 'colorHDRoads')).toEqual([
            'interpolate', ['linear'], ['zoom'],
            10, ['rgba', 255, 66, 66, 1],
            16, ['rgba', 117, 117, 255, 1]
        ]);
    });
});
