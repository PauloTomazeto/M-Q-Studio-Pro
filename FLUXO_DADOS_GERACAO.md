# Análise Completa do Fluxo de Dados de Geração de Imagens

## 1. VISÃO GERAL DO FLUXO

```
Frontend (Client) → Node Server (Proxy) → KIE API (https://api.kie.ai)
     ↓                                          ↓
  Storage Upload              Task Status Polling
     ↓                                          ↓
Firebase Storage           Task Completion/Failure
```

---

## 2. FLUXO DETALHADO POR ETAPA

### ETAPA 1: Upload de Imagens (GenerationStep.tsx:410-425, 482-492)

**Entrada:**
- Arquivo selecionado pelo usuário (FileList)
- Caminho de destino: `'main_generation'` ou `'mirror_reference'`

**Transformações:**
```
File → FileReader → base64 (data:image/jpeg;base64,...)
                     ↓
                uploadBase64ViaProxy()
                     ↓
                /api/storage/upload (POST)
```

**Dados Enviados:**
```json
{
  "base64": "data:image/jpeg;base64,...",
  "path": "main_generation" | "mirror_reference"
}
```

**Processamento no Server (server.ts:142-181):**
1. Extrai MIME type e buffer da string base64
2. Validação: Verifica se formato é válido (`data:type;base64,data`)
3. Gera filename: `${Date.now()}_${random7chars}`
4. Salva em Firebase Storage com public: true
5. Retorna URL pública: `https://storage.googleapis.com/bucket/path/filename`

**Saída:**
```json
{
  "url": "https://storage.googleapis.com/{bucket}/{storagePath}/{filename}"
}
```

**Estado Atualizado (studioStore):**
```typescript
mainImageUrl = "https://storage.googleapis.com/..." // ou mirrorImageUrl
```

**Gargalos Identificados:**
- ⚠️ **CRÍTICO**: Sem validação de tipo MIME no servidor (aceita qualquer MIME type)
- ⚠️ **CRÍTICO**: Sem validação de tamanho máximo de arquivo
- ⚠️ **CRÍTICO**: Sem validação de dimensões da imagem
- ⚠️ **CRÍTICO**: Sem verificação se arquivo é realmente uma imagem válida

---

### ETAPA 2: Consumo de Créditos (GenerationStep.tsx:132)

**Entrada:**
- Valor do crédito: `resConfig.cost` (5, 10, ou 15)
- Razão: `'image_generation'`

**Processamento (useCredits.tsx:92-111):**
1. Verifica autenticação
2. Verifica se usuário é admin (email hardcoded)
3. Se não é admin: consome créditos do Firestore
4. Se é admin: operação gratuita

**Saída:**
```typescript
boolean // true = sucesso, false = saldo insuficiente
```

**Gargalos:**
- ⚠️ **SEGURANÇA**: Email admin hardcoded ('paulosilvatomazeto@gmail.com')
- ⚠️ **LÓGICA**: Sem transações ACID, possível race condition
- ⚠️ **AUDITORIA**: Sem log de consumo de créditos

---

### ETAPA 3: Preparação do Payload (GenerationStep.tsx:153-164)

**Entrada:**
- `mainImageUrl`: string (URL do Firebase Storage)
- `mirrorImageUrl`: string | null
- `selectedModel`: 'nano-banana-2' | 'nano-banana-pro'
- `selectedResolution`: '1K' | '2K' | '4K'
- `selectedAspectRatio`: string (ex: '16:9', '1:1')
- `activePrompt`: string (prompt em português)

**Transformações:**
```typescript
// GenerationStep.tsx:153-156
const image_input = [mainImageUrl];
if (mirrorImageUrl) {
  image_input.push(mirrorImageUrl);
}
```

**Estrutura do Payload:**
```typescript
{
  model: 'nano-banana-2' | 'nano-banana-pro',
  input: {
    prompt: string,           // Português
    image_input: string[],    // [mainUrl, mirrorUrl?]
    aspect_ratio: string,
    resolution: '1K' | '2K' | '4K',
    output_format: 'jpg'      // Hardcoded
  }
}
```

**Gargalos:**
- ⚠️ **TIPO**: `image_input` é `string[]` (URLs), não base64
- ⚠️ **VALIDAÇÃO**: Sem validação de URLs
- ⚠️ **VALIDAÇÃO**: Sem validação de aspect_ratio (qualquer string aceita)
- ✓ **CORRETO**: `output_format` hardcoded previne injeção

---

### ETAPA 4: Envio para Proxy (kieService.ts:595-618)

**Cliente:**
```typescript
async generateImage(params: {
  prompt: string;
  model: 'nano-banana-2' | 'nano-banana-pro';
  resolution: '1K' | '2K' | '4K';
  aspect_ratio: string;
  image_input?: string[];
})
```

**Requisição HTTP:**
```
POST /api/kie/nano-banana/create
Content-Type: application/json

{
  "model": "nano-banana-2",
  "input": {
    "prompt": "...",
    "image_input": ["https://...", "https://..."],
    "aspect_ratio": "16:9",
    "resolution": "1K",
    "output_format": "jpg"
  }
}
```

**Tratamento de Resposta:**
```typescript
if (response.data.code !== 200) {
  throw new Error(response.data.msg || "Failed to create generation task");
}
return response.data.data.taskId;
```

**Gargalos:**
- ⚠️ **VALIDAÇÃO**: Sem validação de resposta antes de throw
- ⚠️ **CAMPO**: Esperado `response.data.data.taskId`, sem fallback se estrutura diferir

---

### ETAPA 5: Proxy do Servidor (server.ts:95-122)

**Requisição Recebida:**
```
POST /api/kie/nano-banana/create
```

**Logging (diagnostico):**
```typescript
{
  model: string,
  promptLength: number,
  imageCount: number,
  resolution: string,
  aspect_ratio: string
}
```

**Transformação:**
```
req.body PASSADO DIRETO (sem modificação)
    ↓
POST https://api.kie.ai/api/v1/jobs/createTask
    ↓
Headers: {
  Authorization: Bearer {KIE_API_KEY},
  Content-Type: application/json
}
```

**Tratamento de Erro:**
```typescript
- Se erro: extrai status e data
- Responde com mesmo status HTTP
- Log de erro no console
```

**Gargalos:**
- ⚠️ **SEGURANÇA**: Chave API em variável de ambiente (bom)
- ⚠️ **VALIDAÇÃO**: Nenhuma validação no proxy
- ⚠️ **TRANSFORM**: Payload enviado como-é (sem sanitização)
- ⚠️ **TIMEOUT**: Sem timeout explícito (usa axios default ~5s)
- ⚠️ **RETRY**: Sem retry logic
- ⚠️ **RATE LIMIT**: Sem proteção contra rate limiting

---

### ETAPA 6: Atualização de Sessão Firestore (GenerationStep.tsx:174-181)

**Entrada:**
- `sessionId`: string | null
- `taskId`: string (retornado da API)

**Documento Atualizado:**
```typescript
doc(db, 'generation_sessions', sessionId)
{
  userId: string,
  taskId: string,
  generationStatus: 'processing',
  updatedAt: ISO8601
}
```

**Gargalos:**
- ⚠️ **ERROR HANDLING**: `.catch()` silencia erros de permissão
- ⚠️ **CRÍTICO**: Se sessionId é null, operação não executa silenciosamente
- ⚠️ **AUDIT**: Sem histórico de tentativas

---

### ETAPA 7: Polling de Status (GenerationStep.tsx:184-237)

**Intervalo:** 5 segundos (5000ms)

**Fluxo:**
```
1. GET /api/kie/nano-banana/status/{taskId}
2. Recebe: { status, works: [{url}] | result_url, msg }
3. Verifica status:
   - 'completed' | 'success' → Sucesso (linha 189)
   - 'failed' | 'error' → Falha (linha 213)
   - Outro → Continua polling
4. Se sucesso: resultUrl = task.works?.[0]?.url || task.result_url
5. Para polling e atualiza Firestore
```

**Variáveis de Estado Atualizadas:**
```typescript
{
  taskId: string,
  status: 'completed' | 'failed',
  progress: 100 | 0,
  stage: 'Concluído!' | error.msg,
  resultUrl?: string,
  error?: string
}
```

**Gargalos:**
- ⚠️ **CRÍTICO**: Sem limite máximo de polling (pode rodas indefinidamente)
- ⚠️ **CRÍTICO**: Sem timeout global (tarefa pode ficar "pendente" para sempre)
- ⚠️ **PARSING**: Campo result_url é fallback frágil - que formato esperado?
- ⚠️ **ERROR**: Se `task.status === 'failed'`, procura `task.msg` sem guarantee
- ⚠️ **RACE**: Se usuário sair do componente, interval continua rodando

---

### ETAPA 8: Endpoint de Status (server.ts:124-139)

**Requisição:**
```
GET /api/kie/nano-banana/status/{taskId}
```

**Proxy:**
```
GET https://api.kie.ai/api/v1/jobs/getTask?taskId={taskId}
Headers: Authorization Bearer {KIE_API_KEY}
```

**Resposta:**
```json
{
  "code": 200,
  "data": {
    "status": "completed" | "processing" | "failed",
    "works": [{ "url": "https://..." }],
    "result_url": "https://...",
    "msg": "error message if failed"
  }
}
```

**Gargalos:**
- ⚠️ **ESTRUTURA**: Resposta KIE pode variar (works vs result_url)
- ⚠️ **TIMEOUT**: Sem timeout explícito

---

### ETAPA 9: Reembolso de Créditos (GenerationStep.tsx:223, 249)

**Triggers:**
1. Falha na tarefa (linha 223)
2. Erro na inicialização (linha 249)

**Processamento:**
```typescript
await refundCredits(cost, 'generation_failed' | 'generation_init_failed')
```

**Gargalos:**
- ⚠️ **RACE CONDITION**: Reembolso pode falhar após sucesso parcial
- ⚠️ **IDEMPOTÊNCIA**: Sem check se já foi reembolsado
- ⚠️ **ADMIN**: Admin users não pagam, então reembolso não faz diferença

---

## 3. MAPA COMPLETO DE TIPOS

```typescript
// === INPUT ===
File
  ↓
base64: string (data:image/jpeg;base64,...)
  ↓
uploadResponse: { url: string }
  ↓
mainImageUrl: string | null
mirrorImageUrl: string | null

// === GENERATION ===
generateImageParams: {
  prompt: string
  model: 'nano-banana-2' | 'nano-banana-pro'
  resolution: '1K' | '2K' | '4K'
  aspect_ratio: string
  image_input: string[]
}
  ↓
kiePayload: {
  model: string
  input: {
    prompt: string
    image_input: string[]
    aspect_ratio: string
    resolution: string
    output_format: 'jpg'
  }
}
  ↓
kieCreateTaskResponse: {
  code: number
  data: { taskId: string }
}
  ↓
taskId: string

// === POLLING ===
taskStatusResponse: {
  status: 'processing' | 'completed' | 'failed'
  works?: [{ url: string }]
  result_url?: string
  msg?: string
}
  ↓
resultUrl?: string
```

---

## 4. GARGALOS E PONTOS DE FALHA CRÍTICOS

### 4.1 Tier 1: CRÍTICOS (Impacto Alto)

| Gargalo | Local | Impacto | Severidade |
|---------|-------|--------|-----------|
| **Sem timeout em polling** | GenerationStep.tsx:185-237 | Tarefa fica "pendente" indefinidamente | CRÍTICO |
| **Sem validação de MIME type** | server.ts:142-181 | Qualquer arquivo é aceito como imagem | CRÍTICO |
| **Sem tamanho máximo** | server.ts:142-181 | Upload de 100GB possível | CRÍTICO |
| **URL não validadas** | kieService.ts:606 | URLs inválidas passam para API KIE | CRÍTICO |
| **Estructura resposta KIE ambígua** | GenerationStep.tsx:193 | Pode falhar se campos faltam | CRÍTICO |
| **Race condition créditos** | useCredits.ts:92-111 | Dois requests simultâneos = double debit | CRÍTICO |

### 4.2 Tier 2: ALTOS (Impacto Médio)

| Gargalo | Local | Impacto |
|---------|-------|--------|
| Sem retry na API KIE | server.ts:104-113 | Falha em picos de tráfego |
| Sem validação de aspect_ratio | kieService.ts:599 | Valores inválidos podem ser aceitos |
| Email admin hardcoded | useCredits.ts:95 | Mudança quebra lógica |
| Sem transação Firestore | GenerationStep.tsx:175 | Inconsistência possível |
| Intervalo polling fixo | GenerationStep.tsx:185 | Waste de bandwidth |
| Sem rate limit protection | server.ts:104 | DDoS possível |

### 4.3 Tier 3: MÉDIOS (Impacto Baixo)

| Gargalo | Local | Impacto |
|---------|-------|--------|
| Error silenciado em Firestore | GenerationStep.tsx:180 | Sessão pode não ser criada |
| Sem validação dimensions | server.ts:153 | Imagens muito pequenas aceitam |
| Sem logging de transações | useCredits.ts | Audit trail ausente |
| Histórico de polling não guardado | GenerationStep.tsx:237 | Sem debug da falha |

---

## 5. FLUXO DE DADOS: CASOS DE FALHA

### Caso A: Arquivo Inválido no Upload
```
Upload → server.ts:153-156 → regex match falha
    ↓
res.status(400).json({ error: "Invalid base64 format" })
    ↓
catch em storageService.ts:493 → throw
    ↓
catch em GenerationStep.tsx:489-491 → toast.error
    ↓
Usuário pode tentar novamente
```

### Caso B: URL do Firebase Inválida
```
uploadBase64ViaProxy() → returns "undefined" | null
    ↓
setMainImageUrl(undefined)
    ↓
handleGenerate() → if (!mainImageUrl) throw (linha 148) ✓
    ↓
Capturado e reembolsa créditos
```

### Caso C: Tarefa Fica "Pendente" Eternamente
```
kieService.generateImage() → returns taskId
    ↓
polling inicia → cada 5s GET /status/{taskId}
    ↓
KIE API falha silenciosamente (offline)
    ↓
polling continua INDEFINIDAMENTE (sem timeout)
    ↓
Créditos já foram consumidos, tarefa nunca volta
    ⚠️ PERDA DE CRÉDITOS SEM RECUPERAÇÃO
```

### Caso D: Créditos Debitados, Task Falha
```
consumeCredits() ✓ (debitados)
    ↓
generateImage() → task creation falha
    ↓
catch → refundCredits() 
    ↓
RACE: Se database lento, refund pode falhar
    ↓
Créditos PERDIDOS
```

### Caso E: Resposta KIE com Estrutura Inesperada
```
polling retorna: { "status": "completed", "result_url": "https://..." }
    ↓
GenerationStep.tsx:193 tenta acessar:
    const resultUrl = task.works?.[0]?.url || task.result_url
    ↓
works é undefined → resultUrl = task.result_url ✓
    ↓
Mas se AMBOS undefined:
    const resultUrl = undefined
    ↓
Salva em Firestore: generationResultUrl = undefined ✗
```

---

## 6. TIPOS DE DADOS: DEFINIÇÃO ESPERADA

### Estrutura Esperada da API KIE

```json
{
  "code": 200,
  "data": {
    "taskId": "task_abc123",
    "status": "processing",
    ...
  }
}
```

### Estrutura Resposta de Status

**Sucesso:**
```json
{
  "code": 200,
  "data": {
    "status": "completed",
    "works": [
      { "url": "https://api.kie.ai/works/image.jpg" }
    ],
    "result_url": "https://..."  // fallback
  }
}
```

**Falha:**
```json
{
  "code": 500,
  "data": {
    "status": "failed",
    "msg": "Timeout: modelo não respondeu em 30s"
  }
}
```

---

## 7. RECOMENDAÇÕES DE FIX PRIORITY

### P0 (Fazer agora)
1. **Adicionar timeout global:** Máximo 5 minutos de polling
2. **Validar URLs no servidor:** Verificar se são HTTPS válidas
3. **Validar MIME type:** Aceitar apenas image/jpeg, image/png
4. **Adicionar límite de tamanho:** MAX 10MB por arquivo

### P1 (Sprint atual)
1. **Transação Firestore:** Usar batch writes para atomicidade
2. **Retry logic:** 3 retries com exponential backoff
3. **Validar aspect_ratio:** Lista whitelist (16:9, 1:1, 4:3, etc)
4. **Polling inteligente:** Aumentar intervalo após 30s sem mudança

### P2 (Próximo sprint)
1. **Admin config:** Mover email para .env
2. **Audit logging:** Cada transação de crédito logada
3. **Status page:** Dashboard de tasks em execução
4. **Rate limiting:** Protection contra abuso

---

## 8. FLUXO RESUMIDO EM ASCII

```
┌─ Frontend ─────────────────────────────────────┐
│                                                  │
│  1. Upload File                                  │
│     ↓                                            │
│  2. base64ViaProxy                             │
│     ↓                                            │
│  3. setMainImageUrl                            │
│     ↓                                            │
│  4. handleGenerate()                           │
│     ├─ consumeCredits (cost=5-15)              │
│     ├─ prepareImageInput ([urls])              │
│     └─ kieService.generateImage()              │
│        ↓                                        │
│  5. POST /api/kie/nano-banana/create           │
│     → returns taskId                           │
│     ↓                                          │
│  6. setGenerationTask(taskId)                  │
│  7. updateDoc(Firestore)                       │
│  8. startPolling (every 5s)                    │
│     ├─ GET /api/kie/nano-banana/status/{id}   │
│     ├─ Check: completed? failed? processing?  │
│     ├─ If completed: save resultUrl            │
│     └─ If failed: refundCredits()              │
│                                                 │
└────────────────────────────────────────────────┘
        ↓
┌─ Node Server Proxy ────────────────────────────┐
│                                                 │
│ POST /api/storage/upload                       │
│  → Parse base64                                │
│  → Upload Firebase Storage                     │
│  → Return public URL                           │
│                                                │
│ POST /api/kie/nano-banana/create              │
│  → Forward to https://api.kie.ai              │
│  → Return taskId                              │
│                                                │
│ GET /api/kie/nano-banana/status/{id}          │
│  → Forward to https://api.kie.ai              │
│  → Return status                              │
│                                                │
└────────────────────────────────────────────────┘
        ↓
┌─ External APIs ────────────────────────────────┐
│                                                 │
│ Firebase Storage → Stores images                │
│ KIE API → Generates images                      │
│ Firestore → Stores metadata                    │
│                                                 │
└────────────────────────────────────────────────┘
```

---

## 9. MATRIZ DE TRANSFORMAÇÃO DE DADOS

```
┌─────────────────────────────────────────────────────────────────┐
│ Origem        │ Transformação            │ Destino              │
├─────────────────────────────────────────────────────────────────┤
│ File          │ FileReader.readAsDataURL │ base64: string       │
│ base64        │ server.ts: Buffer.from   │ ImageFile: Binary    │
│ ImageFile     │ Firebase.bucket.save     │ URL: string          │
│ URL           │ Array concatenation      │ image_input: string[]│
│ image_input[] │ JSON.stringify           │ HTTP Body: JSON      │
│ HTTP Response │ response.data.data       │ taskId: string       │
│ taskId        │ Polling loop             │ Task Status: enum    │
│ Task Status   │ Conditional check        │ resultUrl: string    │
│ resultUrl     │ updateDoc                │ Firestore: Document  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 10. CONCLUSÕES

### Pontos Fortes:
- ✓ Separação clara de responsabilidades (client/server/api)
- ✓ Proxy pattern protege credenciais
- ✓ Créditos consumidos antes de task criada (minimiza waste)
- ✓ Logging em pontos chave

### Pontos Fracos:
- ✗ Sem validações em múltiplas camadas
- ✗ Sem tratamento de timeouts
- ✗ Race conditions em créditos
- ✗ Polling indefinido possível
- ✗ Estrutura resposta ambígua

### Risco Geral: **ALTO**

Há múltiplos cenários onde créditos podem ser perdidos sem recuperação. A falta de timeout em polling é particularmente crítica.
