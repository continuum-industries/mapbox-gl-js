/* eslint-disable camelcase */
import {describe, test, expect} from '../../util/vitest';
import {needsRotationInVerticalMode} from '../../../src/util/script_detection';

// ---------------------------------------------------------------------------
// needsRotationInVerticalMode — tested against UAX #50 Vertical Text Layout
// https://www.unicode.org/reports/tr50/
// Data: https://www.unicode.org/Public/UCD/latest/ucd/VerticalOrientation.txt
//
// UAX #50 assigns every Unicode codepoint one of four Vertical_Orientation (vo)
// values:
//   U  — Upright: always drawn upright
//   R  — Rotated: always drawn sideways (90° CW)
//   Tu — Transformed, fallback Upright
//   Tr — Transformed, fallback Rotated
//
// In allowVerticalPlacement=true mode (text-writing-mode includes "vertical"),
// needsRotationInVerticalMode is the SOLE mechanism for rotating a character.
// Characters absent from this function appear upright regardless of their vo.
//
// Scope
// ─────
// This function only handles characters from the Shift JIS 2-byte standard
// that appear in Japanese map labels. It does NOT attempt full UAX #50
// coverage (e.g. Latin letters have vo=R but are not in scope here).
//
// Deviations from UAX #50
// ────────────────────────
// Where we deliberately diverge from the standard, the reason is documented
// in SHIFT_JIS_OVERRIDES below. All other characters should align exactly.
// ---------------------------------------------------------------------------

// Characters where UAX #50 assigns vo=Tr.
// "Tr" means the character ideally needs a special vertical-form glyph;
// absent that, it should fall back to rotation. Since we don't load font
// vertical alternates (vert/vrt2 OpenType features), we always rotate.
const UAX50_Tr = [
    0x3018, // 〘 LEFT WHITE TORTOISE SHELL BRACKET       (CJK Symbols)
    0x3019, // 〙 RIGHT WHITE TORTOISE SHELL BRACKET      (CJK Symbols)
    0x301C, // 〜 WAVE DASH                               (CJK Symbols)
    0x30A0, // ゠ KATAKANA-HIRAGANA DOUBLE HYPHEN          (Katakana)
    0x30FC, // ー KATAKANA-HIRAGANA PROLONGED SOUND MARK  (Katakana)
    0xFF5E, // ～ FULLWIDTH TILDE                          (HF Forms)
    0xFFE3, // ￣ FULLWIDTH MACRON                         (HF Forms)
];

// Characters where UAX #50 assigns vo=R, within the Shift JIS 2-byte scope.
// Ranges are verified by checking start, end, and immediate out-of-range
// neighbours as separate boundary tests below.
const UAX50_R = [
    0x2010, // ‐ HYPHEN                 (General Punctuation, 2010..2027 ; R)
    // 0x2015 (― HORIZONTAL BAR) is intentionally excluded — see MUST_NOT_ROTATE below
    0x2025, // ‥ TWO DOT LEADER         (General Punctuation, 2010..2027 ; R)
    0x2225, // ∥ PARALLEL TO            (Mathematical Operators, 221F..2233 ; R)
    0x2190, // ← LEFTWARDS ARROW        (Arrows, 2190..2194 ; R — we cover 2190..2193)
    0x2191, // ↑ UPWARDS ARROW
    0x2192, // → RIGHTWARDS ARROW
    0x2193, // ↓ DOWNWARDS ARROW
    0xFF1D, // ＝ FULLWIDTH EQUALS SIGN  (HF Forms, FF1C..FF1E ; R)
    // Box Drawing block — UAX #50 assigns 2500..257F ; R in its entirety.
    // We support 2500..254B (the characters listed in the Shift JIS 2-byte standard).
    // The full range is exercised in the dedicated loop test below.
];

// Characters where we intentionally deviate from UAX #50.
// These are Shift JIS 2-byte convention overrides: Japanese typography rotates
// them in vertical text even though UAX #50 says upright.
const SHIFT_JIS_OVERRIDES = [
    {char: 0x3013, uaxVo: 'U',  name: '〓 GETA MARK'},
    {char: 0xFF0E, uaxVo: 'Tu', name: '． FULLWIDTH FULL STOP'},
];

// Characters that must NOT return true from needsRotationInVerticalMode.
// Covers four categories:
//  a) UAX #50 vo=U (always upright) — CJK ideographs, kana, etc.
//  b) UAX #50 vo=Tr, but handled by verticalizedCharacterMap substitution
//     instead (glyph swapped before shaping; needsRotation is never consulted)
//  c) UAX #50 vo=R, but outside the Shift JIS 2-byte scope we support
//  d) UAX #50 vo=R, within Shift JIS scope, but is a substitution TARGET:
//     another character maps to this one via verticalizedCharacterMap, so rotating
//     it would undo the substitution and break the source character's rendering.
const MUST_NOT_ROTATE = [
    // (a) UAX #50 vo=U — upright CJK and kana
    {char: 0x30A2, uaxVo: 'U',  name: 'ア KATAKANA LETTER A'},
    {char: 0x3042, uaxVo: 'U',  name: 'あ HIRAGANA LETTER A'},
    {char: 0x4E2D, uaxVo: 'U',  name: '中 CJK UNIFIED IDEOGRAPH'},
    {char: 0x3012, uaxVo: 'U',  name: '〒 POSTAL MARK'},

    // (b) UAX #50 vo=Tr — handled by glyph substitution in verticalize_punctuation.ts
    {char: 0x3014, uaxVo: 'Tr', name: '〔 LEFT TORTOISE SHELL BRACKET (substituted to ︹)'},
    {char: 0x3015, uaxVo: 'Tr', name: '〕 RIGHT TORTOISE SHELL BRACKET (substituted to ︺)'},
    {char: 0xFF08, uaxVo: 'Tr', name: '（ FULLWIDTH LEFT PARENTHESIS (substituted to ︵)'},

    // (c) UAX #50 vo=R — outside Shift JIS 2-byte scope
    {char: 0x0041, uaxVo: 'R',  name: 'A LATIN CAPITAL LETTER A'},
    {char: 0x0061, uaxVo: 'R',  name: 'a LATIN SMALL LETTER A'},
    {char: 0x2013, uaxVo: 'R',  name: '– EN DASH (handled by verticalizedCharacterMap)'},
    {char: 0x2014, uaxVo: 'R',  name: '— EM DASH (handled by verticalizedCharacterMap)'},
    {char: 0x2194, uaxVo: 'R',  name: '↔ LEFT RIGHT ARROW (just outside 2190–2193 range)'},
    {char: 0x254C, uaxVo: 'R',  name: '╌ LIGHT DOUBLE DASH HORIZONTAL (just outside 2500–254B range)'},
    {char: 0x2580, uaxVo: 'R',  name: '▀ UPPER HALF BLOCK (Block Elements, not Box Drawing)'},

    // (d) UAX #50 vo=R, but is a substitution target — rotating it would undo the substitution.
    // Both U+007C (| VERTICAL LINE) and U+FF5C (｜ FULLWIDTH VERTICAL LINE) map to
    // U+2015 (― HORIZONTAL BAR) via verticalizedCharacterMap. Rotating U+2015 would turn the
    // substituted horizontal-bar glyph back into a vertical bar, defeating the substitution
    // and regressing rendering of both source characters in vertical text.
    {char: 0x2015, uaxVo: 'R',  name: '― HORIZONTAL BAR (substitution target for U+007C | and U+FF5C ｜)'},
];

// ---------------------------------------------------------------------------

describe('needsRotationInVerticalMode', () => {

    describe('UAX #50 vo=Tr characters — rotate as fallback (no vert glyph support)', () => {
        for (const char of UAX50_Tr) {
            test(`U+${char.toString(16).toUpperCase().padStart(4, '0')}`, () => {
                expect(needsRotationInVerticalMode(char)).toBe(true);
            });
        }
    });

    describe('UAX #50 vo=R characters — Shift JIS 2-byte scope', () => {
        for (const char of UAX50_R) {
            test(`U+${char.toString(16).toUpperCase().padStart(4, '0')}`, () => {
                expect(needsRotationInVerticalMode(char)).toBe(true);
            });
        }
    });

    describe('UAX #50 vo=R — Box Drawing block U+2500–U+254B (Shift JIS 2-byte subset)', () => {
        test('all 76 codepoints in range return true', () => {
            for (let char = 0x2500; char <= 0x254B; char++) {
                expect(needsRotationInVerticalMode(char)).toBe(true);
            }
        });

        test('U+24FF immediately before range — must not rotate', () => {
            expect(needsRotationInVerticalMode(0x24FF)).toBe(false);
        });

        test('U+254C immediately after range — must not rotate', () => {
            expect(needsRotationInVerticalMode(0x254C)).toBe(false);
        });
    });

    describe('UAX #50 vo=R — Directional Arrows boundary check', () => {
        test('U+218F immediately before U+2190–U+2193 range — must not rotate', () => {
            expect(needsRotationInVerticalMode(0x218F)).toBe(false);
        });

        test('U+2194 immediately after range — must not rotate', () => {
            expect(needsRotationInVerticalMode(0x2194)).toBe(false);
        });
    });

    describe('Shift JIS overrides — rotate despite UAX #50 saying upright', () => {
        for (const {char, uaxVo, name} of SHIFT_JIS_OVERRIDES) {
            test(`U+${char.toString(16).toUpperCase().padStart(4, '0')} ${name} (UAX #50 vo=${uaxVo}, Shift JIS convention overrides)`, () => {
                expect(needsRotationInVerticalMode(char)).toBe(true);
            });
        }
    });

    describe('characters that must NOT rotate', () => {
        for (const {char, uaxVo, name} of MUST_NOT_ROTATE) {
            test(`U+${char.toString(16).toUpperCase().padStart(4, '0')} ${name} (UAX #50 vo=${uaxVo})`, () => {
                expect(needsRotationInVerticalMode(char)).toBe(false);
            });
        }
    });
});
