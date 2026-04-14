# Quick Fix Reference Card

**Generated:** 2026-04-13  
**Priority:** CRITICAL + HIGH  
**Time to Fix:** ~1 hour

---

## FIX #1: Line 501 (5 minutes)

**File:** `src/components/studio/DiagnosisStep.tsx`

```diff
- <p className="font-bold capitalize">{result.light?.period?.replace('_', ' ') || 'N/A'}</p>
+ <p className="font-bold capitalize">{result.light?.period ? result.light.period.replace('_', ' ') : 'N/A'}</p>
```

**Why:** Optional chaining breaks before fallback when period is undefined

---

## FIX #2: Line 1115 (2 minutes)

**File:** `src/services/kieService.ts`

```diff
- type: { type: 'string' },
+ block_type: { type: 'string' },
```

**Why:** `type` is reserved in JSON Schema; causes 422 API error

---

## FIX #3: Lines 1110-1122 (10 minutes)

**File:** `src/services/kieService.ts`

**Replace the entire properties object:**

```typescript
properties: {
  blocks: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        block_type: { type: 'string' },
        title: { type: 'string' },
        content: { type: 'string' },
        word_count: { type: 'number' },
        engine_recommendation: { type: 'string' },
        quality_score: { type: 'number' },
        quality_breakdown: {
          type: 'object',
          properties: {
            clarity: { type: 'number' },
            specificity: { type: 'number' },
            coherence: { type: 'number' },
            brevity: { type: 'number' }
          },
          required: ['clarity', 'specificity', 'coherence', 'brevity']
        }
      },
      required: ['block_type', 'title', 'content', 'word_count', 'quality_score']
    }
  },
  overall_quality_score: { type: 'number' },
  overall_quality_breakdown: {
    type: 'object',
    properties: {
      clarity: { type: 'number' },
      specificity: { type: 'number' },
      coherence: { type: 'number' },
      brevity: { type: 'number' }
    },
    required: ['clarity', 'specificity', 'coherence', 'brevity']
  }
},
required: ['blocks', 'overall_quality_score', 'overall_quality_breakdown']
```

**Why:** Complete schema matching system prompt requirements

---

## FIX #4: Lines 212-230 (2 minutes)

**File:** `src/components/studio/ResultStep.tsx`

**Verify blocks use `.block_type` not `.type`:**

```typescript
// Check for patterns like:
blocks.map(b => b.block_type)  // CORRECT ✓
b.block_type === 'architecture_base'  // CORRECT ✓

// NOT:
blocks.map(b => b.type)  // WRONG ✗
b.type === 'architecture_base'  // WRONG ✗
```

**Why:** Code must access renamed field

---

## FIX #5: Also Fix Line 505 (Optional)

**File:** `src/components/studio/DiagnosisStep.tsx`

```diff
- <p className="font-bold">{result.light?.dominant_source || 'N/A'}</p>
+ <p className="font-bold">{result.light?.dominant_source ? result.light.dominant_source : 'N/A'}</p>
```

**Why:** Prevent similar crashes with other undefined light fields

---

## Test After Fixes

```bash
# 1. Upload floor plan → Diagnosis displays without crash
# 2. Select blocks mode → Generate prompt without 422 error
# 3. Verify blocks have block_type field
# 4. Check result structure matches expected schema
```

---

## Files Modified Summary

| File | Changes | Time |
|------|---------|------|
| DiagnosisStep.tsx | 1 line (+ optional 1) | 5 min |
| kieService.ts | 1 word + schema expansion | 15 min |
| ResultStep.tsx | Verify blocks access | 5 min |
| **Total** | **~4 changes** | **~25 min** |

---

## Verification Commands

```bash
# Check if line 501 is fixed (should show conditional check):
grep -n "result.light?.period ?" src/components/studio/DiagnosisStep.tsx

# Check if line 1115 is fixed (should show block_type):
grep -n "block_type.*type.*string" src/services/kieService.ts

# Check schema has all required fields:
grep -n "engine_recommendation\|quality_breakdown" src/services/kieService.ts
```

---

## If Something Goes Wrong

```bash
# Revert DiagnosisStep to original (safe):
git checkout src/components/studio/DiagnosisStep.tsx

# Revert kieService to original (safe):
git checkout src/services/kieService.ts

# Users can use single mode while blocks mode is broken
```

---

## Success Criteria

- [ ] No TypeError in DiagnosisStep
- [ ] No 422 API errors in blocks mode
- [ ] Blocks response has block_type field
- [ ] Diagnosis displays even with incomplete light data
- [ ] Both modes work: single AND blocks

---

**Ready to Deploy**  
Est. Time: 1 hour total (fixes + testing)
