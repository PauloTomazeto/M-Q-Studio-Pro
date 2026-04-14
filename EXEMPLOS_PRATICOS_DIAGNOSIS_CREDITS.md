# EXEMPLOS PRÁTICOS: Sistema de Créditos DiagnosisStep

**Guia de referência rápida para desenvolvedores e QA**

---

## 1. EXEMPLO: Fluxo Feliz (Sucesso)

### Cenário
Usuário faz upload de imagem e diagnóstico funciona perfeitamente na primeira tentativa.

### Ações do Usuário
1. Clica em "Diagnosticar"
2. Aguarda resultado
3. Vê resultado com sucesso

### Estado Interno
```javascript
// Início
{
  status: 'loading',
  isProcessingRef: true,
  retryCountRef: 0,
  analysisStartedRef: true
}

// Sucesso
{
  status: 'success',
  isProcessingRef: false,
  retryCountRef: 0,
  analysisStartedRef: true,
  result: { ... dados de análise ... }
}
```

### Transações de Crédito
```
Saldo Inicial: 100 créditos

1. Consumo: -5 créditos
   Toast: "5 créditos deducted para diagnóstico arquitetônico" ✓
   
Saldo Final: 95 créditos
```

### Console Output
```
[Diagnosis] Consuming 5 credits for first attempt...
Running diagnosis with Base64, Session: abc123xyz...
```

### Toast Notifications
```
🟢 "5 créditos deducted para diagnóstico arquitetônico"
```

---

## 2. EXEMPLO: Erro 5xx com Refund Automático

### Cenário
Servidor IA retorna erro 502 Bad Gateway na primeira tentativa.

### Ações do Usuário
1. Clica em "Diagnosticar"
2. Aguarda...
3. Vê spinner girar (sistema tentando retry automaticamente)
4. Vê resultado com sucesso (retry funcionou)

### Estado Interno
```javascript
// Após 1º erro (antes de retry)
{
  status: 'loading',
  isProcessingRef: true,
  retryCountRef: 1,
  analysisStartedRef: true,
  error: null
}

// Após sucesso do retry
{
  status: 'success',
  isProcessingRef: false,
  retryCountRef: 1,
  analysisStartedRef: true,
  result: { ... dados de análise ... }
}
```

### Transações de Crédito
```
Saldo Inicial: 100 créditos

1. Consumo Inicial: -5 créditos
   Toast: "5 créditos deducted para diagnóstico arquitetônico" ✓
   
2. Erro 502 detectado!
   Refund Automático: +5 créditos
   Toast: "5 créditos reembolsados devido a erro do servidor" ℹ️
   
3. Retry automático após 3 segundos...
   Consumo: IGNORADO (retry não consume)
   
4. Sucesso na 2ª tentativa!
   Toast: "Análise completa - sem cobranças adicionais" ✓

Saldo Final: 100 créditos ✅
```

### Console Output
```
[Diagnosis] Consuming 5 credits for first attempt...
Running diagnosis with Base64, Session: abc123xyz...
Diagnosis Error: HTTP 502 Bad Gateway
[Credits] Refunded 5 for: HTTP 502 Bad Gateway
[Diagnosis] Retrying diagnosis (Attempt 2)...
[Diagnosis] Retry attempt 1. Skipping credit consumption.
Running diagnosis with Base64, Session: abc123xyz...
[Diagnosis] Retry succeeded - no additional charges
```

### Toast Notifications
```
🟢 "5 créditos deducted para diagnóstico arquitetônico"
❌ (spinner aguardando...)
🔴 "5 créditos reembolsados devido a erro do servidor"
🟢 "Análise completa - sem cobranças adicionais"
```

### Timeline
```
T=0s:    Usuário clica
T=1s:    Consumo de 5 créditos
T=5s:    Erro 502
T=5.5s:  Refund automático
T=8.5s:  Retry iniciado
T=10s:   Sucesso
```

---

## 3. EXEMPLO: Timeout com Duplo Refund

### Cenário
Servidor IA está indisponível. Primeira tentativa e retry ambas falham com timeout.

### Ações do Usuário
1. Clica em "Diagnosticar"
2. Aguarda spinner
3. Vê erro final: "Servidor de IA indisponível"

### Estado Interno
```javascript
// Após 1º timeout
{
  status: 'loading',
  isProcessingRef: true,
  retryCountRef: 1,
  error: null
}

// Após erro final
{
  status: 'error',
  isProcessingRef: false,
  retryCountRef: 1,
  analysisStartedRef: true,
  error: "timeout - Servidor indisponível"
}
```

### Transações de Crédito
```
Saldo Inicial: 100 créditos

1. Consumo Inicial: -5 créditos
   Toast: "5 créditos deducted para diagnóstico arquitetônico" ✓
   
2. Timeout detectado!
   Refund Automático: +5 créditos (PRIMEIRA REFUND)
   Toast: "5 créditos reembolsados devido a erro do servidor" ℹ️
   
3. Retry iniciado...
   Consumo: IGNORADO (retry não consume)
   
4. Timeout novamente!
   Refund Automático: +5 créditos (SEGUNDA REFUND)
   Toast: "Retry falhou - 5 créditos reembolsados" ℹ️
   
5. Sem mais tentativas
   Toast: ❌ Erro final exibido

Saldo Final: 100 créditos ✅ (Usuario não perde nada!)
```

### Console Output
```
[Diagnosis] Consuming 5 credits for first attempt...
Running diagnosis with Base64, Session: abc123xyz...
Diagnosis Error: timeout
[Credits] Refunded 5 for: timeout
[Diagnosis] Retrying diagnosis (Attempt 2)...
[Diagnosis] Retry attempt 1. Skipping credit consumption.
Running diagnosis with Base64, Session: abc123xyz...
Diagnosis Error: timeout
[Credits] Refunded 5 for retry failure
```

### Toast Notifications
```
🟢 "5 créditos deducted para diagnóstico arquitetônico"
❌ (spinner aguardando...)
🔴 "5 créditos reembolsados devido a erro do servidor"
❌ (spinner retry...)
🔴 "Retry falhou - 5 créditos reembolsados"
❌ "Diagnóstico falhou. Servidor indisponível."
```

---

## 4. EXEMPLO: Redo com Confirmação Modal

### Cenário
Usuário já tem um diagnóstico bem-sucedido e quer refazer a análise.

### Ações do Usuário
1. Vê resultado do diagnóstico anterior
2. Clica botão "Refazer" (ou "Redo")
3. **Modal aparece**: "Refazer Análise - Isto irá custar 5 créditos"
4. Clica "Sim, Refazer"
5. Nova análise começa

### Estado Interno - Antes
```javascript
{
  status: 'success',
  showRedoConfirm: false,
  isProcessingRef: false,
  retryCountRef: 0,
  analysisStartedRef: true,
  result: { ... resultado anterior ... }
}
```

### Estado Interno - Modal Mostrado
```javascript
{
  status: 'success',
  showRedoConfirm: true,  // ← Modal ativo
  isProcessingRef: false,
  retryCountRef: 0
}
```

### Estado Interno - Após Confirmação
```javascript
{
  status: 'loading',  // ← Nova análise iniciada
  showRedoConfirm: false,  // ← Modal fechado
  isProcessingRef: true,
  retryCountRef: 0,  // ← Reset
  analysisStartedRef: false  // ← Reset
}
```

### Transações de Crédito
```
Saldo Inicial: 95 créditos (após 1º diagnóstico)

1. Usuário clica "Refazer"
   Toast: "Redo confirmado - 5 créditos serão deducted" ℹ️
   
2. Consumo: -5 créditos
   Toast: "5 créditos deducted para diagnóstico arquitetônico" ✓
   
3. Sucesso nova análise
   Toast: (nenhuma se primeira tentativa bem-sucedida)

Saldo Final: 90 créditos ✅
```

### Console Output
```
[Diagnosis] Redo requested - showing confirmation dialog
[Diagnosis] User confirmed redo - resetting analysis
[Diagnosis] Consuming 5 credits for first attempt...
Running diagnosis with Base64, Session: def456uvw...
```

### Modal UI
```
┌─────────────────────────────────┐
│ 🔄  Refazer Análise            │ X
├─────────────────────────────────┤
│                                 │
│ Você tem certeza que deseja     │
│ refazer a análise do            │
│ diagnóstico? Isto irá consumir  │
│ mais 5 créditos da sua conta.   │
│                                 │
│ ⚠️  Esta ação não pode ser      │
│ desfeita                        │
│                                 │
├─────────────────────────────────┤
│  [Cancelar]  [Sim, Refazer] 🔄 │
└─────────────────────────────────┘
```

### Toast Notifications
```
ℹ️ "Redo confirmado - 5 créditos serão deducted"
🟢 "5 créditos deducted para diagnóstico arquitetônico"
```

---

## 5. EXEMPLO: Redo Cancelado (Sem Consumo)

### Cenário
Usuário clica "Refazer" mas muda de ideia ao ver a confirmação.

### Ações do Usuário
1. Vê resultado do diagnóstico
2. Clica botão "Refazer"
3. **Modal aparece**
4. Clica "Cancelar" (ou X)
5. Modal fecha, nada acontece

### Estado Interno
```javascript
// Antes
{
  status: 'success',
  showRedoConfirm: false
}

// Modal mostrado
{
  status: 'success',
  showRedoConfirm: true  // ← Modal aberto
}

// Após cancelar
{
  status: 'success',
  showRedoConfirm: false  // ← Modal fechado
}
```

### Transações de Crédito
```
Saldo Inicial: 95 créditos

1. Usuário clica "Refazer"
   Modal aparece
   
2. Usuário clica "Cancelar"
   Modal fecha
   
3. Nada acontece!

Saldo Final: 95 créditos ✅ (Nenhuma mudança)
```

### Console Output
```
[Diagnosis] Redo requested - showing confirmation dialog
[Diagnosis] User cancelled redo
```

### Toast Notifications
```
(Nenhuma notificação)
```

---

## 6. EXEMPLO: Erro não-Servidor (Sem Refund)

### Cenário
Imagem inválida ou parâmetros ruins causam erro que não é de servidor.

### Ações do Usuário
1. Faz upload de imagem ruim
2. Clica diagnóstico
3. Vê erro: "Imagem inválida para análise"

### Estado Interno
```javascript
{
  status: 'error',
  isProcessingRef: false,
  error: "Imagem inválida para análise"
}
```

### Transações de Crédito
```
Saldo Inicial: 100 créditos

1. Consumo: -5 créditos
   Toast: "5 créditos deducted para diagnóstico arquitetônico" ✓
   
2. Erro de validação (NÃO é erro de servidor)
   Refund: NÃO ACONTECE ❌
   
3. Erro final
   Toast: ❌ Mensagem de erro

Saldo Final: 95 créditos (Usuario perde 5 créditos)
```

### Console Output
```
[Diagnosis] Consuming 5 credits for first attempt...
Running diagnosis with Base64, Session: abc123xyz...
Diagnosis Error: Imagem inválida para análise
(Note: Nenhum [Credits] Refunded message!)
```

### Toast Notifications
```
🟢 "5 créditos deducted para diagnóstico arquitetônico"
❌ "Erro ao analisar imagem. Imagem inválida para análise."
```

---

## 7. EXEMPLO: HTML Response Error (Refund)

### Cenário
Servidor retorna HTML em vez de JSON (pode ser erro 500 com página de erro).

### Ações do Usuário
1. Clica diagnóstico
2. Vê spinner
3. Sistema detecta erro e tenta retry
4. Sucesso na segunda tentativa

### Estado Interno
```javascript
// Após erro HTML
{
  status: 'loading',
  retryCountRef: 1,
  error: null  // Antes de mostrar erro final
}
```

### Transações de Crédito
```
Saldo Inicial: 100 créditos

1. Consumo: -5 créditos
   Toast: "5 créditos deducted para diagnóstico arquitetônico" ✓
   
2. HTML response detectado (isServerError = true!)
   Refund Automático: +5 créditos
   Toast: "5 créditos reembolsados devido a erro do servidor" ℹ️
   
3. Retry após 3 segundos...
   
4. Sucesso!

Saldo Final: 100 créditos ✅
```

### Console Output
```
[Diagnosis] Consuming 5 credits for first attempt...
Running diagnosis with Base64, Session: abc123xyz...
Diagnosis Error: Unexpected token < in JSON at position 0 (HTML error)
[Credits] Refunded 5 for: Unexpected token < in JSON at position 0
[Diagnosis] Retrying diagnosis (Attempt 2)...
[Diagnosis] Retry attempt 1. Skipping credit consumption.
Running diagnosis with Base64, Session: abc123xyz...
[Diagnosis] Retry succeeded - no additional charges
```

### Toast Notifications
```
🟢 "5 créditos deducted para diagnóstico arquitetônico"
🔴 "5 créditos reembolsados devido a erro do servidor"
🟢 "Análise completa - sem cobranças adicionais"
```

---

## 8. EXEMPLO: Créditos Insuficientes

### Cenário
Usuário tenta diagnóstico mas tem apenas 3 créditos (precisa de 5).

### Ações do Usuário
1. Clica diagnóstico
2. Vê erro: "Créditos insuficientes para realizar a análise"

### Estado Interno
```javascript
{
  status: 'error',
  isProcessingRef: false,
  error: "Créditos insuficientes para realizar a análise."
}
```

### Transações de Crédito
```
Saldo Inicial: 3 créditos

1. Verificação de créditos: FALHA
   Consumo: NÃO ACONTECE
   Toast: (Nenhuma de consumo)
   
2. Erro final
   Toast: ❌ "Créditos insuficientes..."

Saldo Final: 3 créditos ✅ (Nenhuma mudança)
```

### Console Output
```
[Diagnosis] Consuming credits for first attempt...
(No log de sucesso porque consumeCredits retorna false)
```

### Toast Notifications
```
❌ "Créditos insuficientes para realizar a análise."
```

---

## 9. TABELA COMPARATIVA DE CENÁRIOS

| Cenário | Consumo | Refund | Resultado | Saldo |
|---------|---------|--------|-----------|-------|
| **Sucesso** | -5 | 0 | ✅ Resultado | -5 |
| **Erro 5xx → Retry OK** | -5 | +5 | ✅ Resultado | 0 |
| **Timeout → Retry Falha** | -5 | +10 | ❌ Erro | +5 |
| **Redo OK** | -5 | 0 | ✅ Novo Resultado | -5 |
| **Redo Cancelado** | 0 | 0 | ✓ Modal fecha | 0 |
| **Erro não-servidor** | -5 | 0 | ❌ Erro | -5 |
| **HTML Error → Retry OK** | -5 | +5 | ✅ Resultado | 0 |
| **Créditos Insuficientes** | 0 | 0 | ❌ Erro | 0 |

---

## 10. LOGGING REFERENCE

### Log Prefixes para Grep

```bash
# Todos os eventos de diagnóstico
grep "\[Diagnosis\]" console.log

# Todos os eventos de créditos
grep "\[Credits\]" console.log

# Todos os refunds
grep "Refunded" console.log

# Todos os retries
grep "Retrying" console.log

# Redo events
grep "Redo" console.log
```

### Formato Padrão

```
[Module] [Action] [Details]

Exemplos:
[Diagnosis] Consuming 5 credits for first attempt...
[Diagnosis] Retry attempt 1. Skipping credit consumption.
[Diagnosis] Retrying diagnosis (Attempt 2)...
[Credits] Refunded 5 for: timeout
[Diagnosis] Redo requested - showing confirmation dialog
```

---

## 11. DEBUGGING CHECKLIST

Se algo não funciona como esperado:

### Verificar Toast Notifications
```javascript
// Em browser console:
window.__SONNER_DEBUG__ = true;
// Procure por toast messages
```

### Verificar Estado de Créditos
```javascript
// Ver valores atuais em store:
console.log(useStudioStore.getState().userCredits);
```

### Verificar Transações
```javascript
// Procure por estes logs em sequence:
// 1. [Diagnosis] Consuming...
// 2. [Diagnosis] Retrying... (if applicable)
// 3. [Credits] Refunded... (if applicable)
```

### Verificar Modal
```javascript
// Se modal não aparece:
// 1. Verifique se showRedoConfirm state muda
// 2. Verifique CSS z-index (z-[100] pode conflitar)
// 3. Verifique se backdrop-blur está renderizado
```

### Verificar Retry
```javascript
// Se retry não acontece:
// 1. Verifique se isTransient = true
// 2. Verifique se retryCountRef < 1
// 3. Verifique se elapsedTime < 60
```

---

## 12. COMANDOS ÚTEIS PARA TESTE

```bash
# Em Node REPL durante teste:

// Simular timeout
setTimeout(() => throw new Error('timeout'), 500);

// Simular erro 5xx
fetch('/api/diagnose', { method: 'POST' })
  .catch(e => { e.response = { status: 502 } });

// Simular créditos insuficientes
useCredits().consumeCredits = () => Promise.resolve(false);

// Resetar análise
retryCountRef.current = 0;
analysisStartedRef.current = false;
```

---

**FIM DOS EXEMPLOS**
