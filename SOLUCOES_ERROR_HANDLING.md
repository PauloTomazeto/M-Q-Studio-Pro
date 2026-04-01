# Soluções: Error Handling na Geração de Imagens

## Solução 1: Adicionar Timeouts em server.ts

### Antes (INSEGURO)
```typescript
// Linha 104-113: /api/kie/nano-banana/create
const response = await axios.post(
  "https://api.kie.ai/api/v1/jobs/createTask",
  req.body,
  {
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
  }
);
```

### Depois (SEGURO)
```typescript
// Linha 104-113: /api/kie/nano-banana/create
const response = await axios.post(
  "https://api.kie.ai/api/v1/jobs/createTask",
  req.body,
  {
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 30000, // 30 segundos para criação de tarefa
  }
);
```

### Antes (INSEGURO)
```typescript
// Linha 124-138: /api/kie/nano-banana/status/:taskId
app.get("/api/kie/nano-banana/status/:taskId", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.kie.ai/api/v1/jobs/getTask?taskId=${req.params.taskId}`,
      {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
```

### Depois (SEGURO)
```typescript
// Linha 124-138: /api/kie/nano-banana/status/:taskId
app.get("/api/kie/nano-banana/status/:taskId", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.kie.ai/api/v1/jobs/getTask?taskId=${req.params.taskId}`,
      {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
        },
        timeout: 10000, // 10 segundos para polling
      }
    );
    res.json(response.data);
  } catch (error: any) {
```

---

## Solução 2: Adicionar Máximo de Tentativas de Polling

### Antes (POLLING INFINITO)
```typescript
// GenerationStep.tsx linhas 184-237
if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
pollingIntervalRef.current = setInterval(async () => {
  try {
    const task = await kieService.getTaskStatus(taskId);
    
    if (task.status === 'completed' || task.status === 'success') {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      // ... success handling
    } else if (task.status === 'failed' || task.status === 'error') {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      // ... error handling
    }
    // ❌ SE STATUS FOR 'processing' OU 'queued', CONTINUA INDEFINIDAMENTE
  } catch (err: any) {
    console.error('Polling error:', err);
    // ❌ NENHUMA LÓGICA DE TIMEOUT, POLLING CONTINUA
  }
}, 5000);
```

### Depois (COM MÁXIMO DE TENTATIVAS)
```typescript
// GenerationStep.tsx linhas 184-237
const MAX_POLLING_ATTEMPTS = 240;  // 20 minutos (240 * 5s)
const GENERATION_TIMEOUT = 1200000; // 20 minutos em ms
let pollingAttempts = 0;
const generationStartTime = Date.now();

if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
pollingIntervalRef.current = setInterval(async () => {
  pollingAttempts++;
  const elapsedTime = Date.now() - generationStartTime;
  
  // Verificar timeout global
  if (elapsedTime > GENERATION_TIMEOUT) {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    const timeoutError = `Geração excedeu tempo limite de ${GENERATION_TIMEOUT / 60000} minutos`;
    setGenerationTask({
      taskId,
      status: 'failed',
      progress: 0,
      error: timeoutError
    });
    setIsGenerating(false);
    await refundCredits(cost, 'generation_timeout');
    toast.error(timeoutError);
    return;
  }
  
  // Verificar máximo de tentativas
  if (pollingAttempts > MAX_POLLING_ATTEMPTS) {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    const maxAttemptsError = `Geração expirou após ${MAX_POLLING_ATTEMPTS * 5}s de polling`;
    setGenerationTask({
      taskId,
      status: 'failed',
      progress: 0,
      error: maxAttemptsError
    });
    setIsGenerating(false);
    await refundCredits(cost, 'generation_max_polls');
    toast.error(maxAttemptsError);
    return;
  }
  
  try {
    const task = await kieService.getTaskStatus(taskId);
    
    if (task.status === 'completed' || task.status === 'success') {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      const resultUrl = task.works?.[0]?.url || task.result_url;
      
      setGenerationTask({
        taskId,
        status: 'completed',
        progress: 100,
        stage: 'Concluído!',
        resultUrl
      });
      setIsGenerating(false);

      if (sessionId) {
        updateDoc(doc(db, 'generation_sessions', sessionId), {
          userId: auth.currentUser?.uid,
          generationResultUrl: resultUrl,
          generationStatus: 'completed',
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).catch(e => console.warn('Falha ao concluir sessão no Firestore:', e));
      }
    } else if (task.status === 'failed' || task.status === 'error') {
      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      
      setGenerationTask({
        taskId,
        status: 'failed',
        progress: 0,
        error: task.msg || 'Falha na geração da imagem.'
      });
      setIsGenerating(false);
      await refundCredits(cost, 'generation_failed');

      if (sessionId) {
        updateDoc(doc(db, 'generation_sessions', sessionId), {
          userId: auth.currentUser?.uid,
          generationStatus: 'failed',
          generationError: task.msg || 'Falha na geração da imagem.',
          updatedAt: new Date().toISOString()
        }).catch(e => console.warn('Falha ao reportar erro no Firestore:', e));
      }
    }
    // ✅ SE STATUS FOR 'processing' OU 'queued', CONTINUA ATÉ MAX_POLLING_ATTEMPTS OU TIMEOUT
  } catch (err: any) {
    console.error(`Polling error (attempt ${pollingAttempts}/${MAX_POLLING_ATTEMPTS}) for task ${taskId}:`, {
      status: err.response?.status,
      message: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    });
    // ✅ POLLING CONTINUA COM LOG ESTRUTURADO
  }
}, 5000);
```

---

## Solução 3: Validação Robusta de Respostas

### Antes (INSEGURO)
```typescript
// kieService.ts linhas 613-617
async generateImage(params: {...}) {
  const response = await axios.post('/api/kie/nano-banana/create', {
    model: params.model,
    input: {
      prompt: params.prompt,
      image_input: params.image_input || [],
      aspect_ratio: params.aspect_ratio,
      resolution: params.resolution,
      output_format: 'jpg'
    }
  });
  
  if (response.data.code !== 200) {
    throw new Error(response.data.msg || "Failed to create generation task");
  }
  
  return response.data.data.taskId; // ❌ Pode ser undefined
}
```

### Depois (SEGURO)
```typescript
// kieService.ts linhas 613-627
async generateImage(params: {...}) {
  const response = await axios.post('/api/kie/nano-banana/create', {
    model: params.model,
    input: {
      prompt: params.prompt,
      image_input: params.image_input || [],
      aspect_ratio: params.aspect_ratio,
      resolution: params.resolution,
      output_format: 'jpg'
    }
  });
  
  // ✅ Validação estruturada
  if (!response.data) {
    throw new Error("Empty response from KIE API");
  }
  
  const { code, msg, data } = response.data;
  
  if (code !== 200) {
    const errorMsg = msg || data?.error || "Failed to create generation task";
    throw new Error(`KIE API Error (${code}): ${errorMsg}`);
  }
  
  if (!data?.taskId) {
    throw new Error("Invalid response structure: missing taskId");
  }
  
  console.log('[kieService] Task created successfully:', data.taskId);
  return data.taskId;
}

async getTaskStatus(taskId: string) {
  const response = await axios.get(`/api/kie/nano-banana/status/${taskId}`);
  
  // ✅ Validação estruturada
  if (!response.data) {
    throw new Error("Empty response from KIE status API");
  }
  
  const { code, msg, data } = response.data;
  
  if (code !== 200) {
    const errorMsg = msg || data?.error || "Failed to get task status";
    throw new Error(`KIE Status Error (${code}): ${errorMsg}`);
  }
  
  if (!data) {
    throw new Error("Invalid response structure: missing data field");
  }
  
  // ✅ Validar status
  if (!['queued', 'processing', 'completed', 'success', 'failed', 'error'].includes(data.status)) {
    console.warn('Unexpected task status:', data.status);
  }
  
  return data;
}
```

---

## Solução 4: Logging Estruturado

### Antes (VAGO)
```typescript
} catch (err: any) {
  console.error('Polling error:', err);
}
```

### Depois (ESTRUTURADO)
```typescript
} catch (err: any) {
  const statusCode = err.response?.status || err.code || 'unknown';
  const errorMsg = err.response?.data?.msg || err.message || 'Unknown error';
  
  console.error('[GenerationStep] Polling failed', {
    taskId,
    attemptNumber: pollingAttempts,
    elapsedSeconds: Math.floor((Date.now() - generationStartTime) / 1000),
    statusCode,
    errorMessage: errorMsg,
    errorCode: err.code,
    errorType: err.response?.status ? 'HTTP_ERROR' : 'NETWORK_ERROR',
    timestamp: new Date().toISOString()
  });
  
  // ✅ Opcional: reporte para analytics/sentry
  // captureException({
  //   context: 'image_generation_polling',
  //   taskId,
  //   attemptNumber: pollingAttempts,
  //   statusCode
  // });
}
```

---

## Solução 5: Tratamento Diferenciado de Erros para Refund

### Antes (REFUND SEMPRE)
```typescript
} catch (err: any) {
  console.error(err);
  if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  setGenerationTask({
    taskId: 'error',
    status: 'failed',
    progress: 0,
    error: err.message || 'Erro ao iniciar geração.'
  });
  setIsGenerating(false);
  await refundCredits(cost, 'generation_init_failed'); // ❌ SEMPRE REFUND
}
```

### Depois (REFUND CONDICIONAL)
```typescript
} catch (err: any) {
  console.error('[GenerationStep] Generation failed:', err);
  
  if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  
  const errorMsg = err.message || 'Erro ao iniciar geração.';
  const statusCode = err.response?.status;
  
  // Determinar se deve fazer refund
  const shouldRefund = 
    statusCode >= 500 ||  // Erro de servidor
    statusCode === 502 ||
    statusCode === 503 ||
    statusCode === 504 ||
    err.code === 'ECONNREFUSED' ||  // Conexão recusada
    err.code === 'ENOTFOUND' ||     // DNS não encontrado
    err.code === 'ETIMEDOUT' ||     // Timeout
    err.message?.includes('timeout');
  
  const noRefundReasons = [
    'insufficient',      // Créditos insuficientes
    'unauthorized',      // Falta de autenticação
    'forbidden',         // Proibido
    'validation'         // Erro de validação
  ];
  
  const shouldNotRefund = noRefundReasons.some(reason => 
    errorMsg.toLowerCase().includes(reason)
  );
  
  const refundReason = shouldRefund ? 'generation_server_error' :
                       shouldNotRefund ? 'generation_user_error' :
                       'generation_unknown_error';
  
  setGenerationTask({
    taskId: 'error',
    status: 'failed',
    progress: 0,
    error: errorMsg
  });
  setIsGenerating(false);
  
  // ✅ REFUND CONDICIONAL
  if (shouldRefund && !shouldNotRefund) {
    console.log(`[GenerationStep] Refunding credits (${refundReason})`);
    await refundCredits(cost, refundReason);
    toast.info('Créditos reembolsados devido a erro do servidor');
  } else if (shouldNotRefund) {
    console.log(`[GenerationStep] NOT refunding credits (${refundReason})`);
    toast.error(errorMsg);
  }
}
```

---

## Solução 6: Validação em server.ts

### Antes (HTTP 200 COM ERRO SEMÂNTICO)
```typescript
const response = await axios.post(
  "https://api.kie.ai/api/v1/jobs/createTask",
  req.body,
  {
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
  }
);
console.log("[KIE Proxy] Nano Banana Success:", response.data.code);
res.json(response.data); // ❌ HTTP 200 mesmo se code !== 200
```

### Depois (VALIDAÇÃO ADEQUADA)
```typescript
const response = await axios.post(
  "https://api.kie.ai/api/v1/jobs/createTask",
  req.body,
  {
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  }
);

// ✅ Validar code mesmo com HTTP 200
if (response.data?.code !== 200) {
  const statusCode = response.data?.code || 'unknown';
  const errorMsg = response.data?.msg || 'Unknown error from KIE API';
  
  console.error("[KIE Proxy] Nano Banana API Error:", {
    code: statusCode,
    message: errorMsg,
    fullResponse: response.data
  });
  
  // Retornar com HTTP apropriado baseado no code da API
  const httpStatus = statusCode === 401 ? 401 :
                     statusCode === 403 ? 403 :
                     statusCode === 404 ? 404 :
                     statusCode === 429 ? 429 :
                     statusCode >= 500 ? 502 :
                     400;
  
  return res.status(httpStatus).json({
    code: statusCode,
    msg: errorMsg,
    error: true
  });
}

console.log("[KIE Proxy] Nano Banana Success:", response.data.code);
res.status(200).json(response.data);
```

---

## Checklist de Implementação

### P0 (Imediato)
- [ ] Adicionar `timeout: 30000` em POST `/api/kie/nano-banana/create`
- [ ] Adicionar `timeout: 10000` em GET `/api/kie/nano-banana/status/:taskId`
- [ ] Adicionar `MAX_POLLING_ATTEMPTS = 240` em GenerationStep.tsx
- [ ] Adicionar `GENERATION_TIMEOUT = 1200000` em GenerationStep.tsx
- [ ] Limpar polling após timeout ou máximo de tentativas

### P1 (Curto Prazo)
- [ ] Validar `response.data.code`, `msg`, `data` em kieService.ts
- [ ] Adicionar logging estruturado com taskId, tentativa, status em GenerationStep.tsx
- [ ] Implementar refund condicional baseado no tipo de erro

### P2 (Médio Prazo)
- [ ] Centralizar tratamento KIE em classe/service separada
- [ ] Implementar retry automático com backoff exponencial
- [ ] Adicionar analytics/sentry para tracking de erros

---

## Testes Recomendados

1. **Teste de Timeout:**
   - Mock axios para delay de 40s em POST `/api/kie/nano-banana/create`
   - Verificar se erro é retornado após 30s
   - Verificar se UI não fica congelada

2. **Teste de Polling Timeout:**
   - Mock axios para retornar `{ code: 200, data: { status: 'processing' } }` indefinidamente
   - Verificar se polling para após 240 tentativas (20 minutos)
   - Verificar se créditos são reembolsados

3. **Teste de Resposta Inválida:**
   - Mock axios para retornar `{ code: 200, data: null }`
   - Verificar se erro apropriado é lançado
   - Verificar se log contém contexto útil

4. **Teste de Erro de Refund:**
   - Simular erro 500 na criação da tarefa
   - Verificar se créditos são reembolsados
   - Verificar se usuário recebe mensagem clara

5. **Teste de Erro Temporário:**
   - Simular timeout de rede no polling
   - Verificar se polling continua (não desiste na primeira tentativa)
   - Verificar se logs mostram tentativa número
