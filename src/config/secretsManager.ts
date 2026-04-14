/**
 * Secrets Manager - Environment & Secure Configuration
 * Gerencia variáveis de ambiente e configurações seguras
 *
 * Substitui: src/config/secretsManager.ts (Firebase Admin SDK)
 */

// ============================================================
// ENVIRONMENT VARIABLES VALIDATION
// ============================================================

interface EnvironmentConfig {
  supabase: {
    url: string
    anonKey: string
    serviceRoleKey: string
  }
  kieApi: {
    url: string
    apiKey: string
    webhookSecret: string
  }
  app: {
    environment: 'development' | 'staging' | 'production'
    apiUrl: string
    frontendUrl: string
  }
}

const requiredEnvVars = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
] as const

const optionalEnvVars = [
  'VITE_KIE_API_KEY',
  'KIE_API_KEY',
  'KIE_WEBHOOK_SECRET',
  'VITE_API_URL',
  'VITE_FRONTEND_URL'
] as const

// ============================================================
// SECRETS MANAGER CLASS
// ============================================================

class SecretsManager {
  private config: EnvironmentConfig
  private validated: boolean = false

  constructor() {
    this.config = this.loadConfig()
    this.validate()
  }

  private loadConfig(): EnvironmentConfig {
    return {
      supabase: {
        url: process.env.VITE_SUPABASE_URL || '',
        anonKey: process.env.VITE_SUPABASE_ANON_KEY || '',
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
      },
      kieApi: {
        url: 'https://api.kie.ai/v1',
        apiKey: process.env.VITE_KIE_API_KEY || process.env.KIE_API_KEY || '',
        webhookSecret: process.env.KIE_WEBHOOK_SECRET || 'webhook-secret'
      },
      app: {
        environment: (process.env.NODE_ENV as any) || 'development',
        apiUrl: process.env.VITE_API_URL || 'http://localhost:5173/api',
        frontendUrl: process.env.VITE_FRONTEND_URL || 'http://localhost:5173'
      }
    }
  }

  private validate(): void {
    const missing: string[] = []

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        missing.push(envVar)
      }
    }

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        'Please check your .env file or environment setup.'
      )
    }

    this.validated = true
  }

  // ============================================================
  // GETTERS
  // ============================================================

  getSupabaseUrl(): string {
    return this.config.supabase.url
  }

  getSupabaseAnonKey(): string {
    return this.config.supabase.anonKey
  }

  getSupabaseServiceRoleKey(): string {
    return this.config.supabase.serviceRoleKey
  }

  getKieApiKey(): string {
    return this.config.kieApi.apiKey
  }

  getKieWebhookSecret(): string {
    return this.config.kieApi.webhookSecret
  }

  getEnvironment(): string {
    return this.config.app.environment
  }

  getApiUrl(): string {
    return this.config.app.apiUrl
  }

  getFrontendUrl(): string {
    return this.config.app.frontendUrl
  }

  isProduction(): boolean {
    return this.config.app.environment === 'production'
  }

  isDevelopment(): boolean {
    return this.config.app.environment === 'development'
  }

  // ============================================================
  // VALIDATION
  // ============================================================

  isValid(): boolean {
    return this.validated
  }

  getStatus(): {
    validated: boolean
    supabaseConfigured: boolean
    kieApiConfigured: boolean
    environment: string
  } {
    return {
      validated: this.validated,
      supabaseConfigured: !!this.config.supabase.url && !!this.config.supabase.anonKey,
      kieApiConfigured: !!this.config.kieApi.apiKey,
      environment: this.config.app.environment
    }
  }

  // ============================================================
  // DEBUGGING
  // ============================================================

  printStatus(): void {
    const status = this.getStatus()
    console.log('=== Secrets Manager Status ===')
    console.log(`✓ Validated: ${status.validated}`)
    console.log(`✓ Supabase: ${status.supabaseConfigured ? 'CONFIGURED' : 'MISSING'}`)
    console.log(`✓ KIE API: ${status.kieApiConfigured ? 'CONFIGURED' : 'OPTIONAL'}`)
    console.log(`✓ Environment: ${status.environment}`)
    console.log('==============================')
  }

  // ============================================================
  // EXPORT FOR CLIENT
  // ============================================================

  getClientConfig(): {
    supabaseUrl: string
    supabaseAnonKey: string
    kieApiKey?: string
    apiUrl: string
  } {
    return {
      supabaseUrl: this.getSupabaseUrl(),
      supabaseAnonKey: this.getSupabaseAnonKey(),
      kieApiKey: this.getKieApiKey() || undefined,
      apiUrl: this.getApiUrl()
    }
  }

  // ============================================================
  // EXPORT FOR SERVER
  // ============================================================

  getServerConfig(): {
    supabaseUrl: string
    supabaseServiceRoleKey: string
    kieApiKey: string
    kieWebhookSecret: string
    apiUrl: string
  } {
    return {
      supabaseUrl: this.getSupabaseUrl(),
      supabaseServiceRoleKey: this.getSupabaseServiceRoleKey(),
      kieApiKey: this.getKieApiKey(),
      kieWebhookSecret: this.getKieWebhookSecret(),
      apiUrl: this.getApiUrl()
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let instance: SecretsManager | null = null

export function getSecretsManager(): SecretsManager {
  if (!instance) {
    instance = new SecretsManager()
  }
  return instance
}

// ============================================================
// EXPORTS
// ============================================================

export const secretsManager = getSecretsManager()

export default secretsManager
