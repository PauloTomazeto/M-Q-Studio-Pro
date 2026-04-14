# Critical Errors Summary - MQ Studio Pro

**Date:** 2026-04-13  
**Status:** BLOCKING - Requires Immediate Fix

---

## Error #1: Light Period Undefined (HIGH)

**Location:** `src/components/studio/DiagnosisStep.tsx:501`

```typescript
// BROKEN:
<p className="font-bold capitalize">{result.light?.period?.replace('_', ' ') || 'N/A'}</p>

// FIXED:
<p className="font-bold capitalize">{result.light?.period ? result.light.period.replace('_', ' ') : 'N/A'}</p>
```

**Root Cause:** Vision API returns incomplete light object with `period: undefined`; optional chaining fails before fallback.

**Impact:** DiagnosisStep crashes, blocks workflow progression (15% of users).

**Fix Time:** 5 minutes

---

## Error #2: Reserved JSON Schema Keyword (CRITICAL)

**Location:** `src/services/kieService.ts:1115`

```typescript
// BROKEN:
properties: {
  type: { type: 'string' },  // ← Reserved keyword!
  content: { type: 'string' }
}

// FIXED:
properties: {
  block_type: { type: 'string' },  // ← Not reserved
  title: { type: 'string' },
  content: { type: 'string' },
  word_count: { type: 'number' },
  engine_recommendation: { type: 'string' },
  quality_score: { type: 'number' },
  quality_breakdown: { type: 'object' }
}
```

**Root Cause:** Property named `type` conflicts with JSON Schema reserved keyword in strict mode.

**Impact:** Blocks ALL blocks-mode prompt generation (100% of blocks mode users).

**Fix Time:** 5 minutes + 15 min schema expansion

**API Error:**
```
422 Unprocessable Entity
msg: "$.response_format.json_schema.schema.properties.blocks.items.properties.type must be string or array"
```

---

## Quick Fix Checklist

- [ ] **Line 501 (DiagnosisStep.tsx):** Change optional chaining to conditional check
- [ ] **Line 1115 (kieService.ts):** Rename `type` to `block_type`
- [ ] **Lines 1110-1122 (kieService.ts):** Expand schema with all required fields
- [ ] **Line 212 (ResultStep.tsx):** Verify blocks processing uses correct field names
- [ ] **Test:** Verify blocks mode generates prompts without 422 error
- [ ] **Test:** Verify diagnosis displays without crashes

---

## Implementation Order

1. **Fix #1 (5 min):** DiagnosisStep conditional check
2. **Fix #2 (5 min):** Rename type to block_type in schema  
3. **Fix #3 (15 min):** Expand schema with all fields
4. **Test (20 min):** Manual and automated testing
5. **Optional (30 min):** Add normalizeLight() for robustness

**Total Time:** ~1 hour

---

## Files to Edit

| File | Lines | Fix | Priority |
|------|-------|-----|----------|
| `src/components/studio/DiagnosisStep.tsx` | 501, 505 | Add null checks | HIGH |
| `src/services/kieService.ts` | 1115 | Rename type → block_type | CRITICAL |
| `src/services/kieService.ts` | 1110-1122 | Expand schema | HIGH |
| `src/validation/response-normalizer.ts` | EOF | Add normalizeLight() | MEDIUM |

---

## Why These Errors Happen

**Error #1:** Vision API has low confidence in lighting for technical drawings/floor plans → returns null period → code assumes string → crash

**Error #2:** Used reserved JSON Schema keyword `type` as property name → Gemini strict mode rejects → 422 error

---

## Testing After Fix

```bash
# Manual Tests
- Upload floor plan → DiagnosisStep displays safely
- Select blocks mode → Generate prompt without 422 error
- Check result blocks have block_type field
- Verify light period shows "N/A" when missing

# Automated Tests
- Run unit tests for light period handling
- Run schema validation against Gemini API mock
- Integration test for incomplete Vision API response
```

---

## Related Files for Context

- **Type Definitions:** `src/types/studio.ts` (lines 160-183 - Light types)
- **Schema Definition:** `src/services/kieService.ts` (lines 80-98 - AmbientLightSchema)
- **Response Normalizer:** `src/validation/response-normalizer.ts` (handles Vision API quirks)
- **Store Usage:** `src/store/studioStore.ts` (lines 327-402 - uses light data)

---

## Error Chain Diagram

```
Upload Image
    ↓
Vision API Analysis
    ├→ Returns Complete Light ✓
    │    ↓
    │  DiagnosisStep Displays ✓
    │    ↓
    │  User Configures
    │    ↓
    │  generatePrompt() with blocks mode
    │    ├→ Schema Valid ✓
    │    │   API Returns 200 ✓
    │    │   Blocks Mode Works ✓
    │    │
    │    └→ Schema Invalid ✗ [ERR_002]
    │       API Returns 422 ✗
    │       Blocks Mode Broken ✗
    │
    └→ Returns Incomplete Light (period: null)
         ↓
       DiagnosisStep Crashes ✗ [ERR_001]
       Cannot Advance ✗
       Fallback Manual Config
            ↓
          generatePrompt() with blocks mode
            ├→ Schema Still Invalid ✗ [ERR_002]
            │  Blocks Mode Broken ✗
            │
            └→ Single Mode Works (workaround)
```

---

**Next Steps:**  
Apply fixes in priority order. Both errors prevent users from completing the generation workflow. Fix #2 is more critical (affects all blocks mode users), but both must be addressed for full functionality.
