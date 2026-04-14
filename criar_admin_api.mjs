/**
 * Criar Usuário Admin via API Supabase
 *
 * Execute com: node criar_admin_api.mjs
 *
 * Cria usuário com:
 * - Email: paulosilvatomazeto@gmail.com
 * - Role: admin
 * - Plan: premium
 * - Créditos: 999999 (ilimitados)
 */

import https from 'https';

const SUPABASE_URL = 'https://lwsskdbpyrqcxcnrmdkw.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3c3NrZGJweXJxY3hjbnJtZGt3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE4NDI2MSwiZXhwIjoyMDkxNzYwMjYxfQ.HUS0bHgeBnBDGUlRpmwJKSgHbEI3U7sZjcbTvkeKQV8';

const email = 'paulosilvatomazeto@gmail.com';
const password = 'TempPassword123!@#';

console.log('🚀 Iniciando criação de usuário admin...\n');

function makeRequest(method, path, data, description) {
  return new Promise((resolve, reject) => {
    const requestData = JSON.stringify(data);

    const options = {
      hostname: 'lwsskdbpyrqcxcnrmdkw.supabase.co',
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestData),
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey': SERVICE_ROLE_KEY,
        'Prefer': 'return=representation'
      }
    };

    console.log(`📝 ${description}...`);

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', chunk => {
        responseData += chunk;
      });

      res.on('end', () => {
        console.log(`✓ Status: ${res.statusCode}`);

        try {
          if (responseData) {
            const parsed = JSON.parse(responseData);
            resolve(parsed);
          } else {
            resolve(null);
          }
        } catch (e) {
          console.error('❌ Erro:', responseData);
          reject(new Error(responseData));
        }
      });
    });

    req.on('error', (e) => {
      console.error('❌ Erro na requisição:', e.message);
      reject(e);
    });

    req.write(requestData);
    req.end();
  });
}

(async () => {
  try {
    // Passo 1: Criar auth user
    const authResponse = await makeRequest(
      'POST',
      '/auth/v1/admin/users',
      {
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          role: 'admin'
        }
      },
      'Criando usuário em auth.users'
    );

    const authId = authResponse.id;
    console.log(`  ID: ${authId}\n`);

    // Passo 2: Criar public user
    const publicResponse = await makeRequest(
      'POST',
      '/rest/v1/users',
      {
        auth_id: authId,
        email: email,
        display_name: 'Paulo Silva Tomázeto',
        role: 'admin',
        plan: 'premium',
        credits: 999999,
        monthly_limit: 999999,
        subscription_status: 'active'
      },
      'Criando registro em public.users'
    );

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
