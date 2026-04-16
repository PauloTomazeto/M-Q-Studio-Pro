/**
 * Usage Service - Supabase Version
 * Registra logs de uso
 *
 * Substitui: src/services/usageService.ts
 */

import { supabase, UsageLog } from '../supabase'

export async function logPromptUsage(userId: string, model?: string) {
  return logUsage(userId, 'prompt', model)
}

export async function logScanUsage(userId: string, model?: string) {
  return logUsage(userId, 'scan', model)
}

export async function logReadUsage(userId: string) {
  return logUsage(userId, 'read')
}

export async function logImageGenerationUsage(userId: string, model?: string) {
  return logUsage(userId, 'image', model)
}

export async function logVideoUsage(userId: string, model?: string) {
  return logUsage(userId, 'video', model)
}

async function logUsage(
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

export async function getUserUsageLogs(userId: string, limit: number = 100) {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as UsageLog[]
}

export async function getUsageByType(userId: string, type: string) {
  const { data, error } = await supabase
    .from('usage_logs')
    .select('*')
    .eq('user_id', userId)
    .eq('type', type)
    .order('timestamp', { ascending: false })

  if (error) throw error
  return data as UsageLog[]
}

export async function getLogs(userId?: string, limit: number = 100) {
  let query = supabase.from('usage_logs').select('*').order('timestamp', { ascending: false }).limit(limit);
  if (userId) query = query.eq('user_id', userId);
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

const usageService = {
  logPromptUsage,
  logScanUsage,
  logReadUsage,
  logImageGenerationUsage,
  logVideoUsage,
  getUserUsageLogs,
  getLogs
};

export default usageService;
