/**
 * Webhook Handler - KIE.AI Callbacks
 * Gerencia callbacks do KIE.AI para atualizar status de gerações
 *
 * Substitui: src/services/webhookHandler.ts
 */

import { supabase } from '../supabase'
import { handleKIEWebhook } from './kieService'

// ============================================================
// WEBHOOK SIGNATURE VERIFICATION
// ============================================================

const WEBHOOK_SECRET = process.env.KIE_WEBHOOK_SECRET || 'webhook-secret'

export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const crypto = require('crypto')

  const hash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex')

  return hash === signature
}

// ============================================================
// WEBHOOK PAYLOAD TYPES
// ============================================================

interface KIEWebhookPayload {
  event: 'generation.completed' | 'generation.failed' | 'generation.processing'
  request_id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  image_url?: string
  error?: string
  metadata?: Record<string, any>
  timestamp: string
}

interface WebhookResponse {
  success: boolean
  message?: string
  error?: string
}

// ============================================================
// MAIN WEBHOOK HANDLER
// ============================================================

export async function handleKIEWebhookEvent(
  payload: KIEWebhookPayload,
  signature: string
): Promise<WebhookResponse> {
  try {
    // Verify signature
    const payloadString = JSON.stringify(payload)
    if (!verifyWebhookSignature(payloadString, signature)) {
      return {
        success: false,
        error: 'Invalid webhook signature'
      }
    }

    // Route to appropriate handler
    switch (payload.event) {
      case 'generation.completed':
        return await handleGenerationCompleted(payload)
      case 'generation.failed':
        return await handleGenerationFailed(payload)
      case 'generation.processing':
        return await handleGenerationProcessing(payload)
      default:
        return {
          success: false,
          error: `Unknown event type: ${payload.event}`
        }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Webhook handler error:', errorMessage)
    return {
      success: false,
      error: errorMessage
    }
  }
}

// ============================================================
// EVENT HANDLERS
// ============================================================

async function handleGenerationCompleted(
  payload: KIEWebhookPayload
): Promise<WebhookResponse> {
  if (!payload.image_url) {
    return {
      success: false,
      error: 'Missing image_url in completed event'
    }
  }

  try {
    await handleKIEWebhook(
      payload.request_id,
      'completed',
      payload.image_url
    )

    // Log webhook event
    await logWebhookEvent(payload)

    return {
      success: true,
      message: `Generation ${payload.request_id} completed`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Failed to handle completion: ${errorMessage}`
    }
  }
}

async function handleGenerationFailed(
  payload: KIEWebhookPayload
): Promise<WebhookResponse> {
  try {
    await handleKIEWebhook(
      payload.request_id,
      'failed',
      undefined,
      payload.error || 'Generation failed'
    )

    // Log webhook event
    await logWebhookEvent(payload)

    return {
      success: true,
      message: `Generation ${payload.request_id} marked as failed`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Failed to handle failure: ${errorMessage}`
    }
  }
}

async function handleGenerationProcessing(
  payload: KIEWebhookPayload
): Promise<WebhookResponse> {
  try {
    // Find generation and update progress
    const { error: updateError } = await supabase
      .from('image_generations')
      .update({
        generation_status: 'processing',
        progress_percentage: 50,
        kie_api_request_id: payload.request_id
      })
      .eq('kie_api_request_id', payload.request_id)

    if (updateError) {
      throw updateError
    }

    // Log webhook event
    await logWebhookEvent(payload)

    return {
      success: true,
      message: `Generation ${payload.request_id} is processing`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Failed to handle processing: ${errorMessage}`
    }
  }
}

// ============================================================
// WEBHOOK LOGGING
// ============================================================

export async function logWebhookEvent(payload: KIEWebhookPayload) {
  try {
    await supabase
      .from('webhook_logs')
      .insert([{
        event_type: payload.event,
        kie_request_id: payload.request_id,
        status: payload.status,
        payload_data: payload,
        processed_at: new Date().toISOString()
      }])
  } catch (error) {
    console.error('Failed to log webhook event:', error)
    // Don't throw - webhook handling should not fail due to logging issues
  }
}

// ============================================================
// WEBHOOK HEALTH CHECK
// ============================================================

export async function healthCheck(): Promise<WebhookResponse> {
  try {
    // Verify database connection
    const { error } = await supabase
      .from('image_generations')
      .select('id')
      .limit(1)

    if (error) {
      throw error
    }

    return {
      success: true,
      message: 'Webhook handler is healthy'
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Health check failed: ${errorMessage}`
    }
  }
}

// ============================================================
// RETRY MECHANISM FOR FAILED WEBHOOKS
// ============================================================

export async function retryFailedWebhook(
  webhookId: string,
  maxRetries: number = 3
): Promise<WebhookResponse> {
  try {
    // Fetch webhook log
    const { data: webhookLog, error: fetchError } = await supabase
      .from('webhook_logs')
      .select('*')
      .eq('id', webhookId)
      .single()

    if (fetchError || !webhookLog) {
      return {
        success: false,
        error: 'Webhook log not found'
      }
    }

    // Retry up to maxRetries times
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await handleKIEWebhookEvent(
          webhookLog.payload_data,
          '' // Note: For internal retries, we skip signature verification
        )

        if (result.success) {
          // Update webhook log
          await supabase
            .from('webhook_logs')
            .update({
              retry_count: attempt,
              last_retry_at: new Date().toISOString(),
              status: 'success'
            })
            .eq('id', webhookId)

          return result
        }
      } catch (error) {
        if (attempt === maxRetries) {
          throw error
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
      }
    }

    return {
      success: false,
      error: `Failed to retry webhook after ${maxRetries} attempts`
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      error: `Retry failed: ${errorMessage}`
    }
  }
}

// ============================================================
// WEBHOOK STATISTICS
// ============================================================

export async function getWebhookStats(days: number = 30): Promise<{
  total_events: number
  completed_events: number
  failed_events: number
  processing_events: number
  success_rate: number
}> {
  const dateFrom = new Date()
  dateFrom.setDate(dateFrom.getDate() - days)

  const { data: logs, error } = await supabase
    .from('webhook_logs')
    .select('status')
    .gte('processed_at', dateFrom.toISOString())

  if (error) {
    throw error
  }

  const stats = {
    total_events: logs?.length || 0,
    completed_events: 0,
    failed_events: 0,
    processing_events: 0,
    success_rate: 0
  }

  logs?.forEach((log: any) => {
    if (log.status === 'completed') {
      stats.completed_events++
    } else if (log.status === 'failed') {
      stats.failed_events++
    } else if (log.status === 'processing') {
      stats.processing_events++
    }
  })

  stats.success_rate = stats.total_events
    ? (stats.completed_events / stats.total_events) * 100
    : 0

  return stats
}

export default {
  handleKIEWebhookEvent,
  verifyWebhookSignature,
  logWebhookEvent,
  healthCheck,
  retryFailedWebhook,
  getWebhookStats
}
