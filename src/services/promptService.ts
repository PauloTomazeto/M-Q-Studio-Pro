/**
 * Prompt Service - Supabase Version
 * Gerencia prompts salvos
 *
 * Substitui: src/services/promptService.ts
 */

import { supabase, Prompt, PromptVersion } from '../supabase'

// ============================================================
// PROMPTS
// ============================================================

export async function createPrompt(userId: string, promptData: {
  content: string
  visibility?: 'private' | 'shared' | 'public'
  prompt_source?: string
}) {
  const { data, error } = await supabase
    .from('prompts')
    .insert([{
      ...promptData,
      user_id: userId,
      version: 1,
      visibility: promptData.visibility || 'private',
      is_locked: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data as Prompt
}

export async function getPrompt(promptId: string) {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('id', promptId)
    .single()

  if (error) throw error
  return data as Prompt
}

export async function getUserPrompts(userId: string) {
  const { data, error } = await supabase
    .from('prompts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Prompt[]
}

export async function updatePrompt(promptId: string, content: string) {
  const prompt = await getPrompt(promptId)

  // Criar nova versão
  const newVersion = prompt.version + 1
  await supabase
    .from('prompt_versions')
    .insert([{
      prompt_id: promptId,
      version: newVersion,
      content,
      edited_by: prompt.user_id,
      timestamp: new Date().toISOString()
    }])

  // Atualizar prompt
  const { data, error } = await supabase
    .from('prompts')
    .update({
      content,
      version: newVersion,
      updated_at: new Date().toISOString()
    })
    .eq('id', promptId)
    .select()
    .single()

  if (error) throw error
  return data as Prompt
}

export async function updatePromptVisibility(
  promptId: string,
  visibility: 'private' | 'shared' | 'public'
) {
  const { data, error } = await supabase
    .from('prompts')
    .update({
      visibility,
      updated_at: new Date().toISOString()
    })
    .eq('id', promptId)
    .select()
    .single()

  if (error) throw error
  return data as Prompt
}

export async function deletePrompt(promptId: string) {
  const { error } = await supabase
    .from('prompts')
    .delete()
    .eq('id', promptId)

  if (error) throw error
}

// ============================================================
// PROMPT VERSIONS
// ============================================================

export async function getPromptVersions(promptId: string) {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('prompt_id', promptId)
    .order('version', { ascending: false })

  if (error) throw error
  return data as PromptVersion[]
}

export async function getPromptVersion(promptId: string, version: number) {
  const { data, error } = await supabase
    .from('prompt_versions')
    .select('*')
    .eq('prompt_id', promptId)
    .eq('version', version)
    .single()

  if (error) throw error
  return data as PromptVersion
}

export async function restorePromptVersion(promptId: string, version: number) {
  const versionData = await getPromptVersion(promptId, version)
  return updatePrompt(promptId, versionData.content)
}

// ============================================================
// PROMPT SHARING & FAVORITES
// ============================================================

export async function sharePrompt(promptId: string, userId: string, sharedBy: string) {
  const { data, error } = await supabase
    .from('user_prompt_shares')
    .insert([{
      prompt_id: promptId,
      user_id: userId,
      shared_by: sharedBy,
      created_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function unsharePrompt(promptId: string, userId: string) {
  const { error } = await supabase
    .from('user_prompt_shares')
    .delete()
    .eq('prompt_id', promptId)
    .eq('user_id', userId)

  if (error) throw error
}

export async function getSharedPrompts(userId: string) {
  const { data, error } = await supabase
    .from('user_prompt_shares')
    .select('prompt_id')
    .eq('user_id', userId)

  if (error) throw error
  return data
}

export async function favoritePrompt(userId: string, promptId: string) {
  const { data, error } = await supabase
    .from('user_prompt_favorites')
    .insert([{
      user_id: userId,
      prompt_id: promptId,
      created_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function unfavoritePrompt(userId: string, promptId: string) {
  const { error } = await supabase
    .from('user_prompt_favorites')
    .delete()
    .eq('user_id', userId)
    .eq('prompt_id', promptId)

  if (error) throw error
}

export async function getUserFavoritePrompts(userId: string) {
  const { data, error } = await supabase
    .from('user_prompt_favorites')
    .select('prompt_id')
    .eq('user_id', userId)

  if (error) throw error
  return data
}

export default {
  createPrompt,
  getPrompt,
  getUserPrompts,
  updatePrompt,
  updatePromptVisibility,
  deletePrompt,
  getPromptVersions,
  getPromptVersion,
  restorePromptVersion,
  sharePrompt,
  unsharePrompt,
  getSharedPrompts,
  favoritePrompt,
  unfavoritePrompt,
  getUserFavoritePrompts
}
