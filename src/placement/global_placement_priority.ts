import type {SymbolPlacementTypeValue, SymbolVariantVisibilityValue} from './types';

export type GlobalPlacementPriority = {
    placementSubgroupOrder: number;
    symbolPlacementPriority: number;
    symbolVariantVisibility: SymbolVariantVisibilityValue;
    symbolPlacementType: SymbolPlacementTypeValue;
    styleLayerOrder: number;
    symbolDisplayOrder: number;
};

export function comparePriority(a: GlobalPlacementPriority, b: GlobalPlacementPriority): number {
    return (
        a.placementSubgroupOrder - b.placementSubgroupOrder ||
        a.symbolPlacementPriority - b.symbolPlacementPriority ||
        a.symbolVariantVisibility - b.symbolVariantVisibility ||
        a.symbolPlacementType - b.symbolPlacementType ||
        a.styleLayerOrder - b.styleLayerOrder ||
        a.symbolDisplayOrder - b.symbolDisplayOrder
    );
}
