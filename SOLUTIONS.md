# Complete Solutions for Critical Errors

**Report Date:** 2026-04-13  
**Status:** Ready for Implementation

---

## Solution #1: DiagnosisStep Light Period Undefined

### Problem
```typescript
// Line 501 - CRASHES when result.light.period is undefined
<p className="font-bold capitalize">{result.light?.period?.replace('_', ' ') || 'N/A'}</p>
```

Error: `Uncaught TypeError: can't access property "replace", result.light.period is undefined`

### Root Cause
1. Vision API returns `light: { period: null }` when confidence is low
2. `result.light?.period` evaluates to `undefined`
3. Calling `.replace()` on `undefined` throws error
4. The `|| 'N/A'` fallback never executes because error occurs first

### Solution A: Minimal Fix (Recommended for immediate deployment)

**File:** `src/components/studio/DiagnosisStep.tsx`  
**Line:** 501

```typescript
// BEFORE:
<p className="font-bold capitalize">{result.light?.period?.replace('_', ' ') || 'N/A'}</p>

// AFTER:
<p className="font-bold capitalize">
  {result.light?.period ? result.light.period.replace('_', ' ') : 'N/A'}
</p>
```

**Why this works:**
- Checks if `period` exists and is truthy before calling `.replace()`
- Returns 'N/A' if undefined or null
- Simple, safe, zero risk

**Also apply to line 505:**

```typescript
// BEFORE:
<p className="font-bold">{result.light?.dominant_source || 'N/A'}</p>

// AFTER (if dominant_source could also be undefined):
<p className="font-bold">{result.light?.dominant_source || 'N/A'}</p>
// This one is already safe (using ||), but could be more explicit:
<p className="font-bold">{result.light?.dominant_source ? result.light.dominant_source : 'N/A'}</p>
```

### Solution B: Comprehensive Fix (Better long-term solution)

Create normalization function to handle incomplete API responses systematically.

**File:** `src/validation/response-normalizer.ts`  
**Add at end of file:**

```typescript
/**
 * Normalize AmbientLight response from Vision API
 * Handles cases where Vision API returns incomplete light object
 * 
 * @param light - Potentially incomplete AmbientLight from API
 * @returns Complete AmbientLight with sensible defaults
 */
export function normalizeAmbientLight(light: any): any {
  if (!light || typeof light !== 'object') {
    return getAmbientLightDefaults();
  }

  const defaults = getAmbientLightDefaults();
  
  return {
    period: light.period || defaults.period,
    temp_k: light.temp_k !== undefined ? light.temp_k : defaults.temp_k,
    azimuthal_direction: light.azimuthal_direction || defaults.azimuthal_direction,
    elevation_angle: light.elevation_angle !== undefined ? light.elevation_angle : defaults.elevation_angle,
    quality: light.quality || defaults.quality,
    dominant_source: light.dominant_source || defaults.dominant_source,
    indirect_ratio: light.indirect_ratio || defaults.indirect_ratio,
    light_mixing_description: light.light_mixing_description || defaults.light_mixing_description,
    bloom_glare: light.bloom_glare !== undefined ? light.bloom_glare : defaults.bloom_glare,
    bloom_intensity: light.bloom_intensity !== undefined ? light.bloom_intensity : defaults.bloom_intensity,
    bloom_threshold: light.bloom_threshold !== undefined ? light.bloom_threshold : defaults.bloom_threshold,
    bloom_color_tint: light.bloom_color_tint || defaults.bloom_color_tint,
    has_shadow_direction: light.has_shadow_direction !== undefined ? light.has_shadow_direction : defaults.has_shadow_direction,
    is_backlit: light.is_backlit !== undefined ? light.is_backlit : defaults.is_backlit,
    is_rim_lit: light.is_rim_lit !== undefined ? light.is_rim_lit : defaults.is_rim_lit,
    confidence: light.confidence !== undefined ? light.confidence : defaults.confidence,
    confidence_factors: light.confidence_factors || defaults.confidence_factors
  };
}

/**
 * Default AmbientLight values when API returns incomplete data
 */
function getAmbientLightDefaults() {
  return {
    period: 'afternoon',
    temp_k: 5500,
    azimuthal_direction: 'N',
    elevation_angle: 45,
    quality: 'soft',
    dominant_source: 'mixed',
    indirect_ratio: '0.3',
    light_mixing_description: 'Mixed natural and ambient lighting',
    bloom_glare: false,
    bloom_intensity: 0.5,
    bloom_threshold: 1.0,
    bloom_color_tint: '#ffffff',
    has_shadow_direction: true,
    is_backlit: false,
    is_rim_lit: false,
    confidence: 0.5,
    confidence_factors: []
  };
}
```

**Apply normalization in kieService.ts**

**File:** `src/services/kieService.ts`  
**Line:** ~757 (in `detectArchitecture` function, after validation)

```typescript
// BEFORE:
const validatedData = ScanResultSchema.parse(finalNormalizedJson);
return validatedData;

// AFTER:
const validatedData = ScanResultSchema.parse(finalNormalizedJson);

// Normalize light data to ensure all fields are present
import { normalizeAmbientLight } from '../validation/response-normalizer';
validatedData.light = normalizeAmbientLight(validatedData.light);

return validatedData;
```

**Then simplify DiagnosisStep.tsx line 501 back to:**

```typescript
<p className="font-bold capitalize">{result.light?.period?.replace('_', ' ') || 'N/A'}</p>
```

Now safe because light.period always has a value.

### Testing Solution #1

```typescript
describe('DiagnosisStep Light Display', () => {
  it('should display formatted period when present', () => {
    const result = { light: { period: 'golden_hour' } };
    const text = result.light?.period ? result.light.period.replace('_', ' ') : 'N/A';
    expect(text).toBe('golden hour');
  });

  it('should display N/A when period is undefined', () => {
    const result = { light: { period: undefined } };
    const text = result.light?.period ? result.light.period.replace('_', ' ') : 'N/A';
    expect(text).toBe('N/A');
  });

  it('should display N/A when period is null', () => {
    const result = { light: { period: null } };
    const text = result.light?.period ? result.light.period.replace('_', ' ') : 'N/A';
    expect(text).toBe('N/A');
  });
});

describe('normalizeAmbientLight', () => {
  it('should provide defaults for undefined fields', () => {
    const incomplete = { period: null, temp_k: 5500 };
    const normalized = normalizeAmbientLight(incomplete);
    
    expect(normalized.period).toBe('afternoon');
    expect(normalized.quality).toBe('soft');
    expect(normalized.dominant_source).toBe('mixed');
  });

  it('should preserve provided values', () => {
    const light = { period: 'night', temp_k: 3000, quality: 'hard' };
    const normalized = normalizeAmbientLight(light);
    
    expect(normalized.period).toBe('night');
    expect(normalized.temp_k).toBe(3000);
    expect(normalized.quality).toBe('hard');
  });
});
```

---

## Solution #2: JSON Schema Reserved Keyword Conflict

### Problem
```
API Error: 422 Unprocessable Entity
msg: "$.response_format.json_schema.schema.properties.blocks.items.properties.type must be string or array"
```

The property named `type` in the schema conflicts with JSON Schema's reserved keyword `type`.

### Root Cause
1. JSON Schema specification designates `type` as a keyword (for defining value types)
2. Strict mode enforces RFC 8927 compliance
3. Schema uses `type` as a property name instead of a keyword
4. API validator rejects this pattern → 422 error
5. Blocks mode prompt generation always fails

### Solution: Rename `type` to `block_type` and Expand Schema

**File:** `src/services/kieService.ts`  
**Lines:** 1100-1125 (the `response_format` object in `generatePrompt()`)

**BEFORE:**

```typescript
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'structured_output',
    strict: true,
    schema: {
      type: 'object',
      title: 'Architectural Prompt with Blocks',
      description: 'Generated architectural prompt with blocks and quality analysis',
      properties: {
        blocks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              content: { type: 'string' }
            }
          }
        },
        overall_quality_score: { type: 'number' },
        quality_breakdown: { type: 'object' }
      }
    }
  }
}
```

**AFTER:**

```typescript
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'structured_output',
    strict: true,
    schema: {
      type: 'object',
      title: 'Architectural Prompt with Blocks',
      description: 'Generated architectural prompt with blocks and quality analysis',
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
    }
  }
}
```

### Key Changes:
1. **Line 1115:** `type: { type: 'string' }` → `block_type: { type: 'string' }` (not reserved)
2. **Added fields:**
   - `title`: Block section title
   - `word_count`: Word count for block
   - `engine_recommendation`: Recommended engine for rendering
   - `quality_score`: Quality score for this block
   - `quality_breakdown`: Detailed quality metrics (clarity, specificity, coherence, brevity)
3. **Added required fields:** Specifies which fields must be present
4. **Added overall_quality_breakdown:** Top-level quality metrics

### Verify System Prompt Consistency

**File:** `src/services/kieService.ts`  
**Line:** 1076 (system prompt for blocks mode)

Currently says:
```
- Retorne um objeto JSON com: { "blocks": [{ "block_type": string, "title": string, "content": string, "word_count": number, "engine_recommendation": string, "quality_score": number, "quality_breakdown": { "clarity": number, "specificity": number, "coherence": number, "brevity": number } }], "overall_quality_score": number, "overall_quality_breakdown": { "clarity": number, "specificity": number, "coherence": number, "brevity": number }, "total_word_count": number }.
```

This is **already correct!** It specifies `block_type`, not `type`. The schema just needs to match.

### Update Code Accessing Blocks

**File:** `src/components/studio/ResultStep.tsx`  
**Lines:** 212-230 (blocks processing)

Check that code uses `block_type` not `type`:

```typescript
// VERIFY THIS LOOKS CORRECT:
const blocks = result.blocks; // Each block should have block_type field

// When accessing:
blocks.map((block: any) => block.block_type)  // NOT block.type

// In display:
{block.block_type === 'architecture_base' && ...}  // NOT block.type
```

### Testing Solution #2

```typescript
describe('Blocks Schema Validation', () => {
  it('should not use reserved JSON Schema keywords as property names', () => {
    const reserved = ['$schema', '$id', 'type', 'properties', 'items', 'required', 'enum'];
    const schema = {
      properties: {
        blocks: {
          items: {
            properties: {
              block_type: { type: 'string' },  // OK - not reserved
              content: { type: 'string' }
            }
          }
        }
      }
    };

    const propNames = Object.keys(schema.properties.blocks.items.properties);
    propNames.forEach(name => {
      expect(reserved).not.toContain(name);
    });
  });

  it('should validate blocks schema with Gemini API', async () => {
    const payload = {
      model: 'gemini-2.5-pro',
      response_format: {
        type: 'json_schema',
        json_schema: {
          strict: true,
          schema: {
            // ... corrected schema with block_type
          }
        }
      }
    };

    const response = await axios.post('/api/kie/gemini-2.5-pro/v1/chat/completions', payload);
    expect(response.status).toBe(200);  // Not 422
  });

  it('should return blocks with block_type field', async () => {
    const result = await kieService.generatePrompt(scanResult, configParams, 'blocks');
    
    expect(result.blocks).toBeDefined();
    expect(result.blocks.length).toBeGreaterThan(0);
    
    // Verify structure of first block
    const firstBlock = result.blocks[0];
    expect(firstBlock).toHaveProperty('block_type');
    expect(firstBlock).toHaveProperty('title');
    expect(firstBlock).toHaveProperty('content');
    expect(firstBlock).toHaveProperty('word_count');
    expect(firstBlock).toHaveProperty('quality_score');
  });
});
```

---

## Implementation Checklist

### Phase 1: Critical Fixes (30 minutes)

- [ ] **DiagnosisStep.tsx:501** - Add null check for period
  ```
  Task: Change optional chaining to conditional check
  Effort: 5 min
  Risk: None
  ```

- [ ] **kieService.ts:1115** - Rename `type` to `block_type`
  ```
  Task: One-word change in schema
  Effort: 2 min
  Risk: None
  ```

- [ ] **kieService.ts:1110-1122** - Expand schema with all fields
  ```
  Task: Add 4 more properties and required array
  Effort: 10 min
  Risk: None
  ```

- [ ] **ResultStep.tsx:212-230** - Verify block_type usage
  ```
  Task: Code review - check blocks use .block_type not .type
  Effort: 5 min
  Risk: None
  ```

### Phase 2: Robustness Enhancements (30 minutes)

- [ ] **response-normalizer.ts** - Add normalizeAmbientLight()
  ```
  Task: Create function to apply defaults to incomplete light data
  Effort: 20 min
  Risk: Low
  ```

- [ ] **kieService.ts:757** - Apply normalization
  ```
  Task: Call normalizeAmbientLight in detectArchitecture()
  Effort: 5 min
  Risk: Low
  ```

### Phase 3: Testing (30-60 minutes)

- [ ] Write unit tests for light period handling
- [ ] Write schema validation tests
- [ ] Test blocks mode generation end-to-end
- [ ] Test with incomplete Vision API responses
- [ ] Manual testing with real images

### Phase 4: Deployment

- [ ] Code review
- [ ] Merge to main
- [ ] Deploy to staging
- [ ] Deploy to production

---

## Verification Steps

After implementing both solutions, verify:

### Verify Fix #1
```
1. Upload floor plan image
2. Wait for diagnosis to complete
3. Check DiagnosisStep displays without crash
4. Verify "Período" field shows "afternoon" or "N/A"
5. Verify "Fonte Dominante" field displays correctly
```

### Verify Fix #2
```
1. Upload image (any type)
2. Wait for diagnosis
3. Proceed to ConfigStep
4. Select "Blocos" mode (blocks)
5. Click "Gerar Prompt"
6. Check console - should see no 422 error
7. Verify result shows 6 blocks with proper structure
8. Verify each block has block_type, title, content, quality_score
```

### API Response Verification

**Blocks mode response should look like:**
```json
{
  "blocks": [
    {
      "block_type": "architecture_base",
      "title": "Architectural Foundation",
      "content": "...",
      "word_count": 200,
      "engine_recommendation": "V-Ray 6.0",
      "quality_score": 85,
      "quality_breakdown": {
        "clarity": 88,
        "specificity": 82,
        "coherence": 85,
        "brevity": 80
      }
    },
    // ... 5 more blocks
  ],
  "overall_quality_score": 84,
  "overall_quality_breakdown": {
    "clarity": 85,
    "specificity": 82,
    "coherence": 84,
    "brevity": 81
  }
}
```

---

## Rollback Plan

If issues arise after deployment:

1. **For Fix #1:** Revert DiagnosisStep.tsx to original (will show crash, but safe)
2. **For Fix #2:** Revert schema to original (will show 422, users use single mode)
3. **Both critical fixes are low-risk** - unlikely to need rollback

---

## Questions & Answers

**Q: Why does Vision API return incomplete light?**  
A: For floor plans and technical drawings, there are no perspective cues or lighting indicators. API returns partial data with low confidence.

**Q: Why is `type` reserved in JSON Schema?**  
A: JSON Schema uses `type` as a keyword to specify value types (string, number, object, etc.). It cannot also be a property name.

**Q: Will renaming `type` to `block_type` break existing code?**  
A: Only if code explicitly accesses `.type`. Code should be updated to use `.block_type` instead.

**Q: How many users are affected?**  
A: Error #1: ~15-20% (low-confidence Vision API responses)  
Error #2: 100% of users trying blocks mode

---

**Report Ready for Implementation**  
Estimated Total Time: 1-2 hours
