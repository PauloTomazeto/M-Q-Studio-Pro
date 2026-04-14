/**
 * KIE Service - Image Generation via KIE.AI API
 * Gerencia integração com KIE.AI para geração de imagens
 *
 * Substitui: src/services/kieService.ts
 */

import { supabase, ImageGeneration } from '../supabase'

// ============================================================
// KIE.AI CONFIGURATION
// ============================================================

const KIE_API_URL = 'https://api.kie.ai/v1'
const KIE_API_KEY = process.env.VITE_KIE_API_KEY || process.env.KIE_API_KEY

interface KIEGenerationRequest {
  prompt: string
  model?: string
  width?: number
  height?: number
  steps?: number
  guidance_scale?: number
}

interface KIEGenerationResponse {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  image_url?: string
  error?: string
  created_at: string
  model?: string
}

// ============================================================
// GENERATE IMAGE
// ============================================================

export async function generateImageViaKIE(
  generationId: string,
  prompt: string,
  model: string = 'default',
  options?: {
    width?: number
    height?: number
    steps?: number
    guidance_scale?: number
  }
) {
  try {
    // Update status to processing
    await supabase
      .from('image_generations')
      .update({
        generation_status: 'processing',
        progress_percentage: 10
      })
      .eq('id', generationId)

    // Call KIE.AI API
    const kieRequest: KIEGenerationRequest = {
      prompt,
      model,
      width: options?.width || 512,
      height: options?.height || 512,
      steps: options?.steps || 20,
      guidance_scale: options?.guidance_scale || 7.5
    }

    const response = await fetch(`${KIE_API_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`
      },
      body: JSON.stringify(kieRequest)
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`KIE.AI API error: ${error.message || response.statusText}`)
    }

    const kieResponse: KIEGenerationResponse = await response.json()

    if (kieResponse.status === 'failed') {
      throw new Error(`KIE.AI generation failed: ${kieResponse.error}`)
    }

    // Store KIE request ID for webhook tracking
    await supabase
      .from('image_generations')
      .update({
        kie_api_model: model,
        kie_api_request_id: kieResponse.id,
        progress_percentage: 50
      })
      .eq('id', generationId)

    return kieResponse
  } catch (error) {
    // Mark as failed
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    await supabase
      .from('image_generations')
      .update({
        generation_status: 'failed',
        error_message: errorMessage,
        progress_percentage: 0
      })
      .eq('id', generationId)

    throw error
  }
}

// ============================================================
// CHECK GENERATION STATUS
// ============================================================

export async function checkKIEGenerationStatus(kieRequestId: string): Promise<KIEGenerationResponse> {
  const response = await fetch(`${KIE_API_URL}/generate/${kieRequestId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to check KIE.AI status: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================
// CANCEL GENERATION
// ============================================================

export async function cancelKIEGeneration(kieRequestId: string) {
  const response = await fetch(`${KIE_API_URL}/generate/${kieRequestId}/cancel`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to cancel KIE.AI generation: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================
// GET GENERATION HISTORY
// ============================================================

export async function getKIEGenerationHistory(limit: number = 50) {
  const response = await fetch(`${KIE_API_URL}/generate?limit=${limit}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${KIE_API_KEY}`
    }
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch KIE.AI history: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================
// ESTIMATE COST
// ============================================================

export async function estimateKIEGenerationCost(
  prompt: string,
  model?: string
): Promise<{ credits_required: number; estimated_time_seconds: number }> {
  const response = await fetch(`${KIE_API_URL}/estimate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${KIE_API_KEY}`
    },
    body: JSON.stringify({ prompt, model })
  })

  if (!response.ok) {
    // Default fallback
    return {
      credits_required: 10,
      estimated_time_seconds: 30
    }
  }

  return response.json()
}

// ============================================================
// VALIDATE PROMPT
// ============================================================

export async function validateKIEPrompt(prompt: string): Promise<{
  valid: boolean
  message?: string
  length: number
  warnings?: string[]
}> {
  const maxLength = 1000
  const warnings: string[] = []

  if (!prompt || prompt.trim().length === 0) {
    return {
      valid: false,
      message: 'Prompt cannot be empty',
      length: 0
    }
  }

  if (prompt.length > maxLength) {
    warnings.push(`Prompt exceeds recommended length (${prompt.length}/${maxLength})`)
  }

  // Check for potentially problematic content
  const bannedPatterns = [
    /nsfw/i,
    /explicit/i,
    /sexual/i,
    /violence/i,
    /gore/i
  ]

  for (const pattern of bannedPatterns) {
    if (pattern.test(prompt)) {
      warnings.push(`Prompt may violate content policy`)
      break
    }
  }

  return {
    valid: warnings.length === 0,
    message: warnings.length > 0 ? 'Prompt has warnings' : undefined,
    length: prompt.length,
    warnings: warnings.length > 0 ? warnings : undefined
  }
}

// ============================================================
// WEBHOOK HELPERS
// ============================================================

export async function handleKIEWebhook(
  kieRequestId: string,
  status: 'completed' | 'failed',
  imageUrl?: string,
  errorMessage?: string
) {
  // Find generation by KIE request ID
  const { data: generation, error: queryError } = await supabase
    .from('image_generations')
    .select('*')
    .eq('kie_api_request_id', kieRequestId)
    .single()

  if (queryError || !generation) {
    console.error('Generation not found for KIE request ID:', kieRequestId)
    return
  }

  if (status === 'completed' && imageUrl) {
    // Update as completed
    await supabase
      .from('image_generations')
      .update({
        generation_status: 'completed',
        image_url: imageUrl,
        image_urls: [imageUrl],
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        credits_deducted: true
      })
      .eq('id', generation.id)
  } else if (status === 'failed') {
    // Update as failed
    await supabase
      .from('image_generations')
      .update({
        generation_status: 'failed',
        error_message: errorMessage || 'Generation failed',
        progress_percentage: 0
      })
      .eq('id', generation.id)
  }
}

export default {
  generateImageViaKIE,
  checkKIEGenerationStatus,
  cancelKIEGeneration,
  getKIEGenerationHistory,
  estimateKIEGenerationCost,
  validateKIEPrompt,
  handleKIEWebhook
}
