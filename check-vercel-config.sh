#!/bin/bash

# Vercel Configuration Checker
# Verifica se tudo está pronto para deploy

echo "🔍 Verificando Configuração para Vercel..."
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Check 1: vercel.json exists
echo -n "1️⃣  vercel.json... "
if [ -f "vercel.json" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ Não encontrado${NC}"
    ((FAIL++))
fi

# Check 2: .env exists
echo -n "2️⃣  .env configurado... "
if [ -f ".env" ]; then
    if grep -q "VITE_SUPABASE_URL" .env; then
        echo -e "${GREEN}✓${NC}"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠ Incompleto (faltam variáveis)${NC}"
        ((FAIL++))
    fi
else
    echo -e "${RED}✗ Não encontrado${NC}"
    echo "   Copie .env.example para .env e configure"
    ((FAIL++))
fi

# Check 3: package.json scripts
echo -n "3️⃣  package.json scripts... "
if grep -q '"build": "vite build"' package.json; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ Scripts incorretos${NC}"
    ((FAIL++))
fi

# Check 4: server.ts exists
echo -n "4️⃣  server.ts (Express)... "
if [ -f "server.ts" ]; then
    if grep -q "export default" server.ts; then
        echo -e "${GREEN}✓${NC}"
        ((PASS++))
    else
        echo -e "${YELLOW}⚠ Sem export default${NC}"
        ((FAIL++))
    fi
else
    echo -e "${RED}✗ Não encontrado${NC}"
    ((FAIL++))
fi

# Check 5: vite.config.ts exists
echo -n "5️⃣  vite.config.ts... "
if [ -f "vite.config.ts" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
else
    echo -e "${RED}✗ Não encontrado${NC}"
    ((FAIL++))
fi

# Check 6: node_modules exists
echo -n "6️⃣  node_modules (dependencies)... "
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ Não encontrado - execute: npm install${NC}"
    ((FAIL++))
fi

# Check 7: dist folder
echo -n "7️⃣  dist/ (build output)... "
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ Não encontrado - execute: npm run build${NC}"
    ((FAIL++))
fi

# Check 8: Environment variables
echo -n "8️⃣  Variáveis de ambiente... "
MISSING=()
for var in "VITE_SUPABASE_URL" "VITE_SUPABASE_ANON_KEY" "VITE_STORAGE_BUCKET_NAME" "KIE_API_KEY"; do
    if ! grep -q "$var" .env 2>/dev/null; then
        MISSING+=("$var")
    fi
done

if [ ${#MISSING[@]} -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
    ((PASS++))
else
    echo -e "${YELLOW}⚠ Faltando: ${MISSING[*]}${NC}"
    ((FAIL++))
fi

echo ""
echo "════════════════════════════════════"
echo -e "Resultados: ${GREEN}$PASS ✓${NC} | ${RED}$FAIL ✗${NC}"
echo "════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ Tudo pronto para deploy na Vercel!${NC}"
    echo ""
    echo "Próximos passos:"
    echo "1. Adicionar variáveis de ambiente no Vercel Dashboard"
    echo "2. Configurar CORS no Supabase (incluir seu domínio Vercel)"
    echo "3. git push para GitHub"
    echo "4. Deploy automático na Vercel"
    exit 0
else
    echo -e "${RED}❌ Corrija os erros acima antes de fazer deploy${NC}"
    exit 1
fi
