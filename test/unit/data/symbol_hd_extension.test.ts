// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {describe, test, expect} from '../../util/vitest';
import {CanonicalTileID} from '../../../src/source/tile_id';
import EXTENT from '../../../src/style-spec/data/extent';
import {ElevationFeature} from '../../../3d-style/elevation/elevation_feature';
import {SymbolHDExtension} from '../../../3d-style/data/bucket/symbol_hd_extension';
import {PROPERTY_ELEVATION_ID} from '../../../3d-style/elevation/elevation_constants';
import {SymbolInstanceArray, SymbolOrientationArray} from '../../../src/data/array_types';
import {serialize, deserialize} from '../../../src/util/web_worker_transfer';
import Point from '@mapbox/point-geometry';
import {vec2} from 'gl-matrix';

function mkConstantFeature(id: number, height: number): ElevationFeature {
    return new ElevationFeature(id, {min: 0, max: EXTENT}, height);
}

function mkFeature(id: number) {
    return {
        properties: {[PROPERTY_ELEVATION_ID]: id},
        type: 1,
        index: 0,
        sourceLayerIndex: 0,
        geometry: [[new Point(100, 100)]],
        patterns: {},
    };
}

function mkBucket(): {
    symbolInstances: SymbolInstanceArray;
    text: {orientationVertexArray: SymbolOrientationArray | undefined};
    icon: {orientationVertexArray: SymbolOrientationArray | undefined};
    hasAnyZOffset: boolean;
    zOffsetBuffersNeedUpload: boolean;
    zOffsetSortDirty: boolean;
} {
    return {
        symbolInstances: new SymbolInstanceArray(),
        text: {orientationVertexArray: new SymbolOrientationArray()},
        icon: {orientationVertexArray: undefined},
        hasAnyZOffset: false,
        zOffsetBuffersNeedUpload: false,
        zOffsetSortDirty: false,
    };
}

function addSymbolInstance(bucket: ReturnType<typeof mkBucket>, elevationFeatureIndex: number) {
    bucket.symbolInstances.emplaceBack(
        100, 100,
        100, 100, 0,
        -1, -1, -1, -1, -1, -1,
        0,
        0, 0, 0, 0, 0, 0, 0, 0,
        0,
        0, 0, 0, 0,
        0,
        0, 0, 0,
        0,
        0,
        0,
        elevationFeatureIndex,
    );
}

describe('SymbolHDExtension cross-source elevation', () => {
    const consumerCanonical = new CanonicalTileID(14, 8796, 5374);
    const providerCanonical = new CanonicalTileID(14, 8796, 5373);

    test('same-tile pre-populated id returns existing index', () => {
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, null, true, false);
        ext.addElevationFeatures([mkConstantFeature(42, 5.0)], consumerCanonical);

        expect(ext.resolveRoadElevation(mkFeature(42), 42)).toBe(0);
        expect(ext.elevationFeatures.length).toBe(1);
    });

    test('registry hit registers provider tile and elevates', () => {
        const elevation = mkConstantFeature(7, 10.0);
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, {
            registry: [{tileId: providerCanonical, feature: elevation}],
            hasCoveringTile: true,
            allProvidersReady: true,
        }, true, false);

        const index = ext.resolveRoadElevation(mkFeature(7), 7);
        expect(index).toBe(0);
        expect(ext.elevationFeatureTileIds[0].key).toBe(providerCanonical.key);

        const bucket = mkBucket();
        addSymbolInstance(bucket, index);
        ext.updateRoadElevation(bucket, consumerCanonical);
        expect(bucket.symbolInstances.get(0).zOffset).toBeCloseTo(10.075, 4);
        expect(bucket.hasAnyZOffset).toBe(true);
    });

    test('providers not ready → defer', () => {
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, {
            registry: [],
            hasCoveringTile: false,
            allProvidersReady: false,
        }, true, false);

        expect(ext.resolveRoadElevation(mkFeature(999), 999)).toBe('defer');
        expect(ext.hasDeferredElevationFeatures).toBe(true);
        expect(ext.elevationFeatures.length).toBe(0);
    });

    test('providers ready with registry miss → flat at ground', () => {
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, {
            registry: [],
            hasCoveringTile: true,
            allProvidersReady: true,
        }, true, false);

        expect(ext.resolveRoadElevation(mkFeature(999), 999)).toBe(0xffff);
        expect(ext.hasDeferredElevationFeatures).toBe(false);
    });

    test('cross-zoom provider tile uses sampler in updateRoadElevation', () => {
        const elevTile = new CanonicalTileID(14, 100, 200);
        const childTile = new CanonicalTileID(15, 200, 400);

        const safeArea = {min: new Point(0, 0), max: new Point(4096, 4096)};
        const vertices = [
            {position: vec2.fromValues(0, 0), height: 0.0, extent: 1.0},
            {position: vec2.fromValues(2000, 0), height: 10.0, extent: 1.0},
        ];
        const edges = [{a: 0, b: 1}];
        const elevation = new ElevationFeature(5, safeArea, undefined, vertices, edges, 1.0);

        const ext = new SymbolHDExtension();
        ext.configureCrossSource(childTile, {
            registry: [{tileId: elevTile, feature: elevation}],
            hasCoveringTile: true,
            allProvidersReady: true,
        }, true, false);

        const index = ext.resolveRoadElevation(mkFeature(5), 5);
        expect(index).toBe(0);
        expect(ext.elevationFeatureTileIds[0].key).toBe(elevTile.key);

        const bucket = mkBucket();
        bucket.symbolInstances.emplaceBack(
            1000, 0,
            1000, 0, 0,
            -1, -1, -1, -1, -1, -1,
            0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0,
            0, 0, 0, 0,
            0,
            0, 0, 0,
            0,
            0,
            0,
            index,
        );
        ext.updateRoadElevation(bucket, childTile);
        expect(bucket.symbolInstances.get(0).zOffset).toBeCloseTo(2.575, 3);
    });

    test('getRoadFeatureHeightAtAnchor same-tile uses pointElevation', () => {
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, null, true, false);
        ext.addElevationFeatures([mkConstantFeature(42, 5.0)], consumerCanonical);

        const anchor = new Point(100, 100);
        expect(ext.getRoadFeatureHeightAtAnchor(0, anchor, consumerCanonical)).toBe(5.0);
    });

    test('getRoadFeatureHeightAtAnchor cross-tile matches updateRoadElevation height', () => {
        const elevTile = new CanonicalTileID(14, 100, 200);
        const childTile = new CanonicalTileID(15, 200, 400);

        const safeArea = {min: new Point(0, 0), max: new Point(4096, 4096)};
        const vertices = [
            {position: vec2.fromValues(0, 0), height: 0.0, extent: 1.0},
            {position: vec2.fromValues(2000, 0), height: 10.0, extent: 1.0},
        ];
        const edges = [{a: 0, b: 1}];
        const elevation = new ElevationFeature(5, safeArea, undefined, vertices, edges, 1.0);

        const ext = new SymbolHDExtension();
        ext.configureCrossSource(childTile, {
            registry: [{tileId: elevTile, feature: elevation}],
            hasCoveringTile: true,
            allProvidersReady: true,
        }, true, false);

        const index = ext.resolveRoadElevation(mkFeature(5), 5);
        const anchor = new Point(1000, 0);

        const height = ext.getRoadFeatureHeightAtAnchor(index, anchor, childTile);
        expect(height).toBeCloseTo(2.5, 3);

        const bucket = mkBucket();
        bucket.symbolInstances.emplaceBack(
            1000, 0,
            1000, 0, 0,
            -1, -1, -1, -1, -1, -1,
            0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0,
            0, 0, 0, 0,
            0,
            0, 0, 0,
            0,
            0,
            0,
            index,
        );
        ext.updateRoadElevation(bucket, childTile);
        expect(bucket.symbolInstances.get(0).zOffset - 0.075).toBeCloseTo(height, 3);
    });

    test('getRoadFeatureHeightAtAnchor returns null for flat index', () => {
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, null, true, false);
        expect(ext.getRoadFeatureHeightAtAnchor(0xffff, new Point(0, 0), consumerCanonical)).toBeNull();
    });

    test('isCrossTileRoadElevation is false for same-tile provider', () => {
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, null, true, false);
        ext.addElevationFeatures([mkConstantFeature(42, 5.0)], consumerCanonical);
        expect(ext.isCrossTileRoadElevation(0, consumerCanonical)).toBe(false);
    });

    test('isCrossTileRoadElevation is true when provider tile differs', () => {
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, {
            registry: [{tileId: providerCanonical, feature: mkConstantFeature(7, 10.0)}],
            hasCoveringTile: true,
            allProvidersReady: true,
        }, true, false);
        ext.resolveRoadElevation(mkFeature(7), 7);
        expect(ext.isCrossTileRoadElevation(0, consumerCanonical)).toBe(true);
    });

    test('worker-only state is omitted from worker→main transfer', () => {
        const consumerCanonical = new CanonicalTileID(14, 8796, 5374);
        const providerCanonical = new CanonicalTileID(14, 8796, 5373);
        const elevation = mkConstantFeature(7, 10.0);
        const ext = new SymbolHDExtension();
        ext.configureCrossSource(consumerCanonical, {
            registry: [{tileId: providerCanonical, feature: elevation}],
            hasCoveringTile: true,
            allProvidersReady: true,
        }, true, false);
        ext.resolveRoadElevation(mkFeature(7), 7);
        ext.clearWorkerState();

        const roundTripped = deserialize(serialize(ext)) as SymbolHDExtension;
        expect(roundTripped.elevationFeatures.length).toBe(1);
        expect(roundTripped.elevationFeatureTileIds[0].key).toBe(providerCanonical.key);
        expect(roundTripped.elevationParams).toBeUndefined();
        expect(roundTripped.crossSourceElevationEnabled).toBeFalsy();
        expect(roundTripped.hasDeferredElevationFeatures).toBeFalsy();
        expect(roundTripped.elevationFeatureIdToIndex).toBeUndefined();
    });
});
