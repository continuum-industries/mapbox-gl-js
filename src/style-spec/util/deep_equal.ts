/**
 * Deeply compares two object literals.
 *
 * @private
 */
function deepEqual(a?: unknown, b?: unknown): boolean {
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }
    if (typeof a === 'object' && a !== null && b !== null) {
        if (!(typeof b === 'object')) return false;
        const aRec = a as Record<string, unknown>;
        const bRec = b as Record<string, unknown>;
        const keys = Object.keys(aRec);
        if (keys.length !== Object.keys(bRec).length) return false;
        for (const key in aRec) {
            if (!deepEqual(aRec[key], bRec[key])) return false;
        }
        return true;
    }
    return a === b;
}

export default deepEqual;
