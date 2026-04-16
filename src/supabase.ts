/**
 * Supabase Client for MQ STUDIO PRO
 * Replace src/firebase.ts with this file
 *
 * Usage:
 * import { supabase } from '@/supabase'
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Environment variables (must be set in .env)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase credentials. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env'
  )
}

/**
 * Supabase Client Instance
 *
 * Features:
 * - Authentication (JWT tokens from Supabase Auth)
 * - Row Level Security (RLS) automatic enforcement
 * - Real-time subscriptions via Realtime channels
 * - PostgreSQL via PostgREST API
 * - File storage via Storage API
 */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

/**
 * Types for Supabase Tables
 */

export interface User {
  id: string
  auth_id: string
  email: string
  display_name?: string
  role: 'user' | 'admin'
  plan: 'basic' | 'pro' | 'premium'
  credits: number
  monthly_spent: number
  monthly_limit: number
  reset_date?: string
  subscription_status: string
  stripe_customer_id?: string
  mode_history?: any[]
  created_at: string
  updated_at: string
}

export interface ImageGeneration {
  id: string
  user_id: string
  project_id?: string
  session_id?: string
  prompt_content: string
  generation_status: 'pending' | 'processing' | 'completed' | 'failed'
  progress_percentage: number
  image_url?: string
  image_urls: string[]
  credits_cost?: number
  credits_deducted: boolean
  kie_api_model?: string
  kie_api_request_id?: string
  error_message?: string
  created_at: string
  completed_at?: string
}

export interface CreditAuditLog {
  id: string
  user_id: string
  amount: number
  type: 'debit' | 'credit' | 'refund'
  reason?: string
  reference_id?: string
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'draft' | 'in_progress' | 'completed' | 'archived'
  is_favorite: boolean
  created_at: string
  updated_at: string
}

export interface Prompt {
  id: string
  user_id: string
  content: string
  version: number
  quality_score?: number
  visibility: 'private' | 'shared' | 'public'
  prompt_source?: string
  is_locked: boolean
  created_at: string
  updated_at: string
}

export interface PromptVersion {
  id: string
  prompt_id: string
  version: number
  content: string
  edited_by?: string
  timestamp: string
}

export interface GenerationSession {
  id: string
  user_id: string
  image_original_url?: string
  mode?: 'prompt' | 'move'
  scan_status?: string
  created_at: string
}

export interface ScanResult {
  id: string
  user_id: string
  session_id?: string
  scan_data?: Record<string, any>
  created_at: string
}

export interface ImageUpload {
  id: string
  user_id: string
  sha256?: string
  storage_path?: string
  mime_type?: string
  dimensions?: Record<string, any>
  created_at: string
}

export interface FileValidationResult {
  id: string
  user_id: string
  upload_id?: string
  validation_steps?: Record<string, any>
  validation_passed?: boolean
  created_at: string
}

export interface UserUploadQuota {
  user_id: string
  daily_uploads_count: number
  daily_limit: number
  period_start: string
  updated_at: string
}

export interface FileDeduplicationIndex {
  file_hash: string
  original_storage_path?: string
  reuse_count: number
  created_at: string
}

export interface UsageLog {
  id: string
  user_id: string
  type: 'prompt' | 'scan' | 'read' | 'image' | 'video'
  model?: string
  timestamp: string
}

export interface Plan {
  id: string
  name: string
  price?: number
  credits?: number
  features: string[]
  stripe_price_id?: string
  created_at: string
  updated_at: string
}

export interface AppConfig {
  key: string
  value: Record<string, any>
  updated_at: string
}

export interface UserPromptShare {
  id: string
  user_id: string
  prompt_id: string
  shared_by?: string
  created_at: string
}

export interface UserPromptFavorite {
  id: string
  user_id: string
  prompt_id: string
  created_at: string
}

/**
 * Helper Functions
 */

export async function getCurrentUser() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

export async function getCurrentUserProfile() {
  const user = await getCurrentUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('auth_id', user.id)
    .single()

  if (error) throw error
  return data as User
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  })
  if (error) throw error
  return data
}

export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function onAuthStateChange(callback: (user: any) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null)
  })
  return data.subscription.unsubscribe
}

export async function uploadFile(bucket: string, path: string, file: File, maxRetries = 3) {
  let lastError: any

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller with 60s timeout
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 60000)

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false,
          // Note: Supabase JS client doesn't expose AbortSignal directly,
          // but we catch timeout errors below
        })

      clearTimeout(timeout)

      if (error) {
        lastError = error

        // Retry on network/timeout errors
        if (
          attempt < maxRetries &&
          (error.message?.includes('Failed to fetch') ||
            error.message?.includes('timeout') ||
            error.message?.includes('Network') ||
            error.message?.includes('CORS'))
        ) {
          console.warn(`Upload attempt ${attempt + 1} failed, retrying...`, error.message)
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
          continue
        }

        throw error
      }

      clearTimeout(timeout)
      return data
    } catch (err: any) {
      lastError = err

      // Don't retry authentication or validation errors
      if (
        err.message?.includes('401') ||
        err.message?.includes('403') ||
        err.message?.includes('invalid') ||
        err.message?.includes('not found')
      ) {
        throw err
      }

      if (attempt < maxRetries) {
        console.warn(`Upload attempt ${attempt + 1} failed, retrying...`, err.message)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }
  }

  // After all retries failed
  if (lastError?.message?.includes('CORS') || lastError?.message?.includes('Failed to fetch')) {
    throw new Error('CORS_ERROR: Unable to connect to storage server. Check VITE_STORAGE_BUCKET_NAME and Supabase CORS settings.')
  }

  throw lastError || new Error('Upload failed after multiple attempts')
}

export async function downloadFile(bucket: string, path: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(path)

  if (error) throw error
  return data
}

export function getPublicFileUrl(bucket: string, path: string) {
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

export async function callRPC(functionName: string, params?: Record<string, any>) {
  const { data, error } = await supabase.rpc(functionName, params)
  if (error) throw error
  return data
}

export function subscribeToTable(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*' = '*',
  callback: (payload: any) => void,
  filter?: string
) {
  const channel = supabase
    .channel(`${table}:changes`)
    .on(
      'postgres_changes',
      {
        event,
        schema: 'public',
        table,
        filter
      },
      callback
    )
    .subscribe()

  return () => channel.unsubscribe()
}

export type Database = {
  public: {
    Tables: {
      users: { Row: User; Insert: Omit<User, 'id' | 'created_at' | 'updated_at'> }
      image_generations: { Row: ImageGeneration }
      credit_audit_logs: { Row: CreditAuditLog }
      projects: { Row: Project }
      prompts: { Row: Prompt }
      prompt_versions: { Row: PromptVersion }
      generation_sessions: { Row: GenerationSession }
      scan_results: { Row: ScanResult }
      image_uploads: { Row: ImageUpload }
      file_validation_results: { Row: FileValidationResult }
      user_upload_quotas: { Row: UserUploadQuota }
      file_deduplication_index: { Row: FileDeduplicationIndex }
      usage_logs: { Row: UsageLog }
      plans: { Row: Plan }
      app_config: { Row: AppConfig }
      user_prompt_shares: { Row: UserPromptShare }
      user_prompt_favorites: { Row: UserPromptFavorite }
    }
  }
}

export default supabase
