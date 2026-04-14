/**
 * Project Service - Supabase Version
 * Gerencia projetos do usuário
 *
 * Substitui: src/services/projectService.ts
 */

import { supabase, Project } from '../supabase'

export async function createProject(userId: string, projectData: {
  name: string
  description?: string
}) {
  const { data, error } = await supabase
    .from('projects')
    .insert([{
      ...projectData,
      user_id: userId,
      status: 'draft',
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data as Project
}

export async function getProject(projectId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (error) throw error
  return data as Project
}

export async function getUserProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Project[]
}

export async function updateProject(projectId: string, updates: Partial<Project>) {
  const { data, error } = await supabase
    .from('projects')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data as Project
}

export async function updateProjectStatus(projectId: string, status: string) {
  return updateProject(projectId, { status: status as any })
}

export async function toggleProjectFavorite(projectId: string, isFavorite: boolean) {
  return updateProject(projectId, { is_favorite: isFavorite })
}

export async function deleteProject(projectId: string) {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) throw error
}

export async function getFavoriteProjects(userId: string) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .eq('is_favorite', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Project[]
}

export default {
  createProject,
  getProject,
  getUserProjects,
  updateProject,
  updateProjectStatus,
  toggleProjectFavorite,
  deleteProject,
  getFavoriteProjects
}
