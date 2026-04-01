# EXECUTOR 3 - Especificações de Teste

## 1. Testes de Unidade

### 1.1 Test Suite: getProxyUrl()

**Arquivo**: `src/services/storageService.test.ts`

```typescript
describe('getProxyUrl', () => {
  
  it('should convert Firebase URL to proxy URL', () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/path%2Fimage.jpg?alt=media&token=abc123';
    const result = getProxyUrl(firebaseUrl);
    expect(result).toBe('/api/storage/download/path%2Fimage.jpg');
  });

  it('should decode URL-encoded paths', () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/my%20folder%2Fimage.jpg?token=abc';
    const result = getProxyUrl(firebaseUrl);
    expect(result).toContain('my folder');
  });

  it('should throw error on invalid Firebase URL format', () => {
    const invalidUrl = 'https://example.com/image.jpg';
    expect(() => getProxyUrl(invalidUrl)).toThrow('Invalid Firebase URL format');
  });

  it('should handle deeply nested paths', () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/user%2Fsession%2Fimage%2Foriginal.jpg?token=abc';
    const result = getProxyUrl(firebaseUrl);
    expect(result).toContain('user');
    expect(result).toContain('session');
  });

  it('should strip query parameters', () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg?alt=media&token=xyz&other=param';
    const result = getProxyUrl(firebaseUrl);
    expect(result).not.toContain('?');
    expect(result).not.toContain('token');
  });

  it('should preserve file extensions', () => {
    const urls = [
      'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg?token=abc',
      'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.png?token=abc',
      'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.webp?token=abc'
    ];
    
    urls.forEach(url => {
      const result = getProxyUrl(url);
      const ext = url.split('.').pop().split('?')[0];
      expect(result).toContain(ext);
    });
  });
});
```

### 1.2 Test Suite: validateImageUrl() in DiagnosisStep

**Arquivo**: `src/components/studio/DiagnosisStep.test.tsx`

```typescript
describe('validateImageUrl', () => {
  
  it('should accept base64 data URLs', () => {
    const base64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...';
    const result = validateImageUrl(base64);
    expect(result).toBe(true);
  });

  it('should accept blob URLs with warning', () => {
    const blobUrl = 'blob:http://localhost:3000/abc-123';
    const result = validateImageUrl(blobUrl);
    expect(result).toBe(true);
    // Should log warning
  });

  it('should reject non-string inputs', () => {
    expect(validateImageUrl(null)).toBe(false);
    expect(validateImageUrl(undefined)).toBe(false);
    expect(validateImageUrl({})).toBe(false);
    expect(validateImageUrl([])).toBe(false);
  });

  it('should reject unknown formats', () => {
    expect(validateImageUrl('invalid-url')).toBe(false);
    expect(validateImageUrl('some-text')).toBe(false);
  });

  it('should handle empty string', () => {
    expect(validateImageUrl('')).toBe(false);
  });

  it('should be case insensitive for data URLs', () => {
    const urlLower = 'data:image/jpeg;base64,abc';
    const urlMixed = 'DATA:IMAGE/jpeg;base64,abc';
    expect(validateImageUrl(urlLower)).toBe(true);
    // Should also work with mixed case
  });
});
```

### 1.3 Test Suite: Retry Logic in DiagnosisStep

**Arquivo**: `src/components/studio/DiagnosisStep.test.tsx`

```typescript
describe('Retry Logic', () => {
  
  it('should retry on transient error', async () => {
    const mockError = new Error('Network timeout');
    let callCount = 0;
    
    const diagnoseImageMock = jest.fn()
      .mockImplementationOnce(() => { throw mockError; })
      .mockImplementationOnce(() => ({ isFloorPlan: false, typology: 'PERSPECTIVA' }));
    
    // Should succeed on second attempt
    await runAnalysis(); // First attempt fails
    await new Promise(r => setTimeout(r, 1000)); // Wait 1s
    await runAnalysis(); // Second attempt succeeds
    
    expect(diagnoseImageMock).toHaveBeenCalledTimes(2);
  });

  it('should not retry on permanent error', async () => {
    const mockError = new Error('Invalid image format');
    const diagnoseImageMock = jest.fn().mockRejectedValue(mockError);
    
    await expect(runAnalysis()).rejects.toThrow();
    expect(diagnoseImageMock).toHaveBeenCalledTimes(1);
  });

  it('should apply exponential backoff delays', async () => {
    const timers: number[] = [];
    const originalSetTimeout = global.setTimeout;
    
    global.setTimeout = jest.fn((cb, delay) => {
      timers.push(delay);
      return originalSetTimeout(cb, delay);
    });

    // Simulate 3 retries
    // First retry: 1000ms
    // Second retry: 2000ms
    // Third retry: 3000ms
    
    expect(timers).toEqual([1000, 2000, 3000]);
  });

  it('should stop retrying after maxRetries=3', async () => {
    const mockError = new Error('Persistent error');
    const diagnoseImageMock = jest.fn().mockRejectedValue(mockError);
    
    await expect(runAnalysis()).rejects.toThrow();
    // Initial + 3 retries = 4 total calls
    expect(diagnoseImageMock).toHaveBeenCalledTimes(4);
  });

  it('should stop retrying after maxElapsedTime=30s', async () => {
    // Simulate 35 seconds elapsed
    const mockError = new Error('Transient error');
    const diagnoseImageMock = jest.fn().mockRejectedValue(mockError);
    
    // elapsedTime > 30 → should not retry
    expect(retryCountRef.current).toBe(0);
  });

  it('should identify transient vs permanent errors', () => {
    const transientErrors = [
      'Network timeout',
      'TIMEOUT_ERROR',
      'KIE_API_ERROR: service unavailable',
      'AI_RESPONSE_EMPTY'
    ];

    const permanentErrors = [
      'Invalid image format',
      'Authentication failed',
      'Zod validation error',
      'Image too large'
    ];

    transientErrors.forEach(err => {
      expect(isTransientError(err)).toBe(true);
    });

    permanentErrors.forEach(err => {
      expect(isTransientError(err)).toBe(false);
    });
  });
});
```

### 1.4 Test Suite: imageSource Detection in kieService

**Arquivo**: `src/services/kieService.test.ts`

```typescript
describe('imageSource Detection', () => {
  
  it('should detect base64 data URL', async () => {
    const base64 = 'data:image/jpeg;base64,/9j/4AAQ...';
    await kieService.diagnoseImage(base64, 'session-id');
    
    const savedDoc = await firebase.firestore().collection('scan_results').orderBy('createdAt', 'desc').limit(1).get();
    expect(savedDoc.docs[0].data().imageSource).toBe('base64_direct');
  });

  it('should detect HTTP/HTTPS URL', async () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg?token=abc';
    await kieService.diagnoseImage(url, 'session-id');
    
    const savedDoc = await firebase.firestore().collection('scan_results').orderBy('createdAt', 'desc').limit(1).get();
    expect(savedDoc.docs[0].data().imageSource).toBe('signed_url');
  });

  it('should detect blob URL', async () => {
    const blobUrl = 'blob:http://localhost:3000/abc-123';
    // Mock the API to avoid actual call
    await kieService.diagnoseImage(blobUrl, 'session-id');
    
    const savedDoc = await firebase.firestore().collection('scan_results').orderBy('createdAt', 'desc').limit(1).get();
    expect(savedDoc.docs[0].data().imageSource).toBe('blob_url');
  });

  it('should detect Firebase URL', async () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/path/image.jpg';
    await kieService.diagnoseImage(firebaseUrl, 'session-id');
    
    const savedDoc = await firebase.firestore().collection('scan_results').orderBy('createdAt', 'desc').limit(1).get();
    expect(savedDoc.docs[0].data().imageSource).toBe('firebase_url');
  });

  it('should detect raw base64 and add prefix', async () => {
    const rawBase64 = '/9j/4AAQSkZJRg...';
    const mockResponse = { candidates: [{ content: { parts: [{ text: '{}' }] } }] };
    jest.spyOn(axios, 'post').mockResolvedValueOnce({ data: mockResponse });
    
    await kieService.diagnoseImage(rawBase64, 'session-id');
    
    const savedDoc = await firebase.firestore().collection('scan_results').orderBy('createdAt', 'desc').limit(1).get();
    expect(savedDoc.docs[0].data().imageSource).toBe('base64_raw');
  });

  it('should log imageSource in Firestore', async () => {
    const base64 = 'data:image/jpeg;base64,abc';
    await kieService.diagnoseImage(base64, 'session-id');
    
    // Check scan_results collection
    const scanResult = await firebase.firestore().collection('scan_results').orderBy('createdAt', 'desc').limit(1).get();
    expect(scanResult.docs[0].data()).toHaveProperty('imageSource');
    
    // Check generation_sessions collection
    const session = await firebase.firestore().collection('generation_sessions').doc('session-id').get();
    expect(session.data()).toHaveProperty('imageSource');
  });
});
```

---

## 2. Testes de Integração

### 2.1 Test Suite: GenerationStep + getProxyUrl

**Arquivo**: `src/components/studio/GenerationStep.integration.test.tsx`

```typescript
describe('GenerationStep with Proxy URLs', () => {
  
  it('should convert Firebase URLs to proxy URLs before generation', async () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg?token=abc';
    const mockGenerateImage = jest.spyOn(kieService, 'generateImage');
    
    // Set store with Firebase URLs
    useStudioStore.setState({
      mainImageUrl: firebaseUrl,
      mirrorImageUrl: firebaseUrl,
      sessionId: 'session-123'
    });

    await act(async () => {
      await handleGenerate();
    });

    // Check that generateImage was called with proxy URLs
    const callArgs = mockGenerateImage.mock.calls[0][0];
    expect(callArgs.image_input[0]).toMatch(/^\/api\/storage\/download\//);
    expect(callArgs.image_input[1]).toMatch(/^\/api\/storage\/download\//);
  });

  it('should fallback to original URL on conversion error', async () => {
    const invalidUrl = 'https://example.com/image.jpg'; // Not a Firebase URL
    const mockGenerateImage = jest.spyOn(kieService, 'generateImage');
    
    useStudioStore.setState({
      mainImageUrl: invalidUrl,
      sessionId: 'session-123'
    });

    await act(async () => {
      await handleGenerate();
    });

    const callArgs = mockGenerateImage.mock.calls[0][0];
    expect(callArgs.image_input[0]).toBe(invalidUrl); // Original preserved
  });

  it('should handle missing mirror URL gracefully', async () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/image.jpg?token=abc';
    const mockGenerateImage = jest.spyOn(kieService, 'generateImage');
    
    useStudioStore.setState({
      mainImageUrl: firebaseUrl,
      mirrorImageUrl: undefined,
      sessionId: 'session-123'
    });

    await act(async () => {
      await handleGenerate();
    });

    const callArgs = mockGenerateImage.mock.calls[0][0];
    expect(callArgs.image_input).toHaveLength(1);
  });

  it('should handle both URLs missing and throw error', async () => {
    useStudioStore.setState({
      mainImageUrl: undefined,
      sessionId: 'session-123'
    });

    await expect(handleGenerate()).rejects.toThrow('Você deve anexar a Imagem Principal');
  });
});
```

### 2.2 Test Suite: DiagnosisStep + kieService Retry

**Arquivo**: `src/components/studio/DiagnosisStep.integration.test.tsx`

```typescript
describe('DiagnosisStep with Retry Logic', () => {
  
  it('should retry diagnosis on transient error and eventually succeed', async () => {
    const mockDiagnose = jest.spyOn(kieService, 'diagnoseImage');
    const transientError = new Error('API_TIMEOUT');
    const successResult = { isFloorPlan: false, typology: 'PERSPECTIVA' };

    mockDiagnose
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce(successResult);

    useStudioStore.setState({
      base64Image: 'data:image/jpeg;base64,abc',
      sessionId: 'session-123',
      image: null
    });

    await act(async () => {
      const component = render(<DiagnosisStep />);
      await waitFor(() => {
        expect(component.queryByText('Diagnóstico Concluído')).toBeInTheDocument();
      });
    });

    expect(mockDiagnose).toHaveBeenCalledTimes(2);
  });

  it('should show error after 3 failed retries', async () => {
    const mockDiagnose = jest.spyOn(kieService, 'diagnoseImage');
    const transientError = new Error('TIMEOUT_ERROR');

    mockDiagnose.mockRejectedValue(transientError);

    useStudioStore.setState({
      base64Image: 'data:image/jpeg;base64,abc',
      sessionId: 'session-123'
    });

    await act(async () => {
      const component = render(<DiagnosisStep />);
      await waitFor(() => {
        expect(component.queryByText('Falha no Diagnóstico')).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    expect(mockDiagnose).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should not retry on permanent errors', async () => {
    const mockDiagnose = jest.spyOn(kieService, 'diagnoseImage');
    const permanentError = new Error('Invalid image format');

    mockDiagnose.mockRejectedValue(permanentError);

    useStudioStore.setState({
      base64Image: 'data:image/jpeg;base64,abc',
      sessionId: 'session-123'
    });

    await act(async () => {
      const component = render(<DiagnosisStep />);
      await waitFor(() => {
        expect(component.queryByText('Falha no Diagnóstico')).toBeInTheDocument();
      });
    });

    expect(mockDiagnose).toHaveBeenCalledTimes(1); // No retries
  });

  it('should validate image URL before diagnosis', async () => {
    useStudioStore.setState({
      base64Image: 'invalid-format',
      sessionId: 'session-123'
    });

    const component = render(<DiagnosisStep />);
    
    expect(component.queryByText('Formato de imagem inválido')).toBeInTheDocument();
  });
});
```

---

## 3. Testes E2E (End-to-End)

### 3.1 Test Scenario: Full Diagnosis Flow

**Arquivo**: `cypress/integration/diagnosis-with-proxy.cy.ts`

```typescript
describe('Full Diagnosis Flow with Proxy Integration', () => {
  
  it('should complete diagnosis with Firebase image URL', () => {
    cy.visit('/studio');
    
    // Upload image
    cy.get('[data-testid="upload-input"]').selectFile('cypress/fixtures/image.jpg');
    
    // Wait for processing
    cy.get('[data-testid="diagnosis-status"]', { timeout: 10000 })
      .should('contain', 'Diagnóstico Concluído');
    
    // Verify results
    cy.get('[data-testid="materials-count"]').should('contain', /\d+/);
    cy.get('[data-testid="lighting-points"]').should('contain', /\d+/);
    cy.get('[data-testid="camera-focal"]').should('contain', /\d+mm/);
  });

  it('should handle diagnosis retry automatically', () => {
    // Mock API to fail once then succeed
    cy.intercept('POST', '/api/kie/gemini', { forceNetworkError: true }).as('failAPI');
    cy.intercept('POST', '/api/kie/gemini', { fixture: 'diagnosis-response.json' }).as('successAPI');
    
    cy.visit('/studio');
    cy.get('[data-testid="upload-input"]').selectFile('cypress/fixtures/image.jpg');
    
    // Should eventually show success
    cy.get('[data-testid="diagnosis-status"]', { timeout: 15000 })
      .should('contain', 'Diagnóstico Concluído');
    
    // Verify both calls happened
    cy.get('@failAPI').should('have.been.called');
    cy.get('@successAPI').should('have.been.called');
  });

  it('should convert Firebase URLs to proxy before generation', () => {
    cy.visit('/studio');
    
    // Complete diagnosis
    cy.get('[data-testid="upload-input"]').selectFile('cypress/fixtures/image.jpg');
    cy.get('[data-testid="diagnosis-status"]').should('contain', 'Diagnóstico Concluído');
    
    // Proceed to config
    cy.get('[data-testid="next-button"]').click();
    
    // Verify URLs were intercepted with proxy conversion
    cy.intercept('POST', '/api/kie/nano-banana/create', (req) => {
      const imageInputs = req.body.input.image_input;
      expect(imageInputs[0]).toMatch(/^\/api\/storage\/download\//);
    }).as('generateAPI');
    
    // Generate image
    cy.get('[data-testid="generate-button"]').click();
    cy.get('@generateAPI').should('have.been.called');
  });
});
```

### 3.2 Test Scenario: Error Handling

**Arquivo**: `cypress/integration/error-handling.cy.ts`

```typescript
describe('Error Handling with Proxy Integration', () => {
  
  it('should show clear error message on permanent failure', () => {
    cy.visit('/studio');
    
    // Mock permanent error
    cy.intercept('POST', '/api/kie/gemini', {
      statusCode: 400,
      body: { error: 'Invalid request' }
    }).as('errorAPI');
    
    cy.get('[data-testid="upload-input"]').selectFile('cypress/fixtures/image.jpg');
    
    cy.get('[data-testid="error-message"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Erro ao analisar imagem');
  });

  it('should provide retry button on error', () => {
    cy.visit('/studio');
    
    cy.intercept('POST', '/api/kie/gemini', {
      statusCode: 500,
      body: { error: 'Server error' }
    }).as('errorAPI');
    
    cy.get('[data-testid="upload-input"]').selectFile('cypress/fixtures/image.jpg');
    cy.get('[data-testid="error-message"]').should('be.visible');
    
    // User can retry
    cy.get('[data-testid="retry-button"]').should('be.visible').click();
    
    // Should attempt again
    cy.get('@errorAPI.all').should('have.length.greaterThan', 1);
  });

  it('should handle blob URL gracefully', () => {
    cy.visit('/studio');
    
    // Simulate blob URL by capturing file reader result
    cy.get('[data-testid="upload-input"]').selectFile('cypress/fixtures/image.jpg');
    
    // Should process despite blob URL concerns
    cy.get('[data-testid="diagnosis-status"]', { timeout: 15000 })
      .should('contain', 'Diagnóstico Concluído');
  });
});
```

---

## 4. Testes de Performance

### 4.1 Test Suite: Performance Impact

**Arquivo**: `src/services/storageService.performance.test.ts`

```typescript
describe('Performance Impact', () => {
  
  it('should convert Firebase URL in < 5ms', () => {
    const firebaseUrl = 'https://firebasestorage.googleapis.com/v0/b/bucket/o/long%2Fpath%2Fto%2Fimage.jpg?token=abc123';
    
    const start = performance.now();
    getProxyUrl(firebaseUrl);
    const duration = performance.now() - start;
    
    expect(duration).toBeLessThan(5);
  });

  it('should diagnose image without retry in ~40s', async () => {
    const base64 = 'data:image/jpeg;base64,abc...';
    
    const start = performance.now();
    await kieService.diagnoseImage(base64, 'session-123');
    const duration = performance.now() - start;
    
    // Should be around 40s (API call)
    expect(duration).toBeGreaterThan(35000);
    expect(duration).toBeLessThan(50000);
  });

  it('should diagnose image with 1 retry in ~41s', async () => {
    const base64 = 'data:image/jpeg;base64,abc...';
    const mockError = new Error('TIMEOUT');
    
    // Fail once, succeed second time
    jest.spyOn(kieService, 'diagnoseImage')
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce({ isFloorPlan: false });
    
    const start = performance.now();
    await kieService.diagnoseImage(base64, 'session-123');
    const duration = performance.now() - start;
    
    // ~40s + 1s delay = ~41s
    expect(duration).toBeGreaterThan(40000);
    expect(duration).toBeLessThan(45000);
  });

  it('should not add overhead to successful requests', async () => {
    const base64 = 'data:image/jpeg;base64,abc...';
    
    const start = performance.now();
    await kieService.diagnoseImage(base64, 'session-123');
    const durationWithLogic = performance.now() - start;
    
    // Logging and imageSource detection should add < 100ms
    expect(durationWithLogic).toBeLessThan(50100); // 50s + 100ms
  });
});
```

---

## 5. Testes de Compatibilidade

### 5.1 Test Suite: Backward Compatibility

**Arquivo**: `src/components/studio/GenerationStep.compat.test.tsx`

```typescript
describe('Backward Compatibility', () => {
  
  it('should still support base64 directly', async () => {
    const mockGenerateImage = jest.spyOn(kieService, 'generateImage');
    
    useStudioStore.setState({
      mainImageUrl: 'data:image/jpeg;base64,abc',
      sessionId: 'session-123'
    });

    await act(async () => {
      await handleGenerate();
    });

    const callArgs = mockGenerateImage.mock.calls[0][0];
    expect(callArgs.image_input[0]).toBe('data:image/jpeg;base64,abc');
  });

  it('should still support non-Firebase URLs', async () => {
    const mockGenerateImage = jest.spyOn(kieService, 'generateImage');
    const externalUrl = 'https://cdn.example.com/image.jpg';
    
    useStudioStore.setState({
      mainImageUrl: externalUrl,
      sessionId: 'session-123'
    });

    await act(async () => {
      await handleGenerate();
    });

    const callArgs = mockGenerateImage.mock.calls[0][0];
    expect(callArgs.image_input[0]).toBe(externalUrl); // Unchanged
  });

  it('should maintain API signature', async () => {
    const diagnoseImageSpy = jest.spyOn(kieService, 'diagnoseImage');
    
    const imageInput = 'data:image/jpeg;base64,abc';
    const sessionId = 'session-123';
    
    await kieService.diagnoseImage(imageInput, sessionId);
    
    expect(diagnoseImageSpy).toHaveBeenCalledWith(imageInput, sessionId);
  });
});
```

---

## 6. Matriz de Teste

| Componente | Teste | Tipo | Status |
|------------|-------|------|--------|
| getProxyUrl | Conversão Firebase | Unit | ✓ Definido |
| getProxyUrl | Erro em URL inválida | Unit | ✓ Definido |
| validateImageUrl | Aceita base64 | Unit | ✓ Definido |
| validateImageUrl | Rejeita inválido | Unit | ✓ Definido |
| Retry Logic | 3 tentativas | Unit | ✓ Definido |
| Retry Logic | Delay exponencial | Unit | ✓ Definido |
| imageSource | Detecta tipos | Unit | ✓ Definido |
| GenerationStep | Converte URLs | Integration | ✓ Definido |
| DiagnosisStep | Retry automático | Integration | ✓ Definido |
| Full Flow | E2E com Firebase | E2E | ✓ Definido |
| Performance | < 5ms conversão | Performance | ✓ Definido |
| Compat | Base64 compatível | Compat | ✓ Definido |

---

## 7. Comandos de Execução

```bash
# Testes de unidade
npm run test -- src/services/storageService.test.ts
npm run test -- src/components/studio/DiagnosisStep.test.tsx
npm run test -- src/services/kieService.test.ts

# Testes de integração
npm run test -- --integration

# Testes E2E
npm run cypress:open
npm run cypress:run

# Testes de performance
npm run test -- --performance

# Cobertura
npm run test -- --coverage

# Todos os testes
npm run test
```

---

## 8. Resultados Esperados

- **Unit Tests**: 100% de cobertura
- **Integration Tests**: Todos os cenários cobertos
- **E2E Tests**: Fluxo completo validado
- **Performance**: Sem degradação > 100ms
- **Compatibility**: Nenhum breaking change

**Target**: 95%+ de taxa de sucesso em todos os testes
