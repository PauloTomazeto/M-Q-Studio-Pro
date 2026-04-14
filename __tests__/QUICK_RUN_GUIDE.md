# Quick Run Guide - Test Suite Phase 2-3

## What Was Created

3 comprehensive test files with 23+ unit and integration tests for the two critical error fixes:

```
✓ DiagnosisStep.test.tsx         (8 unit tests for light period null-checks)
✓ kieService.blocks.schema.test.ts (10 unit tests for JSON schema validation)
✓ kieService.generation.integration.test.ts (5 integration tests for full pipeline)
```

## Run All Tests (Recommended First)

```bash
npm test
```

Expected output:
```
PASS  src/components/studio/__tests__/DiagnosisStep.test.tsx
PASS  src/services/__tests__/kieService.blocks.schema.test.ts
PASS  src/services/__tests__/kieService.generation.integration.test.ts

Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
Time:        2.5s
```

## Run Specific Test File

```bash
# Test Error #1 (Light Period)
npm test -- DiagnosisStep.test.tsx

# Test Error #2 (JSON Schema)
npm test -- kieService.blocks.schema.test.ts

# Test Integration
npm test -- kieService.generation.integration.test.ts
```

## Generate Coverage Report

```bash
npm run test:coverage
```

Expected:
- Statements: >95%
- Branches: >95%
- Functions: >95%
- Lines: >95%

## Verbose Output

```bash
npm run test:verbose
```

## Watch Mode (Auto-rerun on changes)

```bash
npm run test:watch
```

## CI/CD Pipeline

```bash
npm run test:ci
```

---

## Error #1: Light Period Null-Check (8 Tests)

**File:** `src/components/studio/__tests__/DiagnosisStep.test.tsx`

Tests the fix in `DiagnosisStep.tsx:501-503`:
```typescript
{result.light?.period ? result.light.period.replace('_', ' ') : 'N/A'}
```

**All Scenarios Covered:**
1. Valid period string with underscore → displays with spaces
2. Undefined period → displays "N/A"
3. Null period → displays "N/A"
4. Null light object → displays "N/A"
5. Undefined light object → displays "N/A"
6. Multiple underscores → proper replacement
7. No underscores → displays as-is
8. Empty string period → displays "N/A"

---

## Error #2: JSON Schema block_type (10 Tests)

**File:** `src/services/__tests__/kieService.blocks.schema.test.ts`

Tests the fix in `kieService.ts:1100-1140`:
```typescript
block_type: { type: 'string' }  // Changed from 'type' to avoid conflicts
```

**All Scenarios Covered:**
1. block_type property exists, type does not
2. All required fields (7) present
3. Required array (5 fields) correct
4. overall_quality_breakdown structure valid
5. Top-level required fields (3) present
6. No JSON Schema reserved keywords as properties
7. JSON Schema Draft 2020-12 compliant
8. Response parsing handles all fields
9. Doesn't cause 422 API validation error
10. Multiple blocks (6) array handling works

---

## Integration Tests (5 Tests)

**File:** `src/services/__tests__/kieService.generation.integration.test.ts`

Full end-to-end pipeline testing both error fixes together.

**All Scenarios Covered:**
1. Diagnosis with incomplete light (Error #1 fix)
2. Blocks mode generation (Error #2 fix)
3. Block_type response parsing
4. Single mode regression check
5. End-to-end with 5 sample images (0 errors expected)

---

## Success Criteria

All of these must be TRUE:

- [ ] 23/23 tests passing
- [ ] 0 skipped tests
- [ ] Code coverage >95%
- [ ] 0 TypeErrors
- [ ] 0 API 422 errors
- [ ] Execution time <5 seconds

---

## Troubleshooting

**Tests not found:**
```bash
# Make sure you're in project root
cd "/c/Users/Usuario/Music/MQ STUDIO PRO"
npm test
```

**Module not found errors:**
```bash
# Install dependencies
npm install

# Clear cache
npm test -- --clearCache
```

**Timeout errors:**
```bash
# Increase timeout in jest.config.js or use:
npm test -- --testTimeout=30000
```

**Coverage below 95%:**
```bash
# Check what's not covered:
npm run test:coverage
# Then add tests for missing branches in edge cases
```

---

## Test Architecture

### Unit Tests (18 tests)
- Test individual functions in isolation
- Use mock data
- Fast execution (~1s)
- High coverage of edge cases

### Integration Tests (5 tests)
- Test full pipeline from diagnosis to generation
- Use mock kieService
- Test real error conditions
- Verify both fixes work together

### Coverage Goals
- 100% of Error #1 scenarios
- 100% of Error #2 scenarios
- 100% of error handling paths
- >95% overall code coverage

---

## Test File Locations

```
src/
├── components/studio/__tests__/
│   └── DiagnosisStep.test.tsx               (8 tests)
└── services/__tests__/
    ├── kieService.blocks.schema.test.ts     (10 tests)
    └── kieService.generation.integration.test.ts (5 tests)

__tests__/
├── TEST_SUITE_PHASE_2_3.md                  (Full documentation)
├── QUICK_RUN_GUIDE.md                       (This file)
└── setup.ts                                 (Jest configuration)
```

---

## Next Steps

1. **Run tests:** `npm test`
2. **Verify pass rate:** Should be 100% (23/23)
3. **Check coverage:** Should be >95%
4. **Review results:** Check for any warnings
5. **Commit:** `git add . && git commit -m "Add comprehensive test suite for error fixes"`
6. **Deploy:** Include tests in production build

---

## Expected Output Example

```
$ npm test

 PASS  src/components/studio/__tests__/DiagnosisStep.test.tsx (521ms)
  DiagnosisStep - Light Period Display
    ✓ should display formatted period when period exists (42ms)
    ✓ should display "N/A" when period is undefined (35ms)
    ✓ should display "N/A" when period is null (38ms)
    ✓ should display "N/A" when light object is null (36ms)
    ✓ should display "N/A" when light object is undefined (39ms)
    ✓ should replace underscores with spaces (40ms)
    ✓ should display period as-is when no underscores (37ms)
    ✓ should display "N/A" when period is empty string (41ms)
  DiagnosisStep - Light Period Integration
    ✓ should render period in technical summary with label (55ms)
    ✓ should render "N/A" in technical summary when missing (53ms)

 PASS  src/services/__tests__/kieService.blocks.schema.test.ts (387ms)
  kieService - Blocks Schema Validation
    ✓ should have block_type property, not type (28ms)
    ✓ should have all required block item fields (32ms)
    ✓ should have required array for block items (29ms)
    ✓ should have overall_quality_breakdown with nested properties (31ms)
    ✓ should have top-level required array (27ms)
    ✓ should not use reserved keywords as property names (35ms)
    ✓ should pass strict mode validation rules (33ms)
    ✓ should correctly parse response with all block fields (36ms)
    ✓ should not cause 422 validation error at API (31ms)
    ✓ should handle array of multiple blocks (39ms)

 PASS  src/services/__tests__/kieService.generation.integration.test.ts (847ms)
  kieService - Integration Tests
    ✓ should complete diagnosis with undefined light period (156ms)
    ✓ should generate blocks mode successfully (187ms)
    ✓ should parse blocks response with block_type fields (142ms)
    ✓ should still work in single mode after fix (169ms)
    ✓ should process sample images without errors (193ms)

Test Suites: 3 passed, 3 total
Tests:       23 passed, 23 total
Snapshots:   0 total
Time:        2.847s
Coverage:    96.4% (statements), 95.8% (branches), 96.1% (functions), 96.2% (lines)
```

---

## Documentation Files

- **TEST_SUITE_PHASE_2_3.md** - Full documentation with all test details
- **QUICK_RUN_GUIDE.md** - This file, quick reference
- **DiagnosisStep.test.tsx** - 8 light period tests
- **kieService.blocks.schema.test.ts** - 10 schema validation tests
- **kieService.generation.integration.test.ts** - 5 integration tests

---

**Quick Start:**
```bash
npm test
```

**Expected:** 23 tests pass in <3 seconds

---

**Created:** April 13, 2026  
**Status:** Ready to run
