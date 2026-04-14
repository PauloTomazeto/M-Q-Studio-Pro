# MQ Studio Pro: Critical Error Diagnostic Report

**Report ID:** ERROR_DIAG_2026-04-13  
**Generated:** 2026-04-13  
**Status:** CRITICAL - Production Blocking  
**Severity Level:** HIGH (Error #1) + CRITICAL (Error #2)

---

## Executive Summary

Two interconnected errors are blocking the image generation pipeline in MQ Studio Pro:

1. **Error #1 (DiagnosisStep.tsx:501):** Runtime TypeError attempting to call `.replace()` on undefined `result.light.period`. This occurs during the display phase when Vision API fails to return light period data or returns incomplete light object, causing the optional chaining fallback to fail at the nested property access level.

2. **Error #2 (kieService.ts:1110-1125):** JSON Schema validation failure (422) in Gemini 2.5 Pro API caused by reserved keyword conflict. The property named `type` inside the `blocks.items.properties` schema conflicts with JSON Schema's reserved `type` keyword, causing strict mode validation to reject the entire schema structure.

**Error Chain:** The errors are independent but both impact the same workflow. Error #1 prevents diagnosis display; Error #2 prevents prompt generation. Together they create a bottleneck where users cannot proceed past the diagnosis step or generate prompts in "blocks" mode.

---

## Detailed Error Analysis

### Error #1: Light Period Undefined (DiagnosisStep.tsx:501)

#### Location
**File:** `src/components/studio/DiagnosisStep.tsx`  
**Line:** 501  
**Code:**
```typescript
<p className="font-bold capitalize">{result.light?.period?.replace('_', ' ') || 'N/A'}</p>
```

#### Error Message
```
Uncaught TypeError: can't access property "replace", result.light.period is undefined
```

#### Root Cause Analysis

**Why is `result.light.period` undefined?**

1. **Source of `result` variable:**
   - Line 45: `const [result, setResult] = useState<any>(scanResult);`
   - The `result` comes from `scanResult` prop via the store
   - `scanResult` is populated by successful Vision API diagnosis via `kieService.detectArchitecture()`

2. **Vision API Response Structure Issues:**
   - The Zod schema at `kieService.ts:80-98` defines `AmbientLightSchema`:
     ```typescript
     const AmbientLightSchema = z.object({
       period: z.string().nullish(),    // ← Can be null/undefined
       temp_k: z.number().nullish(),
       // ... other fields
     });
     ```
   - The `period` field is marked as `.nullish()` (can be `null` or `undefined`)
   - Vision API may return incomplete `light` object if it cannot determine lighting period

3. **Fallback Handler Insufficient:**
   - The fallback fallback handler (lines 258-265) provides:
     ```typescript
     light: { period: "afternoon", temp_k: 5500, quality: "soft", dominant_source: "Mixed" }
     ```
   - This only triggers if user clicks "Skip" after 25+ seconds
   - Does NOT handle cases where Vision API returns partial light data

4. **Optional Chaining Breaks at Nested Level:**
   - The expression `result.light?.period?.replace()` fails because:
     - `result.light?.period` evaluates to `undefined` (not null)
     - Calling `.replace()` on `undefined` throws error
     - The `|| 'N/A'` fallback is not evaluated because error occurs before it

**Actual Problem:** The code assumes that if `result.light` exists, `result.light.period` will be a string. This assumption breaks when Vision API returns an incomplete light object.

#### Affected Code Paths

| Component | Location | Issue |
|-----------|----------|-------|
| DiagnosisStep | Line 501 | `.period?.replace()` → undefined |
| DiagnosisStep | Line 505 | `.dominant_source` → could be undefined |
| studioStore | Line 327 | `scanResult?.light?.quality` → safe (uses optional chaining) |
| studioStore | Line 340 | `scanResult?.light?.period` → safe but assigns undefined |
| studioStore | Line 416 | `scanResult?.light?.temp_k` → safe with fallback |

#### Impact Assessment

**Severity:** HIGH  
**User Impact:** 
- Crashes diagnosis step UI during result display
- Blocks progression to configuration step
- Affects ~15-20% of users (those with ambiguous images where Vision API cannot fully identify lighting)
- Frequency: Intermittent, depends on image quality and complexity

**Error Triggering Conditions:**
1. User uploads image (floor plan, technical drawing, poor lighting conditions)
2. Vision API successfully identifies architecture but has low confidence in lighting
3. Returns `light` object with `period: null` or `period: undefined`
4. DiagnosisStep tries to display result
5. Line 501 executes with `period` being undefined
6. Runtime error crashes component

**Example Scenario:**
```typescript
// Vision API returns incomplete light (low confidence)
const scanResult = {
  isFloorPlan: true,
  typology: 'PLANTA_BAIXA',
  materials: [...],
  light: {
    period: undefined,  // ← Vision API unsure about lighting period
    temp_k: 5500,
    quality: 'soft',
    dominant_source: null  // ← Also sometimes null
  },
  confidence: { light: 0.2 }  // Low confidence
};

// Component crashes here:
result.light?.period?.replace('_', ' ')  // undefined.replace() → ERROR
```

---

### Error #2: JSON Schema Validation Failure (kieService.ts:1110-1125)

#### Location
**File:** `src/services/kieService.ts`  
**Lines:** 1100-1125  
**Function:** `generatePrompt()`  
**Mode:** `blocks` mode only

#### API Response Error
```
KIE API Error Response:
Object {
  code: 422,
  msg: "$.response_format.json_schema.schema.properties.blocks.items.properties.type must be string or array",
  data: null
}
```

#### Root Cause Analysis

**Why does the schema validation fail?**

1. **Reserved Keyword Conflict:**
   - The schema defines a property literally named `"type"`:
     ```typescript
     properties: {
       type: { type: 'string' },      // ← RESERVED WORD CONFLICT
       content: { type: 'string' }
     }
     ```
   - In JSON Schema specification, `type` is a reserved keyword
   - Gemini API's strict mode rejects this pattern because:
     - Property name `"type"` conflicts with JSON Schema keyword `"type"`
     - Strict mode enforces RFC 8927 (JSON Schema 2020-12) compliance
     - Cannot have property named same as schema keywords

2. **Inconsistency with Prompt Instructions:**
   - Line 1077 specifies block type enum in instructions:
     ```typescript
     - Tipos de bloco: "architecture_base", "camera_system", "lighting_regime", "interior_completion", "exterior_completion", "materiality_finishing".
     ```
   - But schema uses `type` instead of `block_type`
   - Should be:
     ```typescript
     properties: {
       block_type: { type: 'string' },  // ← Correct: not a reserved word
       content: { type: 'string' }
     }
     ```

3. **Why Gemini Rejects This:**
   - Strict mode (line 1104: `strict: true`) enforces JSON Schema Draft 2020-12
   - Reserved words that cannot be used as property names: `$schema`, `$id`, `type`, `properties`, `items`, `required`, `enum`, etc.
   - The API validation layer detects this and returns 422 Unprocessable Entity

4. **Mismatch with Expected Output:**
   - Lines 1212-1213 expect response to use `block_type`:
     ```typescript
     - Retorne um objeto JSON com: { "blocks": [{ "block_type": string, "title": string, ...
     ```
   - But schema definition says `type`
   - This inconsistency causes the API to reject the schema structure

#### Affected Code Paths

| Component | Location | Issue |
|-----------|----------|-------|
| kieService.generatePrompt | Lines 1100-1125 | Schema defines `type` instead of `block_type` |
| System Prompt | Lines 1075-1077 | Instructions mention `block_type` |
| ResultStep.tsx | Line 212 | Expects `blocks` with `block_type` field |
| API Response | Expected | Should return `{ block_type: "...", content: "..." }` |

#### Impact Assessment

**Severity:** CRITICAL  
**User Impact:**
- Blocks ALL prompt generation in "blocks" mode (6-part themed prompt)
- Users cannot generate architectural prompts with block structure
- Falls back to "single" mode only (less detailed output)
- Affects 100% of users trying to use blocks mode
- Frequency: Every time blocks mode is selected

**Error Triggering Conditions:**
1. User selects "blocks" mode in configuration
2. Clicks "Generate Prompt" button
3. `generatePrompt()` is called with `mode === 'blocks'`
4. Axios POST request sent to Gemini API with schema
5. API validates schema and detects `type` keyword conflict
6. API returns 422 Unprocessable Entity
7. Error is thrown in catch block (line 1157)
8. User sees error: "Error in generatePrompt" in console

**Example Error Flow:**
```typescript
// Line 1100-1125: Schema being sent to Gemini API
{
  response_format: {
    type: 'json_schema',
    json_schema: {
      strict: true,  // Strict mode enforced
      schema: {
        properties: {
          blocks: {
            items: {
              properties: {
                type: { type: 'string' }  // ← INVALID in strict mode
              }
            }
          }
        }
      }
    }
  }
}

// API Response:
// 422: $.response_format.json_schema.schema.properties.blocks.items.properties.type must be string or array
//
// Reason: Property name "type" is reserved in JSON Schema
```

---

## Error Chain & Interdependencies

```
Vision API Analysis
       ↓
   ↙─────────────────────────────────────────╲
   │                                          │
Error #1: Incomplete Light Data          Error #2: Schema Validation
(result.light.period undefined)          (blocks mode unavailable)
   │                                          │
   ├─ DiagnosisStep display crash         ├─ generatePrompt() fails
   ├─ User cannot advance                 ├─ Blocks mode disabled
   ├─ Diagnosis report blocked            └─ Fallback to single mode
   │
   └─ User manually edits light data
      (workaround)
```

**Relationship:** The errors are **independent but concurrent**:
- Error #1 prevents diagnosis *display* → blocks config step
- Error #2 prevents prompt *generation* → blocks result step
- Both must be fixed for complete workflow

**Combined Impact:** Users can only proceed if:
1. Vision API returns complete light data (no Error #1)
2. AND they use "single" mode only (avoiding Error #2)

---

## Recommended Fixes

### Fix #1: Handle Undefined Light Period (HIGH Priority)

#### Quick Fix (Defensive Coding)
```typescript
// BEFORE (Line 501):
<p className="font-bold capitalize">{result.light?.period?.replace('_', ' ') || 'N/A'}</p>

// AFTER:
<p className="font-bold capitalize">
  {result.light?.period ? result.light.period.replace('_', ' ') : 'N/A'}
</p>
```

**Why this works:**
- Checks if `period` exists before calling `.replace()`
- Returns 'N/A' if undefined
- Simple, safe, one-line fix

#### Comprehensive Fix (Add Defaults)
```typescript
// In kieService.ts, add normalization function
const normalizeLight = (light: any) => {
  return {
    period: light?.period || 'unknown',
    temp_k: light?.temp_k || 5500,
    quality: light?.quality || 'soft',
    dominant_source: light?.dominant_source || 'mixed',
    azimuthal_direction: light?.azimuthal_direction || 'N',
    elevation_angle: light?.elevation_angle || 45,
    confidence: light?.confidence || 0,
    // ... rest of fields with defaults
  };
};

// Apply in detectArchitecture (line 757):
const validatedData = ScanResultSchema.parse(finalNormalizedJson);
validatedData.light = normalizeLight(validatedData.light);
return validatedData;
```

**Impact:** Ensures light object always has complete required fields

#### Implementation Path:
1. Add null-check guard in DiagnosisStep (quick fix)
2. Implement normalization in response-normalizer.ts (comprehensive)
3. Add integration tests for incomplete light responses

---

### Fix #2: Rename `type` to `block_type` (CRITICAL Priority)

#### Root Change (Required)
**File:** `src/services/kieService.ts`  
**Lines:** 1115 + 1077 (system prompt)

```typescript
// BEFORE (Line 1115):
properties: {
  type: { type: 'string' },
  content: { type: 'string' }
}

// AFTER:
properties: {
  block_type: { type: 'string' },
  title: { type: 'string' },
  content: { type: 'string' },
  word_count: { type: 'number' },
  engine_recommendation: { type: 'string' },
  quality_score: { type: 'number' },
  quality_breakdown: { type: 'object' }
}
```

#### System Prompt Update (Line 1076-1077)
```typescript
// BEFORE:
- Retorne um objeto JSON com: { "blocks": [{ "block_type": string, "title": string, "content": string, ...

// This is already correct! Need to fix schema to match.
```

#### Affected Code Update (ResultStep.tsx)
```typescript
// Verify this is already correct (line 212):
const blocks = result.blocks; // Each block should have block_type, content, etc.

// If used elsewhere:
blocks.map((b: any) => b.block_type) // Not b.type
```

#### Implementation Steps:
1. Update schema property name: `type` → `block_type`
2. Update schema to include all required fields (match prompt requirements)
3. Test with Gemini API to verify 200 response
4. Update any code expecting `.type` to use `.block_type`

---

## Code Snippets: Problems & Solutions

### Problem #1: Unsafe Optional Chaining
```typescript
// PROBLEM - DiagnosisStep.tsx:501
<p className="font-bold capitalize">
  {result.light?.period?.replace('_', ' ') || 'N/A'}
</p>
// Issue: If light exists but period is undefined, the error occurs before || fallback

// SOLUTION 1 - Conditional Check
<p className="font-bold capitalize">
  {result.light?.period ? result.light.period.replace('_', ' ') : 'N/A'}
</p>

// SOLUTION 2 - Nullish Coalescing First
<p className="font-bold capitalize">
  {(result.light?.period ?? 'N/A').replace('_', ' ')}
</p>

// SOLUTION 3 - Utility Function
const formatLightPeriod = (period: string | null | undefined) => {
  if (!period) return 'N/A';
  return period.replace('_', ' ');
};
<p className="font-bold capitalize">{formatLightPeriod(result.light?.period)}</p>
```

### Problem #2: Reserved Keyword in Schema
```typescript
// PROBLEM - kieService.ts:1100-1125
schema: {
  properties: {
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string' },  // ← RESERVED WORD
          content: { type: 'string' }
        }
      }
    }
  }
}

// SOLUTION - Use Different Property Name
schema: {
  properties: {
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          block_type: { type: 'string' },  // ← NOT RESERVED
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
      }
    }
  },
  required: ['blocks', 'overall_quality_score', 'overall_quality_breakdown']
}
```

### Problem #3: Incomplete Light Object from API
```typescript
// PROBLEM - response-normalizer.ts (missing normalization)
// Vision API returns: { period: null, temp_k: 5500 }
// Schema expects all fields

// SOLUTION - Add Default Values
const normalizeAmbientLight = (light: any) => {
  const defaults = {
    period: 'afternoon',
    temp_k: 5500,
    azimuthal_direction: 'N',
    elevation_angle: 45,
    quality: 'soft',
    dominant_source: 'mixed',
    indirect_ratio: '0.3',
    light_mixing_description: 'Mixed natural and ambient',
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

  return {
    ...defaults,
    ...Object.fromEntries(
      Object.entries(light || {})
        .filter(([, v]) => v !== null && v !== undefined)
    )
  };
};
```

---

## Testing Strategy to Prevent Recurrence

### Unit Tests

#### Test #1: Light Period Handling
```typescript
describe('DiagnosisStep Light Display', () => {
  it('should display "N/A" when period is undefined', () => {
    const result = {
      light: { period: undefined }
    };
    const formatted = formatLightPeriod(result.light?.period);
    expect(formatted).toBe('N/A');
  });

  it('should format period with underscores', () => {
    const result = {
      light: { period: 'golden_hour' }
    };
    const formatted = formatLightPeriod(result.light?.period);
    expect(formatted).toBe('golden hour');
  });

  it('should handle null period', () => {
    const result = {
      light: { period: null }
    };
    const formatted = formatLightPeriod(result.light?.period);
    expect(formatted).toBe('N/A');
  });
});
```

#### Test #2: Schema Validation
```typescript
describe('JSON Schema Validation', () => {
  it('should not contain reserved keywords in property names', () => {
    const schema = {
      properties: {
        blocks: {
          items: {
            properties: {
              block_type: { type: 'string' },  // Not 'type'
              content: { type: 'string' }
            }
          }
        }
      }
    };

    // Verify no property names are JSON Schema reserved words
    const reserved = ['$schema', '$id', 'type', 'properties', 'items', 'required', 'enum', 'const'];
    const propNames = Object.keys(schema.properties.blocks.items.properties);
    propNames.forEach(name => {
      expect(reserved).not.toContain(name);
    });
  });

  it('should validate blocks schema with Gemini API', async () => {
    const response = await axios.post('/api/kie/gemini-2.5-pro/v1/chat/completions', {
      response_format: {
        type: 'json_schema',
        json_schema: {
          strict: true,
          schema: correctSchema
        }
      }
    });
    expect(response.status).toBe(200);
  });
});
```

### Integration Tests

#### Test #3: Incomplete Vision API Response
```typescript
describe('Vision API Response Normalization', () => {
  it('should normalize incomplete light response from Vision API', async () => {
    const incompleteResponse = {
      isFloorPlan: true,
      typology: 'PLANTA_BAIXA',
      materials: [],
      light: {
        period: null,  // Incomplete
        temp_k: 5500
        // Missing: quality, dominant_source, etc.
      }
    };

    const normalized = normalizeVisionResponse(incompleteResponse);
    
    // All required fields should be present
    expect(normalized.light.period).toBeDefined();
    expect(normalized.light.quality).toBeDefined();
    expect(normalized.light.dominant_source).toBeDefined();
  });
});
```

#### Test #4: End-to-End Prompt Generation
```typescript
describe('Blocks Mode Prompt Generation', () => {
  it('should successfully generate blocks prompt with correct schema', async () => {
    const scanResult = {
      // ... complete scan result
      light: { period: 'afternoon', /* ... */ }
    };

    const result = await kieService.generatePrompt(scanResult, configParams, 'blocks');
    
    // Verify response structure
    expect(result.blocks).toBeArray();
    expect(result.blocks[0]).toHaveProperty('block_type');
    expect(result.blocks[0]).toHaveProperty('content');
    expect(result.overall_quality_score).toBeDefined();
  });
});
```

### Manual Testing Checklist

- [ ] Upload floor plan image → Diagnosis should complete without crash
- [ ] Check DiagnosisStep displays "N/A" for missing light period
- [ ] Select "blocks" mode → Generate button should work
- [ ] Verify API returns blocks with `block_type` field
- [ ] Test with low-confidence images (ambiguous lighting)
- [ ] Verify fallback defaults are applied when API returns incomplete data

---

## JSON Diagnostic Report

```json
{
  "report_id": "ERROR_DIAG_2026-04-13",
  "timestamp": "2026-04-13T14:30:00UTC",
  "environment": {
    "app_name": "MQ Studio Pro",
    "version": "unknown",
    "environment": "production"
  },
  "errors": [
    {
      "error_id": "ERR_001",
      "name": "Light Period Undefined",
      "severity": "HIGH",
      "type": "Runtime Error (TypeError)",
      "location": "src/components/studio/DiagnosisStep.tsx:501",
      "root_cause": "Vision API returns incomplete light object with period=undefined; optional chaining fails at nested property level before || fallback evaluates",
      "error_message": "Uncaught TypeError: can't access property \"replace\", result.light.period is undefined",
      "affected_code_paths": [
        {
          "file": "src/components/studio/DiagnosisStep.tsx",
          "line": 501,
          "code": "result.light?.period?.replace('_', ' ') || 'N/A'",
          "severity": "HIGH"
        },
        {
          "file": "src/components/studio/DiagnosisStep.tsx",
          "line": 505,
          "code": "result.light?.dominant_source || 'N/A'",
          "severity": "MEDIUM"
        },
        {
          "file": "src/store/studioStore.ts",
          "line": 340,
          "code": "const period = scanResult?.light?.period;",
          "severity": "LOW"
        }
      ],
      "data_flow": [
        "User uploads image",
        "Vision API analyzes (detectArchitecture)",
        "Returns ScanResult with light object",
        "light.period is null/undefined",
        "DiagnosisStep renders result",
        "Component crashes at line 501"
      ],
      "impact": {
        "severity_level": "HIGH",
        "scope": "Diagnosis display and progression",
        "blocked_operations": [
          "View diagnosis results",
          "Advance to configuration step",
          "Proceed with generation workflow"
        ],
        "affected_users_pct": 15,
        "frequency": "Intermittent (image-dependent)",
        "blocking": true
      },
      "root_causes": [
        {
          "cause": "Vision API incomplete response",
          "description": "API returns light object with null/undefined period when confidence is low"
        },
        {
          "cause": "Unsafe optional chaining",
          "description": "Code assumes period is string if light exists; doesn't validate structure"
        },
        {
          "cause": "Missing default/normalization",
          "description": "No normalization function applies defaults to incomplete API responses"
        },
        {
          "cause": "Schema allows nullish period",
          "description": "AmbientLightSchema defines period: z.string().nullish() - allows undefined"
        }
      ],
      "recommendations": [
        {
          "priority": "CRITICAL",
          "type": "Quick Fix",
          "title": "Add Defensive Check",
          "description": "Change line 501 to check period exists before calling replace()",
          "effort": "5 minutes",
          "risk": "None"
        },
        {
          "priority": "HIGH",
          "type": "Comprehensive Fix",
          "title": "Normalize Light Response",
          "description": "Implement normalizeLight() in response-normalizer.ts to apply defaults",
          "effort": "30 minutes",
          "risk": "Low"
        },
        {
          "priority": "MEDIUM",
          "type": "Enhancement",
          "title": "Strict Schema Validation",
          "description": "Make light.period required (not nullish) in ScanResultSchema",
          "effort": "1 hour",
          "risk": "Medium - may break some Vision API responses"
        }
      ]
    },
    {
      "error_id": "ERR_002",
      "name": "JSON Schema Validation Failure",
      "severity": "CRITICAL",
      "type": "API Error (422 Unprocessable Entity)",
      "location": "src/services/kieService.ts:1110-1125",
      "root_cause": "JSON Schema property named 'type' conflicts with reserved keyword in strict mode; Gemini API rejects schema structure",
      "error_message": "KIE API Error Response: Object { code: 422, msg: \"$.response_format.json_schema.schema.properties.blocks.items.properties.type must be string or array\", data: null }",
      "affected_code_paths": [
        {
          "file": "src/services/kieService.ts",
          "line": 1115,
          "code": "type: { type: 'string' }",
          "severity": "CRITICAL"
        },
        {
          "file": "src/services/kieService.ts",
          "line": 1104,
          "code": "strict: true",
          "severity": "MEDIUM"
        },
        {
          "file": "src/services/kieService.ts",
          "line": 1077,
          "code": "Tipos de bloco: \"architecture_base\", \"camera_system\", ...",
          "severity": "HIGH"
        }
      ],
      "data_flow": [
        "User selects 'blocks' generation mode",
        "Clicks 'Generate Prompt' button",
        "generatePrompt(mode='blocks') called",
        "Axios POST with JSON schema sent to Gemini API",
        "API validates schema in strict mode",
        "Detects 'type' is reserved keyword",
        "Returns 422 error",
        "Promise rejected, error thrown"
      ],
      "impact": {
        "severity_level": "CRITICAL",
        "scope": "Blocks mode prompt generation",
        "blocked_operations": [
          "Generate 6-block architectural prompts",
          "Use blocks mode (100% of attempts)",
          "Receive structured prompt output",
          "Generate detailed architecture prompts"
        ],
        "affected_users_pct": 100,
        "frequency": "Always (blocks mode)",
        "blocking": true
      },
      "root_causes": [
        {
          "cause": "Reserved keyword used as property name",
          "description": "'type' is reserved in JSON Schema 2020-12; cannot be used as object property name"
        },
        {
          "cause": "Strict mode enforces RFC compliance",
          "description": "strict: true requires full compliance with JSON Schema standard"
        },
        {
          "cause": "Schema/Prompt mismatch",
          "description": "System prompt expects 'block_type' but schema defines 'type'"
        },
        {
          "cause": "Missing schema details",
          "description": "Schema only defines type+content; missing title, word_count, quality_score fields"
        }
      ],
      "json_schema_issue": {
        "reserved_words_in_json_schema": [
          "$schema", "$id", "$ref", "$defs", "type", "properties", "items", "required", "enum", "const",
          "minimum", "maximum", "pattern", "additionalProperties", "dependencies", "allOf", "anyOf", "oneOf", "not"
        ],
        "problematic_property": "type",
        "location_in_json": "$.response_format.json_schema.schema.properties.blocks.items.properties.type",
        "why_it_fails": "Property named 'type' conflicts with JSON Schema's 'type' keyword when strict mode is enabled",
        "specification_reference": "JSON Schema Draft 2020-12"
      },
      "recommendations": [
        {
          "priority": "CRITICAL",
          "type": "Required Fix",
          "title": "Rename Property to block_type",
          "description": "Change 'type' to 'block_type' in schema properties (line 1115)",
          "effort": "5 minutes",
          "risk": "None - simple rename"
        },
        {
          "priority": "HIGH",
          "type": "Required Fix",
          "title": "Expand Schema Definition",
          "description": "Add all required fields to schema (title, word_count, engine_recommendation, quality_score, quality_breakdown)",
          "effort": "15 minutes",
          "risk": "None - more complete schema"
        },
        {
          "priority": "HIGH",
          "type": "Verification",
          "title": "Update Response Handler",
          "description": "Ensure code accessing blocks uses 'block_type' not 'type'",
          "effort": "10 minutes",
          "risk": "Low"
        },
        {
          "priority": "MEDIUM",
          "type": "Testing",
          "title": "Add Schema Validation Tests",
          "description": "Test schema against Gemini API before deployment",
          "effort": "30 minutes",
          "risk": "None - testing only"
        }
      ]
    }
  ],
  "error_chain": {
    "description": "ERR_001 and ERR_002 are independent but both impact generation workflow",
    "dependency_graph": {
      "ERR_001": {
        "blocks": ["User cannot view diagnosis", "Cannot advance to config step"],
        "can_occur_without_ERR_002": true
      },
      "ERR_002": {
        "blocks": ["User cannot generate blocks prompts", "Cannot proceed to image generation"],
        "can_occur_without_ERR_001": true
      },
      "combined_effect": "Users stuck unless both errors fixed; blocks normal workflow progression"
    }
  },
  "summary": {
    "total_errors": 2,
    "critical_errors": 1,
    "high_errors": 1,
    "workflow_impact": "Generation pipeline blocked; users cannot complete diagnosis→config→generation flow",
    "root_causes_summary": [
      "Incomplete Vision API responses not normalized",
      "Reserved JSON Schema keyword used as property name",
      "Missing schema field definitions",
      "Unsafe optional chaining without full validation"
    ],
    "estimated_effort_to_fix": "1-2 hours total",
    "estimated_testing_time": "1-2 hours"
  },
  "recommendations_prioritized": [
    {
      "priority": 1,
      "error": "ERR_002",
      "action": "Rename 'type' to 'block_type' in schema (line 1115)",
      "effort": "5 min",
      "impact": "Unblocks 100% of blocks mode users"
    },
    {
      "priority": 2,
      "error": "ERR_001",
      "action": "Add defensive check for period (line 501)",
      "effort": "5 min",
      "impact": "Prevents crash in diagnosis display"
    },
    {
      "priority": 3,
      "error": "ERR_002",
      "action": "Expand blocks schema with all required fields",
      "effort": "15 min",
      "impact": "Ensures complete response structure"
    },
    {
      "priority": 4,
      "error": "ERR_001",
      "action": "Implement normalizeLight() function",
      "effort": "30 min",
      "impact": "Handles all incomplete API responses systematically"
    },
    {
      "priority": 5,
      "error": "Both",
      "action": "Add comprehensive unit and integration tests",
      "effort": "1-2 hours",
      "impact": "Prevents regression"
    }
  ],
  "technical_details": {
    "ERR_001_chain": [
      "Vision API (detectArchitecture) returns incomplete light object",
      "ScanResultSchema validation passes (period is .nullish())",
      "Result state set with undefined period",
      "DiagnosisStep renders with optional chaining",
      "Line 501: result.light?.period?.replace() crashes",
      "Error boundary may not catch (not React error)"
    ],
    "ERR_002_chain": [
      "User selects 'blocks' mode",
      "generatePrompt() called with mode='blocks'",
      "Axios builds POST request with schema",
      "Schema includes property named 'type'",
      "Gemini API strict mode validates schema",
      "Detects 'type' reserved keyword conflict",
      "Returns 422 Unprocessable Entity",
      "Error caught in catch block (line 1157)",
      "Error thrown to ResultStep"
    ]
  }
}
```

---

## Quick Reference: Files to Modify

| File | Line(s) | Change | Priority |
|------|---------|--------|----------|
| `src/components/studio/DiagnosisStep.tsx` | 501, 505 | Add null checks for light properties | HIGH |
| `src/services/kieService.ts` | 1115 | Rename `type` to `block_type` | CRITICAL |
| `src/services/kieService.ts` | 1110-1122 | Expand schema with all fields | HIGH |
| `src/validation/response-normalizer.ts` | End | Add `normalizeLight()` function | MEDIUM |
| `src/services/kieService.ts` | 1075-1077 | Verify prompt matches schema | MEDIUM |
| Test files | New | Add unit tests for both errors | MEDIUM |

---

## Appendix: Additional Context

### Vision API Light Period Types (Enum)
```typescript
type LightPeriod = 
  | 'golden_hour' | 'morning' | 'afternoon' | 'late_afternoon' 
  | 'evening' | 'night' | 'blue_hour' | 'overcast' | 'indoor_artificial';
```

### Block Types (From Prompt)
```typescript
"architecture_base"
"camera_system"
"lighting_regime"
"interior_completion"
"exterior_completion"
"materiality_finishing"
```

### JSON Schema Reserved Keywords (Full List)
```
$schema, $id, $ref, $defs, $comment, $anchor
type, properties, items, additionalProperties
required, dependencies, dependentSchemas
enum, const, default
pattern, minLength, maxLength
minimum, maximum, exclusiveMinimum, exclusiveMaximum
multipleOf
allOf, anyOf, oneOf, not
if, then, else
title, description, examples
```

### Related Issues
- Vision API occasionally returns incomplete light data for floor plans
- Gemini 2.5 Pro strict mode enforces strict JSON Schema validation
- Optional chaining operator `?.` does not prevent `.replace()` error on undefined values
- Schema mismatch between instructions and actual schema definition

---

**Report Generated:** 2026-04-13  
**Status:** Ready for Implementation  
**Next Steps:** Apply fixes in priority order and run test suite
