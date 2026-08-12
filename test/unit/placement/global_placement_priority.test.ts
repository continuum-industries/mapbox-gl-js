import {describe, test, expect} from '../../util/vitest';
import {comparePriority} from '../../../src/placement/global_placement_priority';
import {SymbolPlacementType, SymbolVariantVisibility} from '../../../src/placement/types';

import type {GlobalPlacementPriority} from '../../../src/placement/global_placement_priority';

function basePriority(): GlobalPlacementPriority {
    return {
        placementSubgroupOrder: 0,
        symbolPlacementPriority: 0,
        symbolVariantVisibility: SymbolVariantVisibility.SYMBOL_INVISIBLE,
        symbolPlacementType: SymbolPlacementType.REPEATED,
        styleLayerOrder: 0,
        symbolDisplayOrder: 0,
    };
}

describe('GlobalPlacementPriority', () => {
    test('fields are compared in priority order', () => {
        const symbolDisplayOrderChanged = {...basePriority(), symbolDisplayOrder: 1};
        const styleLayerOrderChanged = {...basePriority(), styleLayerOrder: 1};
        const symbolPlacementTypeChanged = {...basePriority(), symbolPlacementType: SymbolPlacementType.FIXED};
        const symbolVariantVisibilityChanged = {...basePriority(), symbolVariantVisibility: SymbolVariantVisibility.VARIANT_VISIBLE};
        const symbolPlacementPriorityChanged = {...basePriority(), symbolPlacementPriority: 1};
        const placementSubgroupOrderChanged = {...basePriority(), placementSubgroupOrder: 1};

        const expected = [
            placementSubgroupOrderChanged,
            symbolPlacementPriorityChanged,
            symbolVariantVisibilityChanged,
            symbolPlacementTypeChanged,
            styleLayerOrderChanged,
            symbolDisplayOrderChanged,
        ];

        const sorted = [
            symbolDisplayOrderChanged,
            styleLayerOrderChanged,
            symbolPlacementTypeChanged,
            symbolVariantVisibilityChanged,
            symbolPlacementPriorityChanged,
            placementSubgroupOrderChanged,
        ].sort((a, b) => comparePriority(b, a));

        expect(sorted).toEqual(expected);
    });

    test('symbol variant visibility is ordered invisible < symbol-visible-variant-invisible < variant-visible', () => {
        expect(SymbolVariantVisibility.SYMBOL_INVISIBLE).toBeLessThan(SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE);
        expect(SymbolVariantVisibility.SYMBOL_VISIBLE_VARIANT_INVISIBLE).toBeLessThan(SymbolVariantVisibility.VARIANT_VISIBLE);
    });
});
