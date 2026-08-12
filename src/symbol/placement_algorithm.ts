import type {mat4} from 'gl-matrix';
import type Point from '@mapbox/point-geometry';
import type Transform from '../geo/transform';
import type {FogState} from '../style/fog_helpers';
import type Projection from '../geo/projection/projection';
import type SymbolBucket from '../data/bucket/symbol_bucket';
import type {SingleCollisionBox} from '../data/bucket/symbol_bucket';
import type {GlyphOffsetArray, SymbolLineVertexArray, PlacedSymbol} from '../data/array_types';
import type {OverscaledTileID} from '../source/tile_id';
import type {PlacedCollisionBox, PlacedCollisionCircles, ScreenAnchorPoint} from './collision_index';
import type {BucketPart, CollisionGroup, Placement} from './placement';

/// Interface that mirrors the public placement-relevant surface of `CollisionIndex`.
/// Two consumers: `placeLayerBucketPart` writes to the grid during placement;
/// `queryRenderedFeatures` reads from it after placement ends.
export interface CollisionDetector {
    placeCollisionBox: (
        bucket: SymbolBucket,
        scale: number,
        collisionBox: SingleCollisionBox,
        mercatorCenter: [number, number],
        invMatrix: mat4,
        projectedPosOnLabelSpace: boolean,
        shift: Point,
        allowOverlap: boolean,
        textPixelRatio: number,
        posMatrix: mat4,
        collisionGroupPredicate?: CollisionGroup['predicate'],
    ) => PlacedCollisionBox;

    placeCollisionCircles: (
        bucket: SymbolBucket,
        allowOverlap: boolean,
        symbol: PlacedSymbol,
        symbolIndex: number,
        lineVertexArray: SymbolLineVertexArray,
        glyphOffsetArray: GlyphOffsetArray,
        fontSize: number,
        posMatrix: Float32Array,
        labelPlaneMatrix: Float32Array,
        labelToScreenMatrix: mat4 | null | undefined,
        showCollisionCircles: boolean,
        pitchWithMap: boolean,
        collisionGroupPredicate: CollisionGroup['predicate'],
        circlePixelDiameter: number,
        textPixelPadding: number,
        tileID: OverscaledTileID,
    ) => PlacedCollisionCircles;

    insertCollisionBox: (
        collisionBox: Array<number>,
        ignorePlacement: boolean,
        bucketInstanceId: number,
        featureIndex: number,
        collisionGroupID: number,
    ) => void;

    insertCollisionCircles: (
        collisionCircles: Array<number>,
        ignorePlacement: boolean,
        bucketInstanceId: number,
        featureIndex: number,
        collisionGroupID: number,
    ) => void;

    projectAndGetPerspectiveRatio: (
        posMatrix: mat4,
        x: number,
        y: number,
        z: number,
        tileID: OverscaledTileID | null | undefined,
        checkOcclusion: boolean,
        bucketProjection: Projection,
    ) => ScreenAnchorPoint;

    clearClippedSymbolsForBucket: (bucketInstanceId: number) => void;
    markSymbolAsClipped: (bucketInstanceId: number, featureIndex: number) => void;
    isOffscreen: (x1: number, y1: number, x2: number, y2: number) => boolean;
    isInsideGrid: (x1: number, y1: number, x2: number, y2: number) => boolean;
    getViewportMatrix: () => mat4;

    queryRenderedSymbols: (viewportQueryGeometry: Array<Point>) => {[id: number]: Array<number>};

    readonly transform: Transform;
}

/// Single interface that bundles collision detection, placement decisions, and
/// time-budget scheduling. Implementations are registered by name and selected
/// via `MapOptions.placementAlgorithm`.
export interface PlacementAlgorithm {
    // Called once per placement cycle when PauseablePlacement.startNewPlacement()
    // creates a new Placement. `prevCollisionADetector` is the CollisionDetector
    // from the previous cycle: implementations may reset and reuse it, like GL Native does,
    // rather than allocating fresh
    createCollisionDetector: (
        transform: Transform,
        fogState?: FogState | null,
        prevCollisionADetector?: CollisionDetector | null,
    ) => CollisionDetector;

    /// Core placement decision loop. Called per layer bucket part by
    /// LayerPlacement.continuePlacement() during phase 2.
    placeLayerBucketPart: (
        placement: Placement,
        bucketPart: BucketPart,
        seenCrossTileIDs: Set<number>,
        showCollisionBoxes: boolean,
        scaleFactor: number,
    ) => void;

    /// Time-budget predicate. Return true to pause and resume next frame.
    /// The fadeDuration===0 and isFullPlacementRequested() bypasses live in
    /// PauseablePlacement and short-circuit before this is called.
    shouldPause: (elapsedMs: number) => boolean;
}
