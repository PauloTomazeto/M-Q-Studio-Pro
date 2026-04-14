/**
 * KIE Webhook Handler
 *
 * Responsabilidades:
 * - Receber callbacks de KIE.AI
 * - Verificar assinatura HMAC
 * - Atualizar geração no Firestore
 * - Lidar com erros e retries
 */

import crypto from 'crypto';
// import { updateDoc, doc, getDoc } from 'firebase/firestore'; // Migrated to Supabase
import { supabase } from '../supabase';
import { createLogger } from '../utils/logger';
import { getSecrets } from '../config/secretsManager';

const logger = createLogger('Webhook-Handler');

export interface KieWebhookPayload {
  generationId: string;
  status: 'SUCCESS' | 'PROCESSING' | 'FAILED';
  imageUrl?: string;
  error?: string;
  metadata?: {
    progress?: number;
    stage?: string;
    durationSeconds?: number;
  };
}

/**
 * Verifica assinatura HMAC do webhook
 */
function verifyWebhookSignature(
  payload: any,
  signature: string | undefined,
  secret: string
): boolean {
  if (!signature) {
    logger.warn('WEBHOOK: Missing signature header');
    return false;
  }

  // Criar HMAC esperado
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Comparar (constant-time para evitar timing attacks)
  const isValid = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature)
  );

  return isValid;
}

/**
 * Handler principal do webhook
 */
export async function handleKieWebhook(req: any): Promise<{ success: boolean }> {
  const webhookSecret = (await getSecrets()).STRIPE_WEBHOOK_SECRET;
  const signature = req.headers['x-kie-signature'];
  const { generationId, status, imageUrl, error, metadata } = req.body;

  logger.info('WEBHOOK_RECEIVED', {
    generationId,
    status,
    hasSignature: !!signature
  });

  // 1. Verificar assinatura
  const isValid = verifyWebhookSignature(req.body, signature, webhookSecret);

  if (!isValid) {
    logger.error('WEBHOOK_INVALID_SIGNATURE', {
      generationId,
      signature: signature ? signature.substring(0, 10) + '...' : 'missing'
    });
    throw new Error('Invalid webhook signature');
  }

  logger.info('WEBHOOK_SIGNATURE_VALID', { generationId });

  // 2. Validar payload
  if (!generationId) {
    throw new Error('Missing generationId in webhook payload');
  }

  if (!['SUCCESS', 'PROCESSING', 'FAILED'].includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  // 3. Atualizar Supabase
  try {
    if (status === 'SUCCESS') {
      if (!imageUrl) {
        throw new Error('Missing imageUrl in SUCCESS payload');
      }

      const { error } = await supabase
        .from('image_generations')
        .update({
          generation_status: 'completed',
          is_completed: true,
          completed_at: new Date().toISOString(),
          progress_percentage: 100,
          progress_stage: 'finalizing',
          image_url_4k: imageUrl,
          image_url_preview: imageUrl,
          generation_duration_seconds: metadata?.durationSeconds || 0,
          kie_api_status: 'success'
        })
        .eq('id', generationId);

      if (error) throw error;

      logger.info('GENERATION_COMPLETED', {
        generationId,
        durationSeconds: metadata?.durationSeconds
      });

    } else if (status === 'PROCESSING') {
      const { progress, stage } = metadata || {};

      const { error } = await supabase
        .from('image_generations')
        .update({
          progress_percentage: progress || 0,
          progress_stage: stage || 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', generationId);

      if (error) throw error;

      logger.debug('GENERATION_PROGRESS', {
        generationId,
        progress,
        stage
      });

    } else if (status === 'FAILED') {
      const errorMessage = error || 'Unknown error';

      // Obter geração para refund
      const { data: genData, error: fetchError } = await supabase
        .from('image_generations')
        .select('credits_cost, user_id')
        .eq('id', generationId)
        .single();

      if (fetchError) throw fetchError;

      const creditsCost = genData?.credits_cost;
      const userId = genData?.user_id;

      const { error: updateError } = await supabase
        .from('image_generations')
        .update({
          generation_status: 'failed',
          is_completed: false,
          error_message: errorMessage,
          kie_api_status: 'failed'
        })
        .eq('id', generationId);

      if (updateError) throw updateError;

      logger.error('GENERATION_FAILED', {
        generationId,
        error: errorMessage
      });

      // Se houver creditsCost, deverá ser refundado
      // (implementado em creditsService)
      if (creditsCost && userId) {
        logger.info('GENERATION_REQUIRES_REFUND', {
          generationId,
          userId,
          amount: creditsCost
        });
      }
    }

    return { success: true };

  } catch (error: any) {
    logger.error('WEBHOOK_PROCESSING_FAILED', {
      generationId,
      error: error.message,
      errorCode: error.code
    });
    throw error;
  }
}

/**
 * Express Route Handler (para server.ts)
 */
export async function webhookRouteHandler(
  req: any,
  res: any
): Promise<void> {
  try {
    const result = await handleKieWebhook(req);
    res.json(result);
  } catch (error: any) {
    logger.error('WEBHOOK_ROUTE_ERROR', {
      error: error.message,
      path: req.path
    });

    // 400 para erros de validação/signature
    // 500 para erros de processamento
    const statusCode = error.message.includes('signature') ? 400 : 500;
    res.status(statusCode).json({
      error: error.message
    });
  }
}

export default {
  handleKieWebhook,
  webhookRouteHandler,
  verifyWebhookSignature
};
