# Manual Validation Guide - Image Analysis Flow

## Overview

This guide provides step-by-step instructions for manually testing the Image Analysis Flow when automated tests cannot be run or for supplementary QA validation.

## Prerequisites

- Running application with proper environment variables configured
- User with test credits (100+)
- Test images ready:
  - Architecture image (house, building interior)
  - Non-architecture image (landscape, portrait)
  - Floor plan image (optional)

## Test Environment Setup

### 1. Configure Environment Variables
```bash
# Create .env.local with test API keys
VITE_FIREBASE_API_KEY=your_test_key
VITE_KIE_API_BASE_URL=http://localhost:3000/api
```

### 2. Start Application
```bash
npm run dev
```

### 3. Login with Test Account
- Email: test@example.com
- Password: Test@12345
- Initial credits: 100

---

## Manual Test Cases

### TESTE 1: Full Success Flow

**Objective**: Validate complete image analysis pipeline

**Steps**:
1. Upload architecture image (high-quality building/interior)
2. Wait for "Architecture Detection" (should return isArchitecture: true)
3. Verify response shows:
   - `isArchitecture: true`
   - `confidence: > 0.9`
   - `reason: "Image shows architectural elements..."`

4. System performs "Image Diagnosis"
   - Status: "Analyzing..." → "Complete"
   - Deducts 5 credits
   - Displays ScanResult with:
     - typology (PERSPECTIVA, PLANTA_BAIXA, FACHADA, etc.)
     - materials (list with element, acabamento, confidence)
     - light (period, temp_k, azimuthal_direction)
     - lightPoints (array of detected lighting fixtures)
     - confidence metrics

5. System generates "Prompt"
   - Shows "Generating prompt in blocks mode..."
   - Returns 6 blocks:
     1. architecture_base
     2. camera_system
     3. lighting_regime
     4. interior_completion
     5. exterior_completion
     6. materiality_finishing
   - Each block shows word_count and quality_score

6. User selects resolution (2K, 2.5K, 3K, 4K)
7. System creates image generation task
8. Check credit balance: Should be -5 from initial

**Expected Results**:
- ✓ No errors during flow
- ✓ 5 credits deducted
- ✓ All ScanResult properties populated
- ✓ 6 distinct prompt blocks generated
- ✓ Image generation task created
- ✓ Toast: "Image generation started"

**Pass Criteria**: All steps complete without errors

---

### TESTE 2: Diagnose with Server Error (500)

**Objective**: Validate automatic refund on 500 error

**Setup**: 
- Initial credits: 100
- Mock API to return 500 error (use browser DevTools)

**Steps**:
1. Upload image
2. Click "Analyze"
3. Wait for diagnosis to begin (credits -5)
4. Simulate 500 error by:
   - Open DevTools → Network tab
   - Manually inject error response
   - OR use test API endpoint that returns 500

5. System should:
   - Detect 500 error
   - Stop diagnosis
   - Automatically refund 5 credits
   - Show toast: "Refunded due to server error"

6. Check credit balance: Should be back to 100

**Expected Results**:
- ✓ Credits deducted then immediately refunded
- ✓ No stuck "loading" state
- ✓ Toast notification appears
- ✓ Final balance: 100 (preserved)

**Pass Criteria**: Credits restored within 3 seconds of error

---

### TESTE 3: Diagnose with Timeout (504)

**Objective**: Validate refund on 504 timeout

**Setup**:
- Initial credits: 100
- Configure timeout to 180+ seconds

**Steps**:
1. Upload image
2. Click "Analyze"
3. Wait 180+ seconds (or mock timeout)
4. System detects timeout (504 response)
5. Credits should be refunded automatically
6. Toast: "Request timed out - refund processed"
7. Check credit balance

**Expected Results**:
- ✓ Timeout detected after 180s
- ✓ 5 credits refunded
- ✓ User informed via toast
- ✓ Final balance: 100 (preserved)

**Pass Criteria**: Timeout handled gracefully with automatic refund

---

### TESTE 4: HTML Error Detection

**Objective**: Validate HTML error detection and retry mechanism

**Setup**:
- Mock API to return HTML response (maintenance page)

**Steps**:
1. Upload image
2. Click "Analyze"
3. System detects HTML in response (not JSON)
4. Shows toast: "AI server is under maintenance"
5. System attempts automatic retry after 3 seconds
6. Retry should succeed with valid JSON response

**Expected Results**:
- ✓ HTML error detected
- ✓ Maintenance message shown
- ✓ Automatic retry initiated
- ✓ Retry succeeds without double-charging credits

**Pass Criteria**: Error handled gracefully with single credit deduction

---

### TESTE 5: Non-Architecture Image

**Objective**: Validate detection of non-architectural images

**Steps**:
1. Upload landscape/portrait photo (not architectural)
2. Click "Analyze"
3. System performs architecture detection
4. Response shows:
   - `isArchitecture: false`
   - `confidence: > 0.85`
   - `reason: "Image is a landscape photograph, not architectural"`

5. UI should display warning:
   - Color: Yellow/amber
   - Message: "⚠️ This image may not be architectural. Continue anyway?"
   - Buttons: [Continue] [Cancel]

6. User can click "Cancel" (no credits deducted)
7. Or click "Continue" to proceed (credits deducted)

**Expected Results**:
- ✓ Non-architecture correctly identified
- ✓ Warning displayed with high visibility
- ✓ User choice respected (cancel = no charge)
- ✓ Continue = proceeds with analysis

**Pass Criteria**: Non-architectural images handled appropriately

---

### TESTE 6: Prompt Generation with 6 Blocks

**Objective**: Validate prompt generation structure

**Steps**:
1. Complete image diagnosis (TESTE 1)
2. Observe "Prompt Generation" step
3. Verify response contains exactly 6 blocks:
   ```json
   {
     "blocks": [
       {
         "type": "architecture_base",
         "title": "...",
         "content": "...",
         "word_count": 250,
         "quality_score": 0.92
       },
       // ... 5 more blocks
     ],
     "overall_quality_score": 0.90,
     "total_word_count": 1250
   }
   ```

4. Each block should have:
   - ✓ type (string)
   - ✓ title (string)
   - ✓ content (string, >100 chars)
   - ✓ word_count (number, >100)
   - ✓ quality_score (number, 0.8-1.0)
   - ✓ quality_breakdown (object with clarity, specificity, coherence, brevity)

**Expected Results**:
- ✓ Exactly 6 blocks returned
- ✓ All required properties present
- ✓ Word counts reasonable (150-300 per block)
- ✓ Quality scores high (>0.85)
- ✓ Total word count ~1200-1500

**Pass Criteria**: All 6 blocks with valid structure and quality metrics

---

### TESTE 7: Resolution Mapping

**Objective**: Validate resolution mapping (1k → 1K, etc.)

**Steps**:
1. Complete image diagnosis
2. At "Select Resolution" step, try each option:
   - [ ] 1K (if available)
   - [ ] 2K
   - [ ] 2.5K
   - [ ] 3K
   - [ ] 4K

3. For each resolution:
   - Click selection
   - Verify API call includes correct format
   - Open DevTools → Network tab
   - Check request payload contains:
     ```json
     {
       "resolution": "2K",  // ← Should be uppercase with K
       "model": "nano-banana-2"
     }
     ```

4. Verify model selection:
   - 2K → nano-banana-2
   - 2.5K/3K/4K → nano-banana-pro

**Expected Results**:
- ✓ All resolutions available and selectable
- ✓ Correct API format (uppercase with K)
- ✓ Correct model selected based on resolution
- ✓ API request succeeds

**Pass Criteria**: All resolutions mapped correctly

---

### TESTE 8: Error then Retry Success

**Objective**: Validate error recovery without double-charging

**Setup**:
- Initial credits: 100
- Mock first API call to fail, second to succeed

**Steps**:
1. Upload image
2. Click "Analyze"
3. First API call returns 500 error
   - Credit deducted: -5 (balance: 95)
   - Refund applied: +5 (balance: 100)
4. System automatically retries after 3 seconds
5. Second API call succeeds
   - Credit deducted: -5 (balance: 95)
   - Diagnosis completes
6. Check final credit balance

**Expected Results**:
- ✓ First error: -5 then +5 (net 0)
- ✓ Retry after 3 seconds (user sees countdown)
- ✓ Retry success: -5 (no additional refund)
- ✓ Final balance: 95 (only one deduction)

**Pass Criteria**: Only one credit deducted despite two API calls

---

### TESTE 9: Redo Confirmation

**Objective**: Validate redo confirmation modal

**Steps**:
1. Complete full analysis (TESTE 1)
2. Review results displayed
3. Click "Redo Analysis" button
4. Modal should appear with:
   - Title: "Confirm Redo?"
   - Message: "This will cost 5 credits. Are you sure?"
   - Buttons: [Confirm] [Cancel]
   - Icon: Circular warning icon

5. Click "Confirm"
6. Modal closes
7. New diagnosis begins (status shows "Analyzing...")
8. Check credits deducted (-5)

**Expected Results**:
- ✓ Modal appears on "Redo" click
- ✓ Clear message about credit cost
- ✓ Modal closes after confirmation
- ✓ New diagnosis starts immediately
- ✓ 5 credits deducted
- ✓ Toast: "Redo confirmed"

**Pass Criteria**: Modal appears, user can confirm with credit deduction

---

### TESTE 10: Redo Cancellation

**Objective**: Validate cancel redo without losing credits

**Steps**:
1. Complete full analysis (TESTE 1)
2. Initial credits: 95 (after TESTE 9)
3. Click "Redo Analysis" button
4. Modal appears
5. Click "Cancel" button
6. Modal closes
7. Check credit balance
8. Verify previous analysis still displayed

**Expected Results**:
- ✓ Modal appears
- ✓ Cancel closes modal
- ✓ Credits unchanged (still 95)
- ✓ Previous analysis preserved
- ✓ No API calls made
- ✓ No error messages

**Pass Criteria**: Cancel successfully closes modal without side effects

---

### TESTE 11: API Response Format

**Objective**: Validate json_schema compliance in all 4 functions

**Setup**: DevTools Network tab open

**Steps**:
1. Complete full analysis flow (TESTE 1)
2. For each API call, inspect Request → Body:

   **Call 1: Architecture Detection**
   ```json
   {
     "response_format": {
       "type": "json_schema",
       "json_schema": {
         "strict": true,
         "schema": { "properties": { "isArchitecture": ... } }
       }
     }
   }
   ```

   **Call 2: Image Diagnosis**
   ```json
   {
     "response_format": {
       "type": "json_schema",
       "json_schema": {
         "strict": true,
         "schema": { "properties": { "isFloorPlan": ... } }
       }
     }
   }
   ```

   **Call 3: Prompt Generation**
   ```json
   {
     "response_format": {
       "type": "json_schema",
       "json_schema": {
         "strict": true,
         "schema": { "properties": { "blocks": ... } }
       }
     }
   }
   ```

   **Call 4: Image Generation**
   - Verify request format for nano-banana API

3. Check each response parses as valid JSON
4. Verify schema validation succeeded

**Expected Results**:
- ✓ All 4 calls use `response_format.type: "json_schema"`
- ✓ All use `json_schema.strict: true`
- ✓ All responses are valid JSON
- ✓ Schema validation passes

**Pass Criteria**: All 4 functions use correct json_schema format

---

### TESTE 12: No Regressions

**Objective**: Validate original functionality preserved

**Steps**:

1. **Original Functions Still Work**:
   - [ ] Upload image → works
   - [ ] Detect architecture → works
   - [ ] Diagnose image → works
   - [ ] Generate prompt → works
   - [ ] Generate image → works

2. **Interfaces Unchanged**:
   - [ ] ScanResult has all original properties
   - [ ] ArchitectureDetection has isArchitecture, confidence, reason
   - [ ] PromptGeneration returns blocks or single string based on mode
   - [ ] ImageGeneration creates task with correct ID

3. **Default Behavior**:
   - [ ] No unexpected errors
   - [ ] Error messages clear and actionable
   - [ ] Loading states show progress
   - [ ] Modal dialogs work correctly

4. **UI/UX**:
   - [ ] Buttons are clickable
   - [ ] Forms validate input
   - [ ] Toast notifications appear correctly
   - [ ] Credit balance updates in real-time

5. **Performance**:
   - [ ] Each API call completes in <30 seconds
   - [ ] UI responsive during loading
   - [ ] No memory leaks (DevTools → Memory tab)
   - [ ] Console has no errors

**Expected Results**:
- ✓ All original features working
- ✓ No breaking changes
- ✓ No new errors introduced
- ✓ UI/UX smooth and responsive

**Pass Criteria**: All original functionality preserved

---

## Manual Test Execution Report

### Date: ________________
### Tester: ________________
### Environment: ________________

| TESTE # | Test Name | Result | Notes | Time |
|---------|-----------|--------|-------|------|
| 1 | Full Success Flow | ☐ Pass ☐ Fail | | |
| 2 | Server Error 500 | ☐ Pass ☐ Fail | | |
| 3 | Timeout 504 | ☐ Pass ☐ Fail | | |
| 4 | HTML Error Detection | ☐ Pass ☐ Fail | | |
| 5 | Non-Architecture | ☐ Pass ☐ Fail | | |
| 6 | 6 Prompt Blocks | ☐ Pass ☐ Fail | | |
| 7 | Resolution Mapping | ☐ Pass ☐ Fail | | |
| 8 | Error then Retry | ☐ Pass ☐ Fail | | |
| 9 | Redo Confirmation | ☐ Pass ☐ Fail | | |
| 10 | Redo Cancellation | ☐ Pass ☐ Fail | | |
| 11 | JSON Schema Format | ☐ Pass ☐ Fail | | |
| 12 | No Regressions | ☐ Pass ☐ Fail | | |

### Summary
- **Total Tests**: 12
- **Passed**: ☐
- **Failed**: ☐
- **Pass Rate**: ☐ %

### Issues Found
```
1. [Priority] Description
2. [Priority] Description
```

### Recommendations
```
1. 
2. 
```

### Sign-off
- [ ] All tests passed
- [ ] Ready for deployment
- [ ] Agent corrections validated

**Tester Signature**: ________________ **Date**: ________________

---

## Automated Test Equivalents

For each manual test above, the automated test file includes:
- `TESTE 1` → `should complete full analysis flow successfully`
- `TESTE 2` → `should refund credits on API 500 error`
- `TESTE 3` → `should refund credits on timeout 504`
- `TESTE 4` → `should detect HTML error and retry`
- `TESTE 5` → `should detect non-architecture images`
- `TESTE 6` → `should generate 6 prompt blocks correctly`
- `TESTE 7` → `should map all resolutions correctly`
- `TESTE 8` → `should refund on error then retry succeeds`
- `TESTE 9` → `should show modal and consume credits on redo confirmation`
- `TESTE 10` → `should cancel redo without consuming credits`
- `TESTE 11` → `should use correct json_schema format in all API calls`
- `TESTE 12` → `should not have regressions in functionality`

**Run automated tests**:
```bash
npm test -- __tests__/integration/image-analysis-flow.test.ts
```

---

**Last Updated**: 2026-04-09
**Version**: 1.0.0
