/**
 * Criar Usuário Admin via API Supabase
 *
 * Execute com: node criar_admin_api.js
 *
 * Cria usuário com:
 * - Email: paulosilvatomazeto@gmail.com
 * - Role: admin
 * - Plan: premium
 * - Créditos: 999999 (ilimitados)
 */

const https = require('https');

const SUPABASE_URL = 'https://lwsskdbpyrqcxcnrmdkw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3c3NrZGJweXJxY3hjbnJtZGt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4NDI2MSwiZXhwIjoyMDkxNzYwMjYxfQ.HUS0bHgeBnBDGUlRpmwJKSgHbEI3U7sZjcbTvkeKQV8';

const email = 'paulosilvatomazeto@gmail.com';
const password = 'TempPassword123!@#'; // Será resetado via Google

console.log('🚀 Iniciando criação de usuário admin...\n');

// ============================================================
// PASSO 1: Criar usuário em auth.users
// ============================================================

function createAuthUser() {
  return new Promise((resolve, reject) => {
    const createUserData = JSON.stringify({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        role: 'admin'
      }
    });

    const options = {
      hostname: 'lwsskdbpyrqcxcnrmdkw.supabase.co',
      path: '/auth/v1/admin/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(createUserData),
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY
      }
    };

    console.log('📝 Criando usuário em auth.users...');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✓ Status: ${res.statusCode}`);

        try {
          const response = JSON.parse(data);
          console.log(`✓ Usuário criado em auth.users`);
          console.log(`  ID: ${response.id}`);
          resolve(response.id);
        } catch (e) {
          console.error('❌ Erro ao criar auth user:', data);
          reject(new Error(data));
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erro na requisição:', e.message);
      reject(e);
    });

    req.write(createUserData);
    req.end();
  });
}

// ============================================================
// PASSO 2: Criar registro em public.users
// ============================================================

function createPublicUser(authId) {
  return new Promise((resolve, reject) => {
    const createPublicUserData = JSON.stringify({
      auth_id: authId,
      email: email,
      display_name: 'Paulo Silva Tomázeto',
      role: 'admin',
      plan: 'premium',
      credits: 999999,
      monthly_limit: 999999,
      subscription_status: 'active'
    });

    const options = {
      hostname: 'lwsskdbpyrqcxcnrmdkw.supabase.co',
      path: '/rest/v1/users',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(createPublicUserData),
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Prefer': 'return=representation'
      }
    };

    console.log('\n📝 Criando registro em public.users...');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        console.log(`✓ Status: ${res.statusCode}`);

        try {
          const response = JSON.parse(data);
          if (Array.isArray(response) && response.length > 0) {
            console.log(`✓ Usuário criado em public.users`);
            resolve(response[0]);
          } else {
            console.error('❌ Erro ao criar usuário público:', data);
            reject(new Error('Failed to create public user'));
          }
        } catch (e) {
          console.error('❌ Erro ao fazer parse da resposta:', data);
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erro na requisição:', e.message);
      reject(e);
    });

    req.write(createPublicUserData);
    req.end();
  });
}

// ============================================================
// EXECUTAR
// ============================================================

(async () => {
  try {
    // Passo 1: Criar auth user
    const authId = await createAuthUser();

    // Passo 2: Criar public user
    const publicUser = await createPublicUser(authId);

    console.log('\n' + '='.repeat(60));
    console.log('✅ SUCESSO! Usuário Admin Criado');
    console.log('='.repeat(60));
    console.log('\n📋 Detalhes:');
    console.log(`  Email: ${email}`);
    console.log(`  Role: admin`);
    console.log(`  Plan: premium`);
    console.log(`  Créditos: 999999`);
    console.log(`  Status: active`);
    console.log('\n🔐 Próximas ações:');
    console.log('  1. Faça login com Google usando este email');
    console.log('  2. O Supabase sincronizará automaticamente');
    console.log('  3. Você será Admin Premium com Créditos Ilimitados!\n');

  } catch (error) {
    console.error('\n❌ ERRO:', error.message);
    process.exit(1);
  }
})();
