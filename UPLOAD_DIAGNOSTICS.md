# Diagnóstico e Correção de Upload Infinito

## Problema Identificado
A barra de progresso do upload fica travada em 0% com a mensagem "Enviando para o servidor..."

## Causas Raiz
1. ❌ Sem monitoramento de progresso - callbacks não implementados
2. ❌ Sem timeout handling - requisição pode ficar pendente indefinidamente
3. ❌ Sem retry logic - falhas de rede não são tratadas
4. ❌ CORS não configurado corretamente no Supabase

## Correções Implementadas

### 1. ✅ Monitoramento de Progresso
- Adicionado callback `onProgress` em `uploadImage()`
- Progresso reportado em etapas: 10%, 20%, 30%, 40%... até 100%
- Barra de progresso agora atualiza em tempo real

### 2. ✅ Timeout Handling
- Timeout de 60 segundos implementado em `storageService.ts`
- Erro claro `UPLOAD_TIMEOUT` se o servidor não responder
- Retry automático com backoff exponencial (1s, 2s, 4s)

### 3. ✅ Retry Logic com Exponential Backoff
- Até 3 tentativas automáticas
- Aguarda 1s → 2s → 4s entre tentativas
- Erros de rede/CORS são reutentados
- Erros de autenticação (401/403) falham imediatamente

### 4. ✅ Mensagens de Erro Melhoradas
- Mapeamento claro de códigos de erro
- Instruções úteis para o usuário
- Diagnóstico no console para developers

## Checklist de Configuração

### Variáveis de Ambiente (.env)
```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key
VITE_STORAGE_BUCKET_NAME=user-uploads
```

### Configuração do Supabase Storage
1. **Criar bucket** chamado `user-uploads` (ou outro nome em VITE_STORAGE_BUCKET_NAME)
2. **Configurar CORS** no Supabase:
   ```json
   {
     "allowedHeaders": ["*"],
     "allowedMethods": ["GET", "POST", "PUT", "DELETE"],
     "allowedOrigins": ["http://localhost:5173", "https://seu-dominio.com"],
     "exposedHeaders": [],
     "maxAgeSeconds": 3600
   }
   ```
3. **Configurar políticas RLS** (Row Level Security):
   - Leitura pública: `true`
   - Upload autenticado: `(auth.uid() = owner_id)`

### Configuração de Tabelas Supabase
Tabelas necessárias:
- `image_uploads` - registra uploads
- `file_deduplication_index` - deduplicação via SHA256
- `user_upload_quotas` - limites diários

## Diagnóstico em Tempo Real

### Verificar no Console do Navegador (F12)
```
1. Abrir Aba "Network"
2. Fazer upload de imagem
3. Procurar por request para Supabase:
   - Deve terminar em ~2-10s (não infinito)
   - Status: 200 ou erro claro (4xx/5xx)
   - Headers incluem "Authorization: Bearer ..."
```

### Erros Comuns e Soluções

| Erro | Causa | Solução |
|------|-------|---------|
| CORS_ERROR | Supabase CORS não configurado | Adicionar origem em Supabase > Storage > CORS |
| AUTH_REQUIRED | Usuário não autenticado | Fazer login antes de upload |
| UPLOAD_TIMEOUT | Servidor lento/indisponível | Verificar status do Supabase |
| FILE_TOO_LARGE | Arquivo > 20MB | Comprimir ou selecionar arquivo menor |
| UPLOAD_FAILED + Network | Problema de conexão | Verificar internet, retry automático em 3x |

## Teste de Verificação Rápida

```javascript
// Colar no console (F12) quando travado:
fetch('https://seu-projeto.supabase.co/storage/v1/buckets')
  .then(r => r.json())
  .then(d => console.log('✅ Supabase conectando:', d))
  .catch(e => console.log('❌ Erro CORS/Conexão:', e.message))
```

## Próximas Melhorias
- [ ] Adicionar compressão real de imagens (atualmente retorna original)
- [ ] Implementar upload em chunks para arquivos grandes
- [ ] Adicionar cancelamento de upload (AbortController)
- [ ] Persistência de progresso em localStorage

---
**Última atualização**: 2026-04-16
**Versão**: 1.0
