# Localizações dos Gaps - Error Handling Geração de Imagens

## Índice Rápido

| Gap | Arquivo | Linhas | Tipo | Solução | Tempo |
|-----|---------|--------|------|---------|-------|
| 1 | server.ts | 104-113 | Timeout ausente | Adicionar timeout: 30000 | 2 min |
| 2 | server.ts | 124-138 | Timeout ausente | Adicionar timeout: 10000 | 2 min |
| 3 | GenerationStep.tsx | 184-237 | Polling infinito | Adicionar MAX_ATTEMPTS + timeout global | 10 min |
| 4 | kieService.ts | 613-627 | Validação fraca | Validar response.data.code/msg | 5 min |
| 5 | kieService.ts | 617, 627 | Validação de estrutura | Validar response.data.data não null | 5 min |
| 6 | GenerationStep.tsx | 234-236 | Logging vago | Adicionar taskId, tentativa, status | 5 min |
| 7 | GenerationStep.tsx | 239-250 | Refund incorreto | Diferenciar por statusCode | 10 min |
| 8 | server.ts | 116-120 | HTTP 200 + erro semântico | Validar code em server.ts | 5 min |

---

## Detalhe de Cada Gap

### GAP 1: FALTA DE TIMEOUT - POST /api/kie/nano-banana/create

**Arquivo:** `server.ts`
**Linhas:** 104-113
**Severidade:** CRÍTICO

**Trecho Atual:**
```typescript
104    try {
105      const response = await axios.post(
106        "https://api.kie.ai/api/v1/jobs/createTask",
107        req.body,
108        {
109          headers: {
110            Authorization: `Bearer ${KIE_API_KEY}`,
111            "Content-Type": "application/json",
112          },
113          // ❌ FALTA AQUI: timeout: 30000
114        }
115      );
```

**Solução:**
Adicionar na linha 113 (antes da chave de fechamento do config):
```typescript
timeout: 30000, // 30 segundos
```

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/server.ts`

---

### GAP 2: FALTA DE TIMEOUT - GET /api/kie/nano-banana/status/:taskId

**Arquivo:** `server.ts`
**Linhas:** 124-138
**Severidade:** CRÍTICO

**Trecho Atual:**
```typescript
124  app.get("/api/kie/nano-banana/status/:taskId", async (req, res) => {
125    try {
126      const response = await axios.get(
127        `https://api.kie.ai/api/v1/jobs/getTask?taskId=${req.params.taskId}`,
128        {
129          headers: {
130            Authorization: `Bearer ${KIE_API_KEY}`,
131          },
132          // ❌ FALTA AQUI: timeout: 10000
133        }
134      );
```

**Solução:**
Adicionar na linha 132 (antes da chave de fechamento do config):
```typescript
timeout: 10000, // 10 segundos
```

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/server.ts`

---

### GAP 3: POLLING INFINITO SEM MÁXIMO DE TENTATIVAS

**Arquivo:** `src/components/studio/GenerationStep.tsx`
**Linhas:** 184-237
**Severidade:** CRÍTICO

**Trecho Atual (início):**
```typescript
183      // Start polling
184      if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
185      pollingIntervalRef.current = setInterval(async () => {
186        try {
187          const task = await kieService.getTaskStatus(taskId);
188          
189          if (task.status === 'completed' || task.status === 'success') {
190            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
191            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            // ... success path
213          } else if (task.status === 'failed' || task.status === 'error') {
214            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
215            if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
            // ... error path
233          }
234          // ❌ SE NÃO FOR completed/failed/error, CONTINUA INDEFINIDAMENTE
235        } catch (err: any) {
236          console.error('Polling error:', err);
237          // ❌ NENHUMA AÇÃO - POLLING CONTINUA
238        }
239      }, 5000);
```

**Solução:**
Adicionar após linha 183:
```typescript
const MAX_POLLING_ATTEMPTS = 240;  // 20 minutos (240 * 5s)
const GENERATION_TIMEOUT = 1200000; // 20 minutos em ms
let pollingAttempts = 0;
const generationStartTime = Date.now();
```

E adicionar verificação no início do `setInterval` callback (após linha 185):
```typescript
pollingAttempts++;
const elapsedTime = Date.now() - generationStartTime;

if (elapsedTime > GENERATION_TIMEOUT || pollingAttempts > MAX_POLLING_ATTEMPTS) {
  // Clear intervals e mostrar erro
  // refund credits
  // return
}
```

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/src/components/studio/GenerationStep.tsx`

---

### GAP 4: TRATAMENTO INCONSISTENTE DE response.data.code

**Arquivo:** `src/services/kieService.ts`
**Linhas:** 613-627
**Severidade:** ALTO

**Método: generateImage**
```typescript
602    const response = await axios.post('/api/kie/nano-banana/create', {
      // ... request body
611    });
612    
613    if (response.data.code !== 200) {
614      throw new Error(response.data.msg || "Failed to create generation task");
615    }
    // ❌ PROBLEMA: response.data pode ser undefined
    // ❌ PROBLEMA: msg pode ser vazio string ""
616    
617    return response.data.data.taskId;
618  },

620  async getTaskStatus(taskId: string) {
621    const response = await axios.get(`/api/kie/nano-banana/status/${taskId}`);
622    
623    if (response.data.code !== 200) {
624      throw new Error(response.data.msg || "Failed to get task status");
625    }
    // ❌ MESMO PROBLEMA AQUI
626    
627    return response.data.data;
628  },
```

**Solução:**
Alterar linhas 613-615 para:
```typescript
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
```

E alterar linhas 623-625 similarmente.

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/src/services/kieService.ts`

---

### GAP 5: FALTA DE VALIDAÇÃO DE response.data.data

**Arquivo:** `src/services/kieService.ts`
**Linhas:** 617, 627
**Severidade:** ALTO

**Problema:**
```typescript
617    return response.data.data.taskId;  // ❌ Se data === null, erro
627    return response.data.data;          // ❌ Se data === null, propagado inválido
```

**Solução:**
Ver GAP 4 - a mesma solução cobre os dois gaps.

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/src/services/kieService.ts`

---

### GAP 6: LOGGING INSUFICIENTE EM POLLING

**Arquivo:** `src/components/studio/GenerationStep.tsx`
**Linhas:** 234-236
**Severidade:** MÉDIO

**Trecho Atual:**
```typescript
234        } catch (err: any) {
235          console.error('Polling error:', err);
236        }
```

**Problema:** Log genérico "Polling error: [object Object]" sem contexto

**Solução:**
Substituir linhas 235:
```typescript
console.error('[GenerationStep] Polling failed', {
  taskId,
  attemptNumber: pollingAttempts,
  elapsedSeconds: Math.floor((Date.now() - generationStartTime) / 1000),
  statusCode: err.response?.status || err.code || 'unknown',
  errorMessage: err.response?.data?.msg || err.message,
  timestamp: new Date().toISOString()
});
```

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/src/components/studio/GenerationStep.tsx`

---

### GAP 7: REFUND INCORRETO - SEM DIFERENCIAÇÃO POR TIPO DE ERRO

**Arquivo:** `src/components/studio/GenerationStep.tsx`
**Linhas:** 239-250
**Severidade:** MÉDIO

**Trecho Atual:**
```typescript
239    } catch (err: any) {
240      console.error(err);
241      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
242      setGenerationTask({
243        taskId: 'error',
244        status: 'failed',
245        progress: 0,
246        error: err.message || 'Erro ao iniciar geração.'
247      });
248      setIsGenerating(false);
249      await refundCredits(cost, 'generation_init_failed');  // ❌ SEMPRE REFUND
250    }
```

**Problema:** Refund ocorre mesmo para erros de usuário (validação, créditos insuficientes)

**Solução:**
Adicionar lógica condicional antes de `refundCredits`:
```typescript
const statusCode = err.response?.status;
const shouldRefund = 
  statusCode >= 500 ||  // Erro de servidor
  err.code === 'ECONNREFUSED' ||  // Conexão recusada
  err.code === 'ETIMEDOUT';  // Timeout

const noRefundReasons = ['insufficient', 'unauthorized', 'forbidden', 'validation'];
const shouldNotRefund = noRefundReasons.some(reason => 
  err.message?.toLowerCase().includes(reason)
);

if (shouldRefund && !shouldNotRefund) {
  await refundCredits(cost, 'generation_server_error');
}
```

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/src/components/studio/GenerationStep.tsx`

---

### GAP 8: HTTP 200 COM ERRO SEMÂNTICO

**Arquivo:** `server.ts`
**Linhas:** 116-120
**Severidade:** BAIXO

**Trecho Atual:**
```typescript
114      console.log("[KIE Proxy] Nano Banana Success:", response.data.code);
115      res.json(response.data);  // ❌ HTTP 200 mesmo se code !== 200
116    } catch (error: any) {
117      const status = error.response?.status || 500;
```

**Problema:**
Se KIE retorna `{ code: 401, msg: "Unauthorized" }` com HTTP 200, passa direto para cliente como sucesso.

**Solução:**
Adicionar validação antes de linha 115:
```typescript
if (response.data?.code !== 200) {
  const statusCode = response.data?.code || 'unknown';
  const errorMsg = response.data?.msg || 'Unknown error';
  
  const httpStatus = statusCode === 401 ? 401 :
                     statusCode === 403 ? 403 :
                     statusCode === 429 ? 429 :
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

**Arquivo Completo:** `/c/Users/Usuario/Music/MQ STUDIO PRO/server.ts`

---

## Arquivos Afetados

### 1. `/c/Users/Usuario/Music/MQ STUDIO PRO/server.ts`
- GAP 1 (linhas 104-113)
- GAP 2 (linhas 124-138)
- GAP 8 (linhas 116-120)

### 2. `/c/Users/Usuario/Music/MQ STUDIO PRO/src/services/kieService.ts`
- GAP 4 (linhas 613-627)
- GAP 5 (linhas 617, 627)

### 3. `/c/Users/Usuario/Music/MQ STUDIO PRO/src/components/studio/GenerationStep.tsx`
- GAP 3 (linhas 184-237)
- GAP 6 (linhas 234-236)
- GAP 7 (linhas 239-250)

---

## Plano de Implementação

### Fase 1: P0 (HOJE - 15 minutos)
1. server.ts: Adicionar timeout em 2 endpoints (GAP 1, 2) - 4 min
2. GenerationStep.tsx: Adicionar MAX_POLLING_ATTEMPTS (GAP 3) - 10 min
3. **Testar:** Verificar se timeouts funcionam

### Fase 2: P1 (próximas 2 horas)
4. kieService.ts: Validar response estruturalmente (GAP 4, 5) - 10 min
5. GenerationStep.tsx: Logging estruturado (GAP 6) - 5 min
6. GenerationStep.tsx: Refund condicional (GAP 7) - 10 min
7. **Testar:** Cenários de erro, validação de refund

### Fase 3: P2 (próximas 2 semanas)
8. server.ts: Validar code em POST (GAP 8) - 5 min
9. **Testar:** Resposta com HTTP 200 + code !== 200

---

## Checklist de Validação

### Após Implementação
- [ ] Todos os axios calls têm timeout apropriado
- [ ] Polling tem máximo de tentativas (240)
- [ ] Polling tem timeout global (1200s)
- [ ] Response validation previne undefined access
- [ ] Logs estruturados contêm taskId e tentativa número
- [ ] Refund condicional por tipo de erro
- [ ] HTTP status code corresponde ao erro semântico
- [ ] Testes cobrem 6+ cenários de erro

### Em Produção
- [ ] Menos de 0.1% de gerações travadas
- [ ] Menos de 5% de refunds incorretos
- [ ] Média de 30s para timeout vs 5+ minutos antes
- [ ] Logs permitem diagnosticar erro em <5 minutos
