# Diagramas de Sequência: Fluxo de Dados

## 1. HAPPY PATH (Sucesso Total)

```
User              UI                 Server              KIE API            Firebase
│                 │                    │                   │                  │
├─ Seleciona img  │                    │                   │                  │
│                 ├─ File selected     │                   │                  │
│                 │ (GenerationStep.tsx) 
│                 ├─ readAsDataURL()   │                   │                  │
│                 │ base64 gerado      │                   │                  │
│                 ├─ POST /storage/upload
│                 │                    ├─ Extract MIME & Buffer
│                 │                    ├─ Validate base64
│                 │                    │                   │                  │
│                 │                    │ Save to bucket    │                  ├─ Salva
│                 │                    │                   │                  │
│                 │                    │ Return public URL │                  │
│                 │ 200 { url }        │                   │                  │
│                 ├─ setMainImageUrl   │                   │                  │
│                 │ URL salvo          │                   │                  │
│                 │                    │                   │                  │
│                 ├─ User clica Gerar  │                   │                   │
│                 │ handleGenerate()   │                   │                   │
│                 │                    │                   │                   │
│                 ├─ consumeCredits()  │                   │                   │
│                 │ Firestore UPDATE   │                   │                   │
│                 │ credits -= 5       │                   │                   │
│                 │                    │                   │                   │
│                 ├─ image_input = [mainUrl, mirrorUrl]    │                   │
│                 │                    │                   │                   │
│                 ├─ POST /kie/nano-banana/create          │                   │
│                 │ payload: { model, input }              │                   │
│                 │                    │                   │                   │
│                 │                    ├─ Forward to KIE ──┤                   │
│                 │                    │                   ├─ Create task     │
│                 │                    │                   ├─ Return taskId   │
│                 │                    │ { code: 200, data: { taskId } }     │
│                 │ taskId = "abc123"  │                   │                   │
│                 │                    │                   │                   │
│                 ├─ updateDoc Firestore (sessionId)       │                   │
│                 │ status = 'processing'                  │                   │
│                 │                    │                   │                   │
│                 ├─ startPolling() [every 5s]             │                   │
│                 │                    │                   │                   │
├─ User espera   │ Polling #1 ────────┤ GET /status/abc123│                   │
│                 │                    ├─ Forward ────────┤                   │
│                 │                    │                  ├─ Query task     │
│                 │                    │  { status: 'processing' }           │
│                 │ (continua) ────────┤                   │                   │
│                 │                    │                   │                   │
│ [5 segundos]   │ Polling #2         ├─ GET /status...  │                   │
│                 │                    ├─ { status: 'processing' }           │
│                 │                    │                   │                   │
│ [5 segundos]   │ Polling #3         ├─ GET /status...  │                   │
│                 │                    ├─ { status: 'completed' }            │
│                 │                    │   works: [{url: 'https://...'}]    │
│                 │ resultUrl extraído │                   │                   │
│                 │ progress = 100%    │                   │                   │
│                 │ stage = 'Concluído'│                   │                   │
│                 │                    │                   │                   │
│                 ├─ updateDoc (resultUrl salvo)           │                   │
│                 │ generationResultUrl = 'https://...'   │                   │
│                 │ generationStatus = 'completed'        │                   │
│                 │                    │                   │                   │
│                 ├─ clearInterval()   │                   │                   │
│                 │ Polling parado     │                   │                   │
│                 │                    │                   │                   │
│                 ├─ setIsGenerating(false)                │                   │
│                 │ Button "Download"  │                   │                   │
│                 │ aparece            │                   │                   │
│                 │                    │                   │                   │
└─ Downloads IMG ─┴────────────────────┴────────────────────┴───────────────────┴─────
```

---

## 2. FALHA CRÍTICA: TIMEOUT INDEFINIDO

```
User              UI                 Server              KIE API
│                 │                    │                   │
├─ Seleciona img  │                    │                   │
│ e clica Gerar   │                    │                   │
│                 ├─ consumeCredits()  │                   │
│                 │ Credits = 5 ✓      │                   │
│                 │                    │                   │
│                 ├─ generateImage()   │                   │
│                 │                    ├─ POST to KIE ────┤
│                 │                    │                  (API DOWN - Manutenção)
│                 │                    │                  ✗ TIMEOUT
│                 │                    │ Erro de conexão  │
│                 │                    │                  │
│                 │ taskId gerado?     │                  │
│                 │ (não, erro)        │                  │
│                 │                    │                  │
│                 ├─ startPolling() [every 5s]            │
│                 │ ⚠️ INICIA MESMO SEM taskId VÁLIDO     │
│                 │                    │                  │
├─ Espera...     │ GET /status/???    ├─ Request falha   │
│ (UI travado)   │                    │ 500 Internal Err │
│                 │ Erro ignorado ────────────┐           │
│                 │ catch: console.error()    │           │
│                 │ Continua polling...       │           │
│                 │                           │           │
├─ 5 seg        │ GET /status/???    ├─ KIE ainda offline │
│                 │                    │ Erro novamente    │
│                 │ Continua...        │                   │
│                 │                    │                   │
├─ 10 seg       │ GET /status/???    ├─ Erro #3         │
│                 │                    │                   │
├─ 1 min        │ 12 requisições     │                   │
│                 │ enviadas (perdidas)│                   │
│                 │                    │                   │
├─ 5 minutos    │ 60 requisições     │ KIE volta online  │
│                 │ enviadas (wasted)  │ mas UI ainda      │
│                 │                    │ mostrando         │
│                 │ "Gerando..."       │ "Gerando..."      │
│                 │ ✓ Finalmente status│                   │
│                 │ OK, mas UI perdida │                   │
│                 │                    │                   │
│                 ├─ resultUrl = ???   │                   │
│                 │ undefined (sem task) │                 │
│                 │                    │                   │
│                 ├─ clearInterval() ✓│                   │
│                 │ (MUITO TARDE)      │                   │
│                 │                    │                   │
│ Vê "Geração    │ Sem imagem (erro)  │                   │
│ falhou" mas    │ Créditos: PERDIDOS │                   │
│ perdeu 5 pts   │ ✗ SEM RECUPERAÇÃO  │                   │
│                 │                    │                   │
└─────────────────┴────────────────────┴────────────────────┴───────
```

---

## 3. FALHA: RACE CONDITION EM CRÉDITOS

```
User A                    User A (Otra aba)       Firestore
└─ Gerar img (5 cred)     └─ Gerar img (5 cred)   [credits: 10]
  │                         │                      │
  ├─ GET doc ──────────────────────────────────────┤
  │ currentBalance = 10                            │
  │                                                │
  │                      ├─ GET doc ──────────────┤
  │                      │ currentBalance = 10    │
  │                      │ (mesma leitura!)       │
  │                                               │
  ├─ Check: 10 >= 5 ✓    │                        │
  │                      ├─ Check: 10 >= 5 ✓     │
  │                      │                        │
  ├─ updateDoc() ────────────────────────────────┤
  │ credits: 10 - 5 = 5                          │
  │ ✓ OK                 │                        │ [credits: 5]
  │                      │                        │
  │                      ├─ updateDoc() ────────┤
  │                      │ credits: 10 - 5 = 5  │
  │                      │ (Sobrescreve!)       │ [credits: 5] ✗✗✗
  │                      │                       │ Deveria ser 0
  │                                               │
  └─ Ambas tasks criadas │                        │
    Créditos aparentemente:                       │
    - Esperado: 0 (10 - 5 - 5)                   │
    - Atual: 5 (double debit)                    │
    - SISTEMA PERDEU 5 CRÉDITOS                  │
```

---

## 4. FALHA: RESPOSTA KIE COM ESTRUTURA INESPERADA

```
Cenário: API muda formato na produção (sem aviso)

User              UI                 Server              KIE API
│                 │                    │                   │
├─ Gerar         │                    │                   │
│                 ├─ POST /create ────┤                   │
│                 │                    ├─ Forward ────────┤
│                 │                    │                  ├─ Process
│                 │                    │                  ├─ Generate result
│                 │                    │ Response:        │
│                 │                    │ {                │
│                 │                    │   status: 'completed',
│                 │                    │   results: [{    │ ⚠️ NOVO CAMPO
│                 │                    │     image_url:   │ (antes era 'works')
│                 │                    │     'https://...'│
│                 │                    │   }]             │
│                 │                    │ }                │
│                 │                    │                  │
│                 │ Polling response   │                  │
│                 │ received:          │                  │
│                 │ { status: 'completed',               │
│                 │   results: [...] }                   │
│                 │                    │                  │
│                 ├─ Parse result:    │                  │
│                 │ resultUrl =        │                  │
│                 │  task.works?.[0]?.url  (undefined)   │
│                 │  || task.result_url    (undefined)   │
│                 │                    │                  │
│                 │ resultUrl = undefined ✗              │
│                 │                    │                  │
│                 ├─ if (!resultUrl) { │                 │
│                 │   // ✗ Silencia erro                │
│                 │ }                  │                 │
│                 │                    │                  │
│                 ├─ updateDoc:        │                 │
│                 │ generationResultUrl: undefined       │
│                 │                    │                 │
│                 ├─ UI mostra:       │                  │
│                 │ "Concluído! ✓"    │                  │
│                 │ (sem imagem)      │                  │
│                 │ (sem erro)        │                  │
│                 │                   │                  │
│ User vê        │ "Tudo ok, mas onde  │                  │
│ "Geração ok!"  │ está a imagem?"    │                  │
│ sem imagem     │ Créditos PERDIDOS  │                  │
│ ✗ PERDA SILENCIOSA                  │                  │
│                                      │                  │
└──────────────────────────────────────┴──────────────────┴──────
```

---

## 5. FLUXO DE UPLOAD DETALHADO

```
┌─ Cliente (GenerationStep.tsx) ───────────────────────────┐
│                                                           │
│  input type="file"                                       │
│  (user seleciona arquivo)                               │
│         │                                                │
│         ├─ FileReader.readAsDataURL(file)               │
│         │ Converte para base64                          │
│         │ Ex: "data:image/jpeg;base64,/9j/4AAQSk..."   │
│         │                                                │
│         ├─ uploadBase64ViaProxy(base64, 'main_generation')
│         │                                                │
│         └─────────────────────────────────────────┐     │
│                                                  │     │
├─ POST /api/storage/upload ──────────────────────┐│     │
│ Body: { base64, path: 'main_generation' }      ││     │
│                                                ││     │
└─────────────────────────────────────────────────┘│     │
                                                    │     │
                                                    ▼     │
        ┌─ Node Server (server.ts) ──────────────────┐    │
        │                                            │    │
        │  1. Extract MIME e Base64                 │    │
        │     regex: /^data:([^;]+);base64,(.+)$/   │    │
        │     ⚠️ Sem validação de formato           │    │
        │                                            │    │
        │  2. Decodificar base64 → Buffer           │    │
        │     buffer = Buffer.from(b64data, 'base64')     │
        │     ⚠️ Sem limite de tamanho              │    │
        │     ⚠️ Sem validação MIME type            │    │
        │                                            │    │
        │  3. Gerar filename                        │    │
        │     timestamp + random string             │    │
        │     Ex: "1700000000123_abc7d8"            │    │
        │                                            │    │
        │  4. Upload to Firebase Storage            │    │
        │     bucket.file(fullPath).save(buffer)   │    │
        │     metadata: { contentType }             │    │
        │     public: true                          │    │
        │                                            │    │
        │  5. Generate public URL                   │    │
        │     https://storage.googleapis.com/      │    │
        │       {bucket}/{path}/{filename}         │    │
        │                                            │    │
        │  6. Return response                       │    │
        │     { url: "https://..." }                │    │
        │                                            │    │
        └────────┬─────────────────────────────────┘    │
                 │                                        │
                 ├─ 200 { url: "https://..." } ──┐      │
                 │                               │      │
                 └───────────────────────────────┼──────┘
                                                 │
                                          ┌──────▼─────────┐
                                          │ uploadResponse │
                                          │ .data.url      │
                                          └────────────────┘
                                                 │
                                           catch ├─ Error?
                                                 │
                                          ┌──────▼─────────┐
                                          │ toast.error()  │
                                          │ setMainImg(null)
                                          └────────────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                           ✓ Success                   ✗ Failure
                                    │                         │
                       setMainImageUrl(url)         User tries again
                                    │                         │
                           ✓ Ready to Generate                │
                                    │                         │
                              handleGenerate()                │
```

---

## 6. ESTADO DA SESSÃO FIRESTORE

```
Document: generation_sessions/{sessionId}

Initial State (User abre studio):
{
  userId: "user123"
  sessionId: "session_abc",
  sessionStartedAt: "2024-01-15T10:00:00Z",
  step: 2 (GenerationStep)
}

After Upload (mainImageUrl salvo):
{
  ...
  mainImageUrl: "https://storage.googleapis.com/...",
  step: 2
}

After Gerar (Task criada):
{
  ...
  taskId: "kie_task_xyz",
  generationStatus: "processing",
  updatedAt: "2024-01-15T10:05:00Z"
}

During Polling (sem mudanças):
{
  ...
  taskId: "kie_task_xyz",
  generationStatus: "processing",
  updatedAt: "2024-01-15T10:05:00Z"
  (atualizado a cada 5s? NÃO - apenas lê)
}

After Completion (Sucesso):
{
  ...
  taskId: "kie_task_xyz",
  generationStatus: "completed",
  generationResultUrl: "https://api.kie.ai/result.jpg",
  completedAt: "2024-01-15T10:06:30Z",
  updatedAt: "2024-01-15T10:06:30Z"
}

Or After Failure:
{
  ...
  taskId: "kie_task_xyz",
  generationStatus: "failed",
  generationError: "Timeout after 30s",
  updatedAt: "2024-01-15T10:36:00Z"
  (30 minutos depois!)
}

Or If Polling Never Completes:
{
  ...
  taskId: "kie_task_xyz",
  generationStatus: "processing",
  updatedAt: "2024-01-15T10:05:00Z"
  (Nunca muda! Fica assim para sempre)
}
```

---

## 7. CICLO DE VIDA DO POLLING

```
Início: t=0

t=0s:   startPolling() chamado
        pollingIntervalRef = setInterval(() => { ... }, 5000)
        ✓ Intervalo iniciado

t=5s:   1ª tentativa
        GET /api/kie/nano-banana/status/{taskId}
        Response: { status: 'processing' }
        → Continua

t=10s:  2ª tentativa
        GET /api/kie/nano-banana/status/{taskId}
        Response: { status: 'processing' }
        → Continua

t=15s:  3ª tentativa
        GET /api/kie/nano-banana/status/{taskId}
        Response: { status: 'processing' }
        → Continua

t=30s:  6ª tentativa
        GET /api/kie/nano-banana/status/{taskId}
        Response: { status: 'processing' }
        → Continua (sem mudança há 30s, sem inteligência)

t=60s:  12ª tentativa
        GET /api/kie/nano-banana/status/{taskId}
        Response: { status: 'processing' }
        → Continua

t=300s: 60ª tentativa (5 minutos)
        GET /api/kie/nano-banana/status/{taskId}
        Response: { status: 'processing' }
        → Continua

t=∞:    Polling nunca para
        ⚠️ Sem timeout máximo
        ⚠️ Sem detecção de stale task
        ⚠️ User perdeu créditos

Esperado: Máximo 5-10 minutos, depois falha e refundo

Actual: Indefinido até:
        - User fecha aba (mas interval continua background)
        - Server mata pela timeout do axios (raro)
        - KIE API finalmente responde (pode ser horas)
```

---

## 8. MATRIZ DE TRANSFORMAÇÃO FINAL

```
Stage                Input Type           Output Type
──────────────────────────────────────────────────────
File Selection       File (FileList)      File
Reader              File                 string (base64)
Upload              string (base64)      string (URL)
Store State         string (URL)         null (storage)
Generate Prep       null                 string[] (URLs)
Service Call        string[]             AxiosResponse
Parse TaskId        AxiosResponse        string (taskId)
Update Session      string (taskId)      void (Promise)
Poll                string (taskId)      AxiosResponse
Parse Status        AxiosResponse        enum (status)
Parse ResultUrl     AxiosResponse        string | null
Update Session      string | null        void (Promise)
Stop Polling        void                 void (clearInterval)
Display Result      string (URL)         JSX (img element)
```

---

## CONCLUSÃO VISUAL

O fluxo tem uma estrutura clara, mas múltiplos pontos onde:
1. **Transformações são ambíguas** (resultUrl pode ser múltiplos formatos)
2. **Loops não têm saída** (timeout indefinido)
3. **Estados compartilhados não são atômicos** (race conditions)
4. **Validações estão faltando** (qualquer arquivo é aceito)

Estes diagramas demonstram visualmente onde os gargalos ocorrem e como eles cascateiam para falhas maiores.
