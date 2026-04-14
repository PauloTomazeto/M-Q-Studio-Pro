/**
 * Image Generation Service - Supabase Version
 * Gerencia gerações de imagens
 *
 * Substitui: src/services/imageGenerationService.ts
 */

import { supabase, ImageGeneration } from '../supabase'

// ============================================================
// IMAGE GENERATIONS
// ============================================================

export async function createGeneration(generation: {
  user_id: string
  project_id?: string
  session_id?: string
  prompt_content: string
  credits_cost?: number
}) {
  const { data, error } = await supabase
    .from('image_generations')
    .insert([{
      ...generation,
      generation_status: 'pending',
      progress_percentage: 0,
      image_urls: [],
      created_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data as ImageGeneration
}

export async function getGeneration(generationId: string) {
  const { data, error } = await supabase
    .from('image_generations')
    .select('*')
    .eq('id', generationId)
    .single()

  if (error) throw error
  return data as ImageGeneration
}

export async function getUserGenerations(userId: string, limit: number = 50) {
  const { data, error } = await supabase
    .from('image_generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as ImageGeneration[]
}

export async function getProjectGenerations(projectId: string) {
  const { data, error } = await supabase
    .from('image_generations')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ImageGeneration[]
}

// ============================================================
// UPDATE GENERATION STATUS
// ============================================================

export async function updateGenerationStatus(
  generationId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed',
  updates?: Partial<ImageGeneration>
) {
  const { data, error } = await supabase
    .from('image_generations')
    .update({
      generation_status: status,
      ...updates
    })
    .eq('id', generationId)
    .select()
    .single()

  if (error) throw error
  return data as ImageGeneration
}

export async function updateGenerationProgress(generationId: string, progress: number) {
  return updateGenerationStatus(generationId, 'processing', {
    progress_percentage: Math.min(100, Math.max(0, progress))
  } as any)
}

export async function completeGeneration(
  generationId: string,
  imageUrl: string,
  kieApiModel?: string,
  kieApiRequestId?: string
) {
  return updateGenerationStatus(generationId, 'completed', {
    image_url: imageUrl,
    image_urls: [imageUrl],
    kie_api_model: kieApiModel,
    kie_api_request_id: kieApiRequestId,
    progress_percentage: 100,
    completed_at: new Date().toISOString(),
    credits_deducted: true
  } as any)
}

export async function failGeneration(
  generationId: string,
  errorMessage: string
) {
  return updateGenerationStatus(generationId, 'failed', {
    error_message: errorMessage,
    progress_percentage: 0
  } as any)
}

// ============================================================
// GENERATION QUERIES
// ============================================================

export async function getGenerationsByStatus(
  userId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed'
) {
  const { data, error } = await supabase
    .from('image_generations')
    .select('*')
    .eq('user_id', userId)
    .eq('generation_status', status)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ImageGeneration[]
}

export async function getPendingGenerations() {
  const { data, error } = await supabase
    .from('image_generations')
    .select('*')
    .eq('generation_status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as ImageGeneration[]
}

export async function getRecentGenerations(userId: string, days: number = 30) {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)

  const { data, error } = await supabase
    .from('image_generations')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', dateFrom.toISOString())
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ImageGeneration[]
}

// ============================================================
// GENERATION STATISTICS
// ============================================================

export async function getUserGenerationStats(userId: string) {
  const { count: totalGenerations } = await supabase
    .from('image_generations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)

  const { count: completedGenerations } = await supabase
    .from('image_generations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('generation_status', 'completed')

  const { count: failedGenerations } = await supabase
    .from('image_generations')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .eq('generation_status', 'failed')

  return {
    total: totalGenerations || 0,
    completed: completedGenerations || 0,
    failed: failedGenerations || 0,
    successRate: totalGenerations ? ((completedGenerations || 0) / totalGenerations) * 100 : 0
  }
}

// ============================================================
// DELETE GENERATION
// ============================================================

export async function deleteGeneration(generationId: string) {
  const { error } = await supabase
    .from('image_generations')
    .delete()
    .eq('id', generationId)

  if (error) throw error
}

export default {
  createGeneration,
  getGeneration,
  getUserGenerations,
  getProjectGenerations,
  updateGenerationStatus,
  updateGenerationProgress,
  completeGeneration,
  failGeneration,
  getGenerationsByStatus,
  getPendingGenerations,
  getRecentGenerations,
  getUserGenerationStats,
  deleteGeneration
}
