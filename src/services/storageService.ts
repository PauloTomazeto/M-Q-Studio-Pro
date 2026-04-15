/**
 * Storage Service - Supabase Version
 * Gerencia uploads de arquivos e deduplica��o
 *
 * Substitui: src/services/storageService.ts
 */

import { supabase, uploadFile, deleteFile, getPublicFileUrl, ImageUpload } from '../supabase'
import crypto from 'crypto'

// ============================================================
// TYPES & INTERFACES
// ============================================================

export interface ValidationStepResult {
  step: string
  valid: boolean
  warning?: boolean
  error?: string
  details?: any
}

export interface ValidationChainResult {
  allValid: boolean
  steps: ValidationStepResult[]
}

// ============================================================
// VALIDATION & PROCESSING
// ============================================================

/**
 * Valida um arquivo de imagem seguindo uma cadeia de regras
 * Rules:
 * - Format: JPG, PNG, WebP, HEIC, TIFF
 * - Size: 300KB - 20MB
 * - Dimensions: 800x600px - 8000x8000px
 */
export async function validateFileChain(file: File, plan: string = 'basic'): Promise<ValidationChainResult> {
  const steps: ValidationStepResult[] = []
  
  // 1. Check Format
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/tiff']
  const isFormatValid = allowedTypes.includes(file.type) || 
                       file.name.toLowerCase().endsWith('.heic') || 
                       file.name.toLowerCase().endsWith('.tiff')
  
  steps.push({
    step: 'format',
    valid: isFormatValid,
    error: isFormatValid ? undefined : 'UNSUPPORTED_FORMAT',
    details: { type: file.type, name: file.name }
  })

  // 2. Check Size
  const minSize = 300 * 1024 // 300KB
  const maxSize = 20 * 1024 * 1024 // 20MB
  
  let sizeError: string | undefined
  if (file.size < minSize) sizeError = 'FILE_TOO_SMALL'
  if (file.size > maxSize) sizeError = 'FILE_TOO_LARGE'
  
  steps.push({
    step: 'size',
    valid: !sizeError,
    error: sizeError,
    details: { size: file.size, minSize, maxSize }
  })

  // 3. Check Dimensions (if format and size are ok)
  if (isFormatValid && !sizeError) {
    try {
      const dimensions = await getImageDimensions(file)
      if (dimensions) {
        const minDim = { width: 800, height: 600 }
        const maxDim = { width: 8000, height: 8000 }
        
        let dimError: string | undefined
        if (dimensions.width < minDim.width || dimensions.height < minDim.height) {
          dimError = 'IMAGE_TOO_SMALL_PIXELS'
        } else if (dimensions.width > maxDim.width || dimensions.height > maxDim.height) {
          dimError = 'IMAGE_TOO_LARGE_PIXELS'
        }
        
        steps.push({
          step: 'dimensions',
          valid: !dimError,
          error: dimError,
          details: dimensions
        })
      } else {
        steps.push({
          step: 'dimensions',
          valid: false,
          error: 'IMAGE_DECODE_FAILED'
        })
      }
    } catch (e) {
      steps.push({
        step: 'dimensions',
        valid: false,
        error: 'IMAGE_DECODE_TIMEOUT'
      })
    }
  }

  return {
    allValid: steps.every(s => s.valid || s.warning),
    steps
  }
}

/**
 * Stub para compressão de imagem (pode ser expandido futuramente)
 */
export async function compressImage(file: File, quality: number = 0.8, maxDimension?: number): Promise<File | Blob> {
  // Por enquanto apenas retorna o arquivo original
  return file
}

// ============================================================
// FILE UPLOAD
// ============================================================

export async function uploadImage(file: File, validationResult: ValidationChainResult, base64: string) {
  // 1. Obter usuário atual
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('User not authenticated')
  const userId = user.id

  // 2. Gerar SHA256 do arquivo
  const arrayBuffer = await file.arrayBuffer()
  const hashBuffer = crypto.createHash('sha256').update(new Uint8Array(arrayBuffer)).digest()
  const sha256 = hashBuffer.toString('hex')

  // 3. Checar se arquivo já existe (deduplicação)
  const existingUpload = await getUploadBySha256(sha256)
  
  let uploadRecord: ImageUpload
  let storagePath: string

  if (existingUpload) {
    // Incrementar reuse count
    await incrementFileReuse(sha256)
    uploadRecord = existingUpload
    storagePath = existingUpload.storage_path!
  } else {
    // Fazer upload para Supabase Storage
    const filename = `${userId}/${Date.now()}-${file.name}`
    const data = await uploadFile('user-uploads', filename, file)
    storagePath = data.path

    // Registrar no banco de dados
    const dimensions = validationResult.steps.find(s => s.step === 'dimensions')?.details || await getImageDimensions(file)
    uploadRecord = await createImageUpload({
      user_id: userId,
      sha256,
      storage_path: storagePath,
      mime_type: file.type,
      dimensions
    })

    // Registrar na deduplicação
    await recordFileDeduplication(sha256, storagePath)
  }

  // 4. Retornar dados esperados pelo componente
  return {
    sessionId: uploadRecord.id,
    metadata: {
      uploadId: uploadRecord.id,
      storagePath: uploadRecord.storage_path,
      dimensions: uploadRecord.dimensions,
      mimeType: uploadRecord.mime_type,
      validation: validationResult
    }
  }
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
  getUploadUrl,
  validateFileChain,
  compressImage
}
