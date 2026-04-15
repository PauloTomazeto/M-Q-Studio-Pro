/**
 * Admin Service - Supabase Version
 * Gerencia usuários, planos, configurações
 *
 * Substitui: src/services/adminService.ts
 */

import { supabase, User, Plan, UsageLog } from '../supabase'

// ============================================================
// USERS
// ============================================================

export async function getUser(userId: string) {
  // Tenta buscar por id (UUID interno) ou auth_id (UUID do Auth)
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`id.eq.${userId},auth_id.eq.${userId}`)
    .maybeSingle()

  if (error) {
    console.error("Error fetching user:", error);
    return null;
  }
  return data as User
}

export async function getUserByEmail(email: string) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single()

  if (error) throw error
  return data as User
}

export async function createUser(userData: {
  auth_id: string
  email: string
  display_name?: string
  plan?: string
  credits?: number
}) {
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single()

  if (error) throw error
  return data as User
}

export async function updateUser(userId: string, updates: Partial<User>) {
  const { data, error } = await supabase
    .from('users')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data as User
}

export async function updateUserPlan(userId: string, newPlan: string) {
  return updateUser(userId, { plan: newPlan as any })
}

export async function updateUserCredits(userId: string, newCredits: number) {
  return updateUser(userId, { credits: newCredits })
}

export async function updateUserMonthlySpent(userId: string, amount: number) {
  return updateUser(userId, { monthly_spent: amount })
}

// ============================================================
// PLANS
// ============================================================

export async function getPlans() {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('price', { ascending: true })

  if (error) throw error
  return data as Plan[]
}

export async function getPlanByName(name: string) {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('name', name)
    .single()

  if (error) throw error
  return data as Plan
}

// ============================================================
// USAGE LOGS
// ============================================================

export async function getUsageLogs(userId: string, limit: number = 100) {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as UsageLog[]
}

export async function logUsage(
  userId: string,
  type: 'prompt' | 'scan' | 'read' | 'image' | 'video',
  model?: string
) {
  const { data, error } = await supabase
    .from('usage_logs')
    .insert([{
      user_id: userId,
      type,
      model,
      timestamp: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data as UsageLog
}

// ============================================================
// CONFIG
// ============================================================

export async function getAppConfig(key: string) {
  const { data, error } = await supabase
    .from('app_config')
    .select('*')
    .eq('key', key)
    .single()

  if (error) throw error
  return data
}

export async function getAllConfigs() {
  const { data, error } = await supabase
    .from('app_config')
    .select('*')

  if (error) throw error
  return data
}

export async function updateAppConfig(key: string, value: Record<string, any>) {
  const { data, error } = await supabase
    .from('app_config')
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString()
    })
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================================
// ADMIN HELPERS
// ============================================================

/**
 * Get all users (ADMIN ONLY)
 * SECURITY: This function relies on Supabase RLS policies to restrict access.
 * Ensure that RLS is enabled on the 'users' table and only admins can execute this query.
 * Without RLS, this will return all users in the database.
 */
export async function getAllUsers(limit: number = 100) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as User[]
}

export async function getUserStatistics(userId: string) {
  const user = await getUser(userId)

  const { count: generationCount } = await supabase
    .from('image_generations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  const { count: projectCount } = await supabase
    .from('projects')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  return {
    user,
    generationCount: generationCount || 0,
    projectCount: projectCount || 0,
    creditsRemaining: user.credits,
    monthlySpent: user.monthly_spent
  }
}

export async function deleteUser(userId: string) {
  // Deletar usuário (isso vai em cascata deletar projetos, gerações, etc)
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) throw error
}

export default {
  getUser,
  getUserByEmail,
  createUser,
  updateUser,
  updateUserPlan,
  updateUserCredits,
  updateUserMonthlySpent,
  getPlans,
  getPlanByName,
  getUsageLogs,
  logUsage,
  getAppConfig,
  getAllConfigs,
  updateAppConfig,
  getAllUsers,
  getUserStatistics,
  deleteUser
}
