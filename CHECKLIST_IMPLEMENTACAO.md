# Checklist de Implementação - Fixes para Gargalos

## P0: CRÍTICO - Implementar Hoje (30 minutos)

### Fix #1: Adicionar Timeout em Polling ⏱️

**Arquivo:** `src/components/studio/GenerationStep.tsx`

**Localização:** Dentro de `handleGenerate()`, após linha 184

**Antes:**
```typescript
// Start polling
if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
pollingIntervalRef.current = setInterval(async () => {
  // ... polling logic ...
}, 5000);
```

**Depois:**
```typescript
// Start polling
if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
const startTime = Date.now();
const maxPollingDuration = 300000; // 5 minutos

pollingIntervalRef.current = setInterval(async () => {
  const elapsed = Date.now() - startTime;
  
  // ✓ NOVO: Verificar timeout
  if (elapsed > maxPollingDuration) {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    setGenerationTask({
      taskId,
      status: 'failed',
      progress: 0,
      error: 'Timeout: Geração levou mais de 5 minutos. Créditos reembolsados.'
    });
    setIsGenerating(false);
    await refundCredits(cost, 'polling_timeout');
    
    if (sessionId) {
      updateDoc(doc(db, 'generation_sessions', sessionId), {
        userId: auth.currentUser?.uid,
        generationStatus: 'failed',
        generationError: 'Polling timeout após 5 minutos',
        updatedAt: new Date().toISOString()
      }).catch(e => console.warn('Falha ao reportar timeout no Firestore:', e));
    }
    return;
  }
  
  try {
    const task = await kieService.getTaskStatus(taskId);
    // ... resto do código ...
  } catch (err: any) {
    console.error('Polling error:', err);
  }
}, 5000);
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

### Fix #2: Validar Image Input URLs 🔒

**Arquivo:** `src/services/kieService.ts`

**Localização:** No topo do arquivo (após imports)

**Adicionar função:**
```typescript
// Helper function para validar URLs
const validateImageInput = (urls: string[] | undefined): boolean => {
  if (!urls || !Array.isArray(urls)) {
    return false;
  }
  
  if (urls.length === 0) {
    return false;
  }
  
  return urls.every(url => {
    // Validação 1: É string?
    if (typeof url !== 'string' || url.length === 0) {
      return false;
    }
    
    // Validação 2: É URL válida?
    try {
      const parsed = new URL(url);
      
      // Validação 3: É HTTPS?
      if (parsed.protocol !== 'https:') {
        return false;
      }
      
      // Validação 4: É do Firebase Storage?
      if (!url.includes('storage.googleapis.com')) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  });
};
```

**Localização:** Dentro de `generateImage()`, linha 602

**Antes:**
```typescript
const response = await axios.post('/api/kie/nano-banana/create', {
  model: params.model,
  input: {
    prompt: params.prompt,
    image_input: params.image_input || [],
    // ...
  }
});
```

**Depois:**
```typescript
// ✓ NOVO: Validar URLs antes de enviar
if (!validateImageInput(params.image_input)) {
  throw new Error('URLs de imagem inválidas ou ausentes');
}

const response = await axios.post('/api/kie/nano-banana/create', {
  model: params.model,
  input: {
    prompt: params.prompt,
    image_input: params.image_input || [],
    // ...
  }
});
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

### Fix #3: Validar Result URL após Polling 📦

**Arquivo:** `src/components/studio/GenerationStep.tsx`

**Localização:** Linha 193

**Antes:**
```typescript
const resultUrl = task.works?.[0]?.url || task.result_url;

if (!resultUrl) {
  // ✗ Silencia erro
}
```

**Depois:**
```typescript
// ✓ NOVO: Parser robusto com múltiplas fallbacks
const parseResultUrl = (task: any): string | null => {
  // Tentar múltiplos formatos conhecidos
  if (task.works && Array.isArray(task.works) && task.works.length > 0) {
    const url = task.works[0]?.url;
    if (url && typeof url === 'string' && url.length > 0) {
      return url;
    }
  }
  
  if (task.result_url && typeof task.result_url === 'string' && task.result_url.length > 0) {
    return task.result_url;
  }
  
  if (task.results && Array.isArray(task.results) && task.results.length > 0) {
    const url = task.results[0]?.image_url || task.results[0]?.url;
    if (url && typeof url === 'string' && url.length > 0) {
      return url;
    }
  }
  
  return null;
};

const resultUrl = parseResultUrl(task);

if (!resultUrl) {
  // ✓ NOVO: Erro claro em vez de silencioso
  throw new Error(
    `API retornou resposta em formato desconhecido: ${JSON.stringify(task)}`
  );
}
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

## P1: ALTO - Implementar Semana Atual (55 minutos)

### Fix #4: Converter consumeCredits para Transaction 💳

**Arquivo:** `src/hooks/useCredits.ts`

**Localização:** Linha 92-111

**Antes:**
```typescript
const consumeCredits = async (amount: number, reason: string) => {
  if (!auth.currentUser) return false;
  
  const userDocRef = doc(db, 'users', auth.currentUser.uid);
  const userDoc = await getDoc(userDocRef);
  
  if (!userDoc.exists()) return false;
  
  const userData = userDoc.data();
  const currentBalance = userData?.credits || 0;
  
  if (currentBalance < amount) {
    return false;
  }
  
  await updateDoc(userDocRef, {
    credits: currentBalance - amount
  });
  
  return true;
};
```

**Depois:**
```typescript
const consumeCredits = async (amount: number, reason: string) => {
  if (!auth.currentUser) return false;
  
  try {
    // ✓ NOVO: Use transaction para atomicidade
    const result = await runTransaction(db, async (transaction) => {
      const userDocRef = doc(db, 'users', auth.currentUser!.uid);
      const userDoc = await transaction.get(userDocRef);
      
      if (!userDoc.exists()) {
        return false;
      }
      
      const currentBalance = userDoc.data().credits || 0;
      
      if (currentBalance < amount) {
        return false;
      }
      
      // ✓ ATÔMICO: Garante que apenas este update acontece
      transaction.update(userDocRef, {
        credits: currentBalance - amount,
        lastTransactionAt: new Date().toISOString(),
        lastTransactionReason: reason,
        lastTransactionAmount: amount
      });
      
      return true;
    });
    
    return result;
  } catch (error) {
    console.error('Transaction error:', error);
    return false;
  }
};
```

**Imports necessários:** Adicionar ao topo
```typescript
import { runTransaction } from 'firebase/firestore';
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

### Fix #5: Validar Arquivo no Upload (Server) 📁

**Arquivo:** `server.ts`

**Pré-requisito:** Instalar sharp
```bash
npm install sharp
```

**Localização:** Dentro de `/api/storage/upload`, após linha 149

**Antes:**
```typescript
try {
  console.log(`[Storage Proxy] Uploading to: ${storagePath || 'temp_gen'}`);
  
  const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return res.status(400).json({ error: "Invalid base64 format" });
  }

  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
```

**Depois:**
```typescript
try {
  console.log(`[Storage Proxy] Uploading to: ${storagePath || 'temp_gen'}`);
  
  // Constantes de validação
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
  const MIN_DIMENSION = 256;
  const MAX_DIMENSION = 4096;
  
  // Validação 1: Formato base64
  const matches = base64.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    return res.status(400).json({ error: "Invalid base64 format" });
  }

  const contentType = matches[1];
  const buffer = Buffer.from(matches[2], 'base64');
  
  // Validação 2: Tamanho total
  if (buffer.length > MAX_FILE_SIZE) {
    return res.status(413).json({ 
      error: `File too large. Max: ${MAX_FILE_SIZE / (1024 * 1024)}MB` 
    });
  }
  
  // Validação 3: MIME type permitido
  if (!ALLOWED_MIMES.includes(contentType)) {
    return res.status(400).json({ 
      error: `Invalid MIME type. Allowed: ${ALLOWED_MIMES.join(', ')}` 
    });
  }
  
  // Validação 4: Dimensões da imagem
  const sharp = require('sharp');
  const metadata = await sharp(buffer).metadata();
  
  if (!metadata.width || !metadata.height) {
    return res.status(400).json({ 
      error: "Could not determine image dimensions" 
    });
  }
  
  if (metadata.width < MIN_DIMENSION || metadata.height < MIN_DIMENSION) {
    return res.status(400).json({ 
      error: `Image too small. Minimum: ${MIN_DIMENSION}x${MIN_DIMENSION}px` 
    });
  }
  
  if (metadata.width > MAX_DIMENSION || metadata.height > MAX_DIMENSION) {
    return res.status(400).json({ 
      error: `Image too large. Maximum: ${MAX_DIMENSION}x${MAX_DIMENSION}px` 
    });
  }
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

### Fix #6: Adicionar Retry Logic 🔄

**Arquivo:** `server.ts`

**Localização:** Dentro de `/api/kie/nano-banana/create`, linha 104

**Antes:**
```typescript
try {
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

**Depois:**
```typescript
// ✓ NOVO: Helper para retry com exponential backoff
const retryRequest = async (fn, maxAttempts = 3) => {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
        console.log(`[KIE Proxy] Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
};

try {
  const response = await retryRequest(async () => {
    return await axios.post(
      "https://api.kie.ai/api/v1/jobs/createTask",
      req.body,
      {
        headers: {
          Authorization: `Bearer ${KIE_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 30000, // 30s timeout
      }
    );
  });
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

## P2: MÉDIO - Próximo Sprint (8+ horas)

### Fix #7: Remover Email Admin Hardcoded

**Arquivo:** `src/hooks/useCredits.ts`

**Antes:**
```typescript
const isAdminEmail = auth.currentUser.email === 'paulosilvatomazeto@gmail.com';
```

**Depois:**
```typescript
// Usar .env
const ADMIN_EMAILS = (process.env.VITE_ADMIN_EMAILS || '').split(',');
const isAdminEmail = ADMIN_EMAILS.includes(auth.currentUser.email || '');
```

**`.env`:**
```
VITE_ADMIN_EMAILS=paulosilvatomazeto@gmail.com,admin2@example.com
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

### Fix #8: Adicionar Logging de Transações

**Arquivo:** `src/hooks/useCredits.ts`

**Após Fix #4 (Transaction), adicionar:**

```typescript
// Adicionar em transaction.update():
transaction.update(userDocRef, {
  credits: currentBalance - amount,
  lastTransactionAt: new Date().toISOString(),
  lastTransactionReason: reason,
  lastTransactionAmount: amount,
  transactionCount: (userDoc.data().transactionCount || 0) + 1
});

// Adicionar log em Firestore
const logsRef = collection(db, 'credit_logs');
await addDoc(logsRef, {
  userId: auth.currentUser!.uid,
  amount: amount,
  reason: reason,
  newBalance: currentBalance - amount,
  timestamp: new Date().toISOString(),
  userEmail: auth.currentUser!.email
});
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

### Fix #9: Dashboard de Tasks Ativas

**Arquivo:** Novo arquivo `src/pages/AdminDashboard.tsx` (100+ linhas)

**Scope:** 
- Listar tasks em processamento
- Mostrar tempo decorrido
- Botão para forçar conclusão
- Gráfico de geração/hora

**Status:** [ ] Planejado [ ] Implementado [ ] Revisado

---

### Fix #10: Rate Limiting

**Arquivo:** `server.ts`

**Instalar:** `npm install express-rate-limit`

**Usar:**
```typescript
import rateLimit from 'express-rate-limit';

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // 5 requisições por minuto
  message: 'Muitas requisições. Tente novamente em 1 minuto.'
});

app.post('/api/kie/nano-banana/create', generateLimiter, async (req, res) => {
  // ... código ...
});
```

**Status:** [ ] Implementado [ ] Testado [ ] Revisado

---

## TESTES

### Teste P0 #1: Timeout
```typescript
// Em GenerationStep.tsx, simular:
1. Clicar "Gerar"
2. No console: desabilitar API KIE
3. Verificar se após 5 min, créditos são reembolsados
4. Verificar se erro aparece no UI
```

### Teste P0 #2: URL Validation
```typescript
// Em console:
useStudioStore.getState().setMainImageUrl('https://example.com/invalid');
// Deve falhar ao tentar gerar com erro claro
```

### Teste P0 #3: Result URL Parser
```typescript
// Mock response com diferentes estruturas:
const mockTask = {
  status: 'completed',
  results: [{ image_url: 'https://...' }]
};
// Deve conseguir extrair URL corretamente
```

### Teste P1 #1: Race Condition
```typescript
// Abrir 2 abas simultâneas
// Clicar gerar em ambas no mesmo instante
// Verificar se créditos são debitados corretamente (não double)
```

### Teste P1 #2: File Validation
```typescript
// Tentar upload de:
// 1. Arquivo > 10MB
// 2. Arquivo PNG gigante (4000x4000)
// 3. Arquivo .exe disfarçado como .jpg
// Todos devem ser rejeitados
```

---

## CHECKLIST GERAL

### Antes de Implementar
- [ ] Fazer branch de feature para cada fix
- [ ] Ler o arquivo de análise correspondente
- [ ] Discutir com equipe a abordagem

### Durante Implementação
- [ ] Testar localmente em modo desenvolvimento
- [ ] Adicionar console.log para debug se necessário
- [ ] Verificar que imports estão corretos
- [ ] Verificar tipos TypeScript

### Depois de Implementar
- [ ] Criar PR com descrição clara
- [ ] Executar testes manuais acima
- [ ] Revisar com team member
- [ ] Deploy em staging
- [ ] Monitor em produção 24h

### Documentação
- [ ] Atualizar README com mudanças
- [ ] Adicionar comentários de código explicando lógica nova
- [ ] Documentar em CHANGELOG

---

## TIMELINE ESTIMADA

### P0 (Hoje): 30 minutos
```
Fix #1: 8 min
Fix #2: 7 min  
Fix #3: 5 min
Testes: 10 min
```

### P1 (Semana): 55 minutos
```
Fix #4: 15 min
Fix #5: 20 min
Fix #6: 10 min
Testes: 10 min
```

### P2 (Sprint): 8+ horas
```
Fix #7: 30 min
Fix #8: 1 hr
Fix #9: 3-4 hrs
Fix #10: 2-3 hrs
Documentação: 1 hr
```

---

## PRÓXIMAS AÇÕES

1. **Hoje:** Implementar P0 (30 min)
2. **Amanhã:** Testar P0 em staging
3. **Dia 3:** Implementar P1 (1 hr)
4. **Dia 4:** Review e deploy P0+P1
5. **Sprint seguinte:** Implementar P2

---

## APOIO

Se tiver dúvidas durante implementação:
- Consultar `FLUXO_DADOS_GERACAO.md` para entender o fluxo
- Consultar `ANALISE_DETALHADA_PONTOS_FALHA.md` para detalhes técnicos
- Consultar `DIAGRAMAS_SEQUENCIA.md` para visualizar o fluxo

---

**Status Geral:** [ ] P0 completo [ ] P1 completo [ ] P2 completo
**Data de Início:** _______
**Data de Conclusão (Estimada):** _______
**Data de Conclusão (Real):** _______
