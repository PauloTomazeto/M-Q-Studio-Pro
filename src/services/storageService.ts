/**
 * Storage Service - Supabase Version
 * Gerencia uploads de arquivos e deduplicação
 *
 * Substitui: src/services/storageService.ts
 */

import { supabase, uploadFile, deleteFile, getPublicFileUrl, ImageUpload } from '../supabase'
import crypto from 'crypto'

// ============================================================
// FILE UPLOAD
// ============================================================

export async function uploadImage(userId: string, file: File) {
  // Gerar SHA256 do arquivo
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = crypto.createHash('sha256').update(new Uint8Array(arrayBuffer)).digest()
  const sha256 = hashBuffer.toString('hex')

  // Checar se arquivo já existe (deduplicação)
  const existingUpload = await getUploadBySha256(sha256)
  if (existingUpload) {
    // Incrementar reuse count
    await incrementFileReuse(sha256)
    return existingUpload
  }

  // Fazer upload para Supabase Storage
  const filename = `${userId}/${Date.now()}-${file.name}`
  const { name: storagePath } = await uploadFile('user-uploads', filename, file)

  // Registrar no banco de dados
  const dimensions = await getImageDimensions(file)
  const uploadRecord = await createImageUpload({
    user_id: userId,
    sha256,
    storage_path: storagePath,
    mime_type: file.type,
    dimensions
  })

  // Registrar na deduplicação
  await recordFileDeduplication(sha256, storagePath)

  return uploadRecord
}

export async function createImageUpload(uploadData: {
  user_id: string
  sha256?: string
  storage_path?: string
  mime_type?: string
  dimensions?: Record<string, any>
}) {
  const { data, error } = await supabase
    .from('image_uploads')
    .insert([{
      ...uploadData,
      created_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data as ImageUpload
}

export async function getImageUpload(uploadId: string) {
  const { data, error } = await supabase
    .from('image_uploads')
    .select('*')
    .eq('id', uploadId)
    .single()

  if (error) throw error
  return data as ImageUpload
}

export async function getUserUploads(userId: string) {
  const { data, error } = await supabase
    .from('image_uploads')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as ImageUpload[]
}

// ============================================================
// FILE DEDUPLICATION
// ============================================================

export async function getUploadBySha256(sha256: string) {
  const { data, error } = await supabase
    .from('image_uploads')
    .select('*')
    .eq('sha256', sha256)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data as ImageUpload | null
}

export async function recordFileDeduplication(fileHash: string, storagePath: string) {
  const { error } = await supabase
    .from('file_deduplication_index')
    .upsert({
      file_hash: fileHash,
      original_storage_path: storagePath,
      created_at: new Date().toISOString()
    })

  if (error) throw error
}

export async function incrementFileReuse(fileHash: string) {
  const { data, error } = await supabase
    .from('file_deduplication_index')
    .select('reuse_count')
    .eq('file_hash', fileHash)
    .single()

  if (error) throw error

  const newCount = (data?.reuse_count || 1) + 1

  const { error: updateError } = await supabase
    .from('file_deduplication_index')
    .update({ reuse_count: newCount })
    .eq('file_hash', fileHash)

  if (updateError) throw updateError
}

// ============================================================
// UPLOAD QUOTAS
// ============================================================

export async function getUserUploadQuota(userId: string) {
  const { data, error } = await supabase
    .from('user_upload_quotas')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data || null
}

export async function checkUploadQuota(userId: string) {
  const quota = await getUserUploadQuota(userId)
  if (!quota) {
    // Criar primeira quota
    return await createUserUploadQuota(userId)
  }
  return quota
}

export async function createUserUploadQuota(userId: string) {
  const { data, error } = await supabase
    .from('user_upload_quotas')
    .insert([{
      user_id: userId,
      daily_uploads_count: 0,
      daily_limit: 100,
      period_start: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    }])
    .select()
    .single()

  if (error) throw error
  return data
}

export async function incrementUploadCount(userId: string) {
  const quota = await checkUploadQuota(userId)

  // Se mudou de dia, resetar contador
  const today = new Date().toISOString().split('T')[0]
  if (quota.period_start !== today) {
    await supabase
      .from('user_upload_quotas')
      .update({
        daily_uploads_count: 1,
        period_start: today,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
  } else {
    // Incrementar contador
    const newCount = (quota.daily_uploads_count || 0) + 1
    await supabase
      .from('user_upload_quotas')
      .update({
        daily_uploads_count: newCount,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
  }
}

export async function hasUploadQuotaAvailable(userId: string) {
  const quota = await checkUploadQuota(userId)
  return (quota.daily_uploads_count || 0) < (quota.daily_limit || 100)
}

// ============================================================
// FILE OPERATIONS
// ============================================================

export async function deleteUpload(uploadId: string) {
  const upload = await getImageUpload(uploadId)
  if (upload.storage_path) {
    await deleteFile('user-uploads', upload.storage_path)
  }

  const { error } = await supabase
    .from('image_uploads')
    .delete()
    .eq('id', uploadId)

  if (error) throw error
}

export function getUploadUrl(storagePath: string) {
  return getPublicFileUrl('user-uploads', storagePath)
}

// ============================================================
// HELPERS
// ============================================================

async function getImageDimensions(file: File): Promise<Record<string, any> | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        resolve({
          width: img.width,
          height: img.height
        })
      }
      img.onerror = () => resolve(null)
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

export default {
  uploadImage,
  createImageUpload,
  getImageUpload,
  getUserUploads,
  getUploadBySha256,
  recordFileDeduplication,
  incrementFileReuse,
  getUserUploadQuota,
  checkUploadQuota,
  createUserUploadQuota,
  incrementUploadCount,
  hasUploadQuotaAvailable,
  deleteUpload,
  getUploadUrl
}
