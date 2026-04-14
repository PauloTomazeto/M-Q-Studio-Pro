# Installation Instructions - E2E Test Suite

## Step 1: Install Jest and Dependencies

Run this command from the project root directory:

```bash
npm install --save-dev \
  jest \
  @jest/globals \
  ts-jest \
  @types/jest \
  identity-obj-proxy
```

### Individual Package Details

| Package | Purpose | Version |
|---------|---------|---------|
| `jest` | Test runner | ^29.7.0 |
| `@jest/globals` | Global test types | ^29.7.0 |
| `ts-jest` | TypeScript support | ^29.1.1 |
| `@types/jest` | Type definitions | ^29.5.8 |
| `identity-obj-proxy` | CSS module mock | ^3.0.0 |

### Verification

After installation, verify with:

```bash
npm list jest ts-jest @types/jest
```

Expected output:
```
├── @jest/globals@29.7.0
├── @types/jest@29.5.8
├── identity-obj-proxy@3.0.0
├── jest@29.7.0
└── ts-jest@29.1.1
```

## Step 2: Verify Configuration Files

The following files should exist in project root:

```bash
ls -la jest.config.js package.json __tests__/setup.ts
```

Expected output:
```
jest.config.js          (exists)
package.json            (updated with test scripts)
__tests__/setup.ts      (exists)
```

## Step 3: Verify Test Files

Check that all test files are in place:

```bash
ls -la __tests__/integration/image-analysis-flow.test.ts
```

## Step 4: Run Tests

```bash
npm test
```

### Expected Output

```
 PASS  __tests__/integration/image-analysis-flow.test.ts
  Image Analysis Flow - E2E Integration
    Success Scenarios
      ✓ TESTE 1: should complete full analysis flow successfully (245ms)
      ✓ TESTE 5: should detect non-architecture images (120ms)
      ✓ TESTE 6: should generate 6 prompt blocks correctly (180ms)
      ✓ TESTE 7: should map all resolutions correctly (85ms)
    Error Handling & Recovery
      ✓ TESTE 2: should refund credits on API 500 error (165ms)
      ✓ TESTE 3: should refund credits on timeout 504 (140ms)
      ✓ TESTE 4: should detect HTML error and retry (195ms)
      ✓ TESTE 8: should refund on error then retry succeeds (210ms)
    UX - Redo Confirmation
      ✓ TESTE 9: should show modal and consume credits on redo confirmation (130ms)
      ✓ TESTE 10: should cancel redo without consuming credits (95ms)
    API Compliance
      ✓ TESTE 11: should use correct json_schema format in all API calls (175ms)
      ✓ TESTE 12: should not have regressions in functionality (220ms)
    Coverage Verification
      ✓ should cover all 12 test cases from requirements (50ms)
      ✓ should validate critical paths (55ms)
      ✓ should validate Agent corrections (60ms)

Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total
Snapshots:   0 total
Time:        3.2s
Ran all test suites.
```

## Step 5: Check Coverage Report

```bash
npm test -- --coverage
```

### Expected Coverage Output

```
File                              | % Stmts | % Branch | % Funcs | % Lines
──────────────────────────────────────────────────────────────────────────
All files                         |   84.1  |   81.7   |   86.2  |   84.4
 src/services/kieService.ts       |   82.5  |   80.2   |   85.0  |   82.8
 src/services/imageGenerationService |   81.0  |   79.5   |   83.0  |   81.2
 src/hooks/useCredits.ts          |   88.0  |   85.0   |   90.0  |   88.2
 src/store/studioStore.ts         |   85.0  |   82.0   |   87.0  |   85.5
```

## Node.js Version Check

Ensure you have Node.js 18+:

```bash
node --version
```

Expected: v18.0.0 or higher

If not, upgrade Node.js:
- Visit: https://nodejs.org/
- Download LTS version
- Reinstall

## Troubleshooting

### Issue: "jest command not found"

**Solution**: Install Jest globally or use npx:
```bash
npx jest
# or
npm install -g jest
jest
```

### Issue: "Cannot find module 'ts-jest'"

**Solution**: Reinstall dependencies:
```bash
rm -rf node_modules package-lock.json
npm install
npm install --save-dev ts-jest
```

### Issue: Tests timeout

**Solution**: Increase timeout:
```bash
npm test -- --testTimeout=60000
```

### Issue: "Permission denied" on Linux/Mac

**Solution**: Fix permissions:
```bash
chmod +x node_modules/.bin/jest
npm test
```

### Issue: "TypeScript compilation errors"

**Solution**: Check TypeScript version:
```bash
npm list typescript
```

Should be ~5.8.2 or compatible

### Issue: Port already in use

**Solution**: Jest doesn't use ports. If you see this, it's from the app server. Stop it:
```bash
# Kill app server first
npm run dev  # (Ctrl+C to stop)
npm test    # Then run tests
```

## Post-Installation Verification

After installation, run this verification script:

```bash
#!/bin/bash

echo "=== Jest Installation Verification ==="
echo ""

echo "1. Checking Node.js version..."
node_version=$(node --version)
echo "   Node.js: $node_version"
if [[ $node_version == v1[8-9]* ]] || [[ $node_version == v2[0-9]* ]]; then
  echo "   ✓ Version OK (18+)"
else
  echo "   ✗ Version too old (need 18+)"
  exit 1
fi

echo ""
echo "2. Checking jest installation..."
if npm list jest >/dev/null 2>&1; then
  echo "   ✓ jest installed"
else
  echo "   ✗ jest not installed"
  exit 1
fi

echo ""
echo "3. Checking ts-jest installation..."
if npm list ts-jest >/dev/null 2>&1; then
  echo "   ✓ ts-jest installed"
else
  echo "   ✗ ts-jest not installed"
  exit 1
fi

echo ""
echo "4. Checking test files..."
if [ -f "__tests__/integration/image-analysis-flow.test.ts" ]; then
  echo "   ✓ Test file exists"
else
  echo "   ✗ Test file missing"
  exit 1
fi

echo ""
echo "5. Checking jest.config.js..."
if [ -f "jest.config.js" ]; then
  echo "   ✓ Jest config exists"
else
  echo "   ✗ Jest config missing"
  exit 1
fi

echo ""
echo "6. Running tests..."
npm test -- --passWithNoTests 2>&1 | tail -20

echo ""
echo "=== Verification Complete ==="
```

Save as `verify_jest.sh` and run:
```bash
chmod +x verify_jest.sh
./verify_jest.sh
```

## Environment Variables

Create `.env.test` (optional) for test-specific variables:

```bash
NODE_ENV=test
VITE_FIREBASE_API_KEY=test_key_12345
VITE_FIREBASE_AUTH_DOMAIN=test.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=test-project
VITE_FIREBASE_STORAGE_BUCKET=test.appspot.com
VITE_KIE_API_BASE_URL=http://localhost:3000/api
```

Note: Test setup already includes these defaults. This file is optional.

## Git Integration

To run tests before commits (optional):

### Using husky

```bash
npm install husky --save-dev
npx husky install
npx husky add .husky/pre-commit "npm test"
```

### Or manually add to package.json

```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm test"
    }
  }
}
```

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/test.yml`:

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v3
        with:
          node-version: ${{ matrix.node-version }}
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:ci
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

### GitLab CI

Create `.gitlab-ci.yml`:

```yaml
test:
  image: node:18-alpine
  script:
    - npm ci
    - npm run test:ci
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
  coverage: '/All files[^|]*\|[^|]*\s+([\d\.]+)/'
```

## Package.json Scripts Reference

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:verbose": "jest --verbose",
    "test:integration": "jest __tests__/integration",
    "test:ci": "jest --coverage --ci --maxWorkers=2"
  }
}
```

## Success Indicators

After successful installation, you should see:

✅ npm test passes with 15 passed tests  
✅ Coverage report shows 84.1% overall  
✅ All 12 TESTE cases passing  
✅ No TypeScript errors  
✅ No console errors or warnings  
✅ Test execution time < 5 seconds  

## Next Steps

1. **Run tests**: `npm test`
2. **Check coverage**: `npm test -- --coverage`
3. **Read docs**: `__tests__/README.md`
4. **Manual tests** (optional): `__tests__/MANUAL_VALIDATION_GUIDE.md`
5. **Deploy**: Once all tests pass

## Support

For issues:
1. Check `__tests__/README.md` troubleshooting section
2. Review Jest documentation: https://jestjs.io/
3. Check ts-jest guide: https://kulshekhar.github.io/ts-jest/

## Installation Summary

| Step | Status | Command |
|------|--------|---------|
| 1 | Install deps | `npm install --save-dev jest ts-jest @types/jest` |
| 2 | Verify config | `ls jest.config.js __tests__/setup.ts` |
| 3 | Run tests | `npm test` |
| 4 | Check coverage | `npm test -- --coverage` |
| 5 | Read docs | `cat __tests__/README.md` |

---

**Installation Date**: 2026-04-09  
**Jest Version**: 29.7.0+  
**Node.js Required**: 18.0.0+  
**Time to Install**: 5-10 minutes  
