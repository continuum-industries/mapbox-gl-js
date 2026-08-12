import {DefaultPlacementAlgorithm} from './default';

import type {PlacementAlgorithm} from '../placement_algorithm';

export const algorithms: Record<string, PlacementAlgorithm> = {
    'default': new DefaultPlacementAlgorithm()
};

export type PlacementAlgorithmName = keyof typeof algorithms;
