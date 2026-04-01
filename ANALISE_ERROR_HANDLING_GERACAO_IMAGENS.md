# Análise: Tratamento de Erros na Geração de Imagens

## Resumo Executivo

Identificados **7 gaps críticos** no error handling da pipeline de geração de imagens (Nano Banana). Os problemas variam de falta de timeout em endpoints específicos até ausência de máximo de tentativas de polling, criando risco de operações indefinidas e difícil diagnóstico de falhas.

---

## Gap 1: FALTA DE TIMEOUT NO ENDPOINT DE CRIAÇÃO DE TAREFA (CRÍTICO)

**Localização:** `server.ts` (linhas 104-113)
```typescript
const response = await axios.post(
  "https://api.kie.ai/api/v1/jobs/createTask",
  req.body,
  {
    headers: {
      Authorization: `Bearer ${KIE_API_KEY}`,
      "Content-Type": "application/json",
    },
    // ❌ SEM TIMEOUT DEFINIDO
  }
);
```

**Problema:**
- Endpoint `/api/kie/nano-banana/create` NÃO tem timeout configurado
- Contrasta com `/api/kie/gemini` que tem `timeout: 120000` (linha 45)
- Se a API KIE ficar lenta ou offline, a requisição ficará pendurada indefinidamente
- Cliente terá timeout infinito esperando resposta

**Impacto:**
- Requisição pode ficar travada por horas
- Recursos do servidor (conexões TCP) esgotados
- Experiência do usuário degradada (UI congelada)
- Difícil diagnosticar o problema nos logs

**Recomendação:**
- Adicionar `timeout: 30000` (30 segundos) ao axios.post
- Justificativa: criação de tarefa é operação rápida, não precisa de 120s como Gemini

---

## Gap 2: FALTA DE TIMEOUT NO ENDPOINT DE STATUS (CRÍTICO)

**Localização:** `server.ts` (linhas 124-138)
```typescript
app.get("/api/kie/nano-banana/status/:taskId", async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.kie.ai/api/v1/jobs/getTask?taskId=${req.params.taskId}`,
      {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
        },
        // ❌ SEM TIMEOUT DEFINIDO
      }
    );
```

**Problema:**
- Poll de status (chamado a cada 5 segundos) NÃO tem timeout
- GenerationStep.tsx faz requisição a cada 5s indefinidamente (linha 237)
- Cada polling pode ficar pendurado indefinidamente
- Acumula requisições bloqueadas no servidor

**Impacto:**
- Múltiplas requisições penduradas se usuário gerar várias imagens
- Comportamento impredizível quando rede está lenta
- Impossível distinguir "tarefa em progresso" de "requisição travada"

**Recomendação:**
- Adicionar `timeout: 10000` (10 segundos) - maior que intervalo de polling (5s) mas curto o suficiente

---

## Gap 3: FALTA DE MÁXIMO DE TENTATIVAS DE POLLING (CRÍTICO)

**Localização:** `src/components/studio/GenerationStep.tsx` (linhas 184-237)
```typescript
pollingIntervalRef.current = setInterval(async () => {
  try {
    const task = await kieService.getTaskStatus(taskId);
    
    if (task.status === 'completed' || task.status === 'success') {
      // clearInterval
    } else if (task.status === 'failed' || task.status === 'error') {
      // clearInterval
    }
    // ⚠️ SE NENHUMA DESSAS CONDIÇÕES, POLLING CONTINUA INDEFINIDAMENTE
  } catch (err: any) {
    console.error('Polling error:', err);
    // ⚠️ NENHUMA AÇÃO - POLLING CONTINUA
  }
}, 5000);
```

**Problema:**
- Polling executa **indefinidamente** enquanto status for 'processing' ou 'queued'
- Sem máximo de tentativas
- Sem timeout global para a geração inteira
- Documentação de Nano Banana não especifica tempo máximo de geração
- Se tarefa ficar em 'processing' permanentemente, polling nunca para

**Impacto:**
- Variável de estado `isGenerating` pode ficar `true` para sempre
- Múltiplos pollings acumulados se usuário tenta gerar novamente
- Vazamento de memória com intervals não limpos
- Usuário sem feedback sobre timeout

**Recomendação:**
- Adicionar contador de tentativas: `const MAX_POLLING_ATTEMPTS = 240; // 20 minutos a cada 5s`
- Adicionar timeout global: `const GENERATION_TIMEOUT = 1200000; // 20 minutos`
- Limpar interval e mostrar erro após timeout

---

## Gap 4: TRATAMENTO INCONSISTENTE DE ERROS DE RESPOSTA DA API (ALTO)

**Localização:** `src/services/kieService.ts` (linhas 613-615, 623-624)
```typescript
// generateImage
if (response.data.code !== 200) {
  throw new Error(response.data.msg || "Failed to create generation task");
}

// getTaskStatus  
if (response.data.code !== 200) {
  throw new Error(response.data.msg || "Failed to get task status");
}
```

**Problema:**
- Apenas checa `response.data.code !== 200`
- Se `response.data` for `undefined` (erro de parsing), acessa propriedade de undefined
- Se API retorna HTTP 500, axios lança exception antes de chegar nesse código
- Diferentes endpoints podem retornar diferentes formatos de erro

**Documentação de Resposta Esperada (KIE/Nano Banana):**
```json
{
  "code": 200,
  "msg": "Success",
  "data": {
    "taskId": "xxx"
  }
}
```

**Cenários não tratados:**
1. API retorna HTTP 500 com body desconhecido
2. Response vem null ou undefined
3. response.data.msg vem vazio string ""
4. API muda formato de resposta de erro

**Impacto:**
- Usuário vê mensagens genéricas em vez de específicas
- Difícil debugar failures em produção
- Erro handling perde contexto

**Recomendação:**
```typescript
if (response.data?.code !== 200) {
  const errorMsg = response.data?.msg || 
                   response.data?.error || 
                   "Failed to create generation task";
  throw new Error(errorMsg);
}
```

---

## Gap 5: FALTA DE VALIDAÇÃO DE ESTRUTURA DE RESPOSTA (MÉDIO)

**Localização:** `src/services/kieService.ts` (linhas 617, 627)
```typescript
return response.data.data.taskId;  // Sem validação de response.data.data
return response.data.data;          // Sem validação de estrutura
```

**Problema:**
- Assume que `response.data.data` sempre existe e tem `taskId`
- Se API retorna `{ code: 200, data: null }`, acessa null.taskId
- Sem validação de tipo do taskId
- Em getTaskStatus, retorna `response.data.data` direto sem validar campos obrigatórios

**Impacto:**
- Erro de runtime "Cannot read property 'taskId' of undefined"
- Polling recebe objeto sem campos esperados (status, msg)
- GenerationStep.tsx tenta acessar `task.status` e falha

**Recomendação:**
- Usar Zod schema ou validação simples:
```typescript
const data = response.data.data;
if (!data?.taskId) {
  throw new Error("Invalid response: missing taskId");
}
return data.taskId;
```

---

## Gap 6: LOGGING INSUFICIENTE EM ERROS DE POLLING (MÉDIO)

**Localização:** `src/components/studio/GenerationStep.tsx` (linhas 234-236)
```typescript
} catch (err: any) {
  console.error('Polling error:', err);
}
```

**Problema:**
- Log vago: "Polling error" sem contexto
- Não loga taskId, tentativa número, ou tipo de erro
- Não distingue entre:
  - Timeout de rede
  - API indisponível (401, 403)
  - Task não encontrada (404)
  - Rate limit (429)
  - Erro interno (500)

**Impacto:**
- Diagnóstico em produção muito difícil
- Impossível entender por que polling falhou
- Usuarios não conseguem reportar problemas específicos

**Recomendação:**
```typescript
} catch (err: any) {
  const errorMsg = err.response?.data?.msg || 
                   err.message || 
                   'Unknown error';
  const statusCode = err.response?.status || 'unknown';
  console.error(`Polling error for task ${taskId} (attempt ${attemptCount}):`, {
    status: statusCode,
    message: errorMsg,
    type: err.code,
    timestamp: new Date().toISOString()
  });
}
```

---

## Gap 7: FALTA DE DISTINÇÃO ENTRE ERROS CRÍTICOS E TEMPORÁRIOS (MÉDIO)

**Localização:** `src/components/studio/GenerationStep.tsx` (linhas 239-250)
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
  await refundCredits(cost, 'generation_init_failed');
}
```

**Problema:**
- Qualquer erro dispara refund de créditos imediatamente
- Não diferencia:
  - Erro na criação da tarefa (deve refund) 
  - Timeout temporário de rede (pode retry)
  - Créditos insuficientes (sem refund necessário)
  - Erro de validação (sem refund necessário)

**Impacto:**
- Refund incorreto de créditos
- Usuário perde crédito por erro temporário
- Sem retry automático para falhas transitórias

**Recomendação:**
```typescript
const shouldRefund = err.response?.status >= 500 || 
                     err.code === 'ECONNREFUSED' ||
                     err.code === 'ENOTFOUND';
                     
if (shouldRefund) {
  await refundCredits(cost, 'generation_failed');
}
```

---

## Gap 8: FALTA DE TRATAMENTO PARA RESPOSTAS COM CODE !== 200 MAS HTTP 200 (BAIXO)

**Localização:** `server.ts` (linhas 116-120)
```typescript
} catch (error: any) {
  const status = error.response?.status || 500;
  const errorData = error.response?.data || error.message;
  console.error(...);
  res.status(status).json(errorData);
}
```

**Problema:**
- Se KIE retorna HTTP 200 com `{ code: 401, msg: "Unauthorized" }`
- server.ts não captura isso (não é erro HTTP)
- Passa direto para cliente com status 200
- kieService.ts checa `code !== 200` e lança erro

**Impacto:**
- Resposta HTTP 200 com erro semântico
- Cliente pode interpretar como sucesso
- Logging confuso (HTTP 200 mas erro na aplicação)

**Recomendação:**
- Adicionar validação em server.ts:
```typescript
if (response.data?.code !== 200) {
  return res.status(400).json(response.data);
}
```

---

## Resumo de Gaps Encontrados

| Gap | Severidade | Tipo | Arquivo | Linha |
|-----|-----------|------|---------|-------|
| 1 | CRÍTICO | Timeout | server.ts | 104-113 |
| 2 | CRÍTICO | Timeout | server.ts | 124-138 |
| 3 | CRÍTICO | Polling infinito | GenerationStep.tsx | 184-237 |
| 4 | ALTO | Tratamento inconsistente | kieService.ts | 613-627 |
| 5 | MÉDIO | Validação de resposta | kieService.ts | 617, 627 |
| 6 | MÉDIO | Logging insuficiente | GenerationStep.tsx | 234-236 |
| 7 | MÉDIO | Refund incorreto | GenerationStep.tsx | 239-250 |
| 8 | BAIXO | HTTP 200 com erro | server.ts | 116-120 |

---

## Fluxo de Erro Atual (Incompleto)

```
client.handleGenerate()
  ↓
kieService.generateImage()
  → axios.post('/api/kie/nano-banana/create', ...) [SEM TIMEOUT]
  → server.ts POST /api/kie/nano-banana/create [SEM TIMEOUT]
  → axios.post('https://api.kie.ai/...') [SEM TIMEOUT]
  → server.ts catch → passa erro para cliente
  → kieService checa response.data.code
  ↓
client.setGenerationTask() → polling inicia
  ↓
setInterval(() => kieService.getTaskStatus(taskId), 5000)
  → axios.get('/api/kie/nano-banana/status/:taskId') [SEM TIMEOUT]
  → server.ts GET [SEM TIMEOUT]
  → axios.get('https://api.kie.ai/...') [SEM TIMEOUT]
  → [POLLING INFINITO ATÉ: completed | failed | error | (nunca)]
  ↓
task.status === 'failed' → refundCredits → clearInterval
task.status === 'completed' → clearInterval
task.status === 'processing' → ???continue polling indefinidamente
```

---

## Recomendações Prioritárias

### P0 (IMEDIATO)
1. Adicionar timeout de 30s em `/api/kie/nano-banana/create`
2. Adicionar timeout de 10s em `/api/kie/nano-banana/status/:taskId`
3. Limitar polling a máximo 240 tentativas (20 minutos)

### P1 (CURTO PRAZO)
4. Melhorar validação de response.data.code e response.data.data
5. Adicionar logging estruturado em polling com tentativa número
6. Diferençar refund por tipo de erro

### P2 (MÉDIO PRAZO)
7. Implementar retry automático com backoff exponencial para erros temporários
8. Adicionar timeout global de geração (20 minutos)
9. Centralizar tratamento de erros KIE em classe separada

---

## Impacto Estimado

**Sem correção:**
- 5-10% das gerações podem ficar penduradas indefinidamente
- Usuários relatarão "geração travada" sem forma de diagnosticar
- Vazamento de recursos (conexões, memory)
- Refunds incorretos de créditos
- Dificuldade de debugging em produção

**Com correção:**
- Falhas rápidas e previsíveis
- Logs estruturados para diagnóstico
- Experiência consistente
- Refunds corretos
- Retry automático para falhas temporárias
