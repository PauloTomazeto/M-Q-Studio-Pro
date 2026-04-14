/**
 * Credits Service - Supabase Version
 * Gerencia créditos com transações RPC
 *
 * Substitui: src/services/creditsService.ts
 */

import { supabase, callRPC, CreditAuditLog } from '../supabase'

// ============================================================
// RPC FUNCTIONS (servidor PostgreSQL)
// ============================================================

/**
 * Debit credits (via RPC - transação atômica no PostgreSQL)
 *
 * RPC Function no banco:
 * CREATE OR REPLACE FUNCTION debit_credits(
 *   p_user_id UUID,
 *   p_amount NUMERIC,
 *   p_reason TEXT,
 *   p_reference_id UUID
 * )
 */
export async function debitCreditsRPC(
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
) {
  const result = await callRPC('debit_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_id: referenceId
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to debit credits')
  }

  return result
}

/**
 * Credit credits (refund ou bonus)
 */
export async function creditCreditsRPC(
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
) {
  const result = await callRPC('credit_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_reason: reason,
    p_reference_id: referenceId
  })

  if (!result.success) {
    throw new Error(result.error || 'Failed to credit credits')
  }

  return result
}

// ============================================================
// CREDIT AUDIT LOGS
// ============================================================

export async function getCreditAuditLogs(userId: string, limit: number = 100) {
  const { data, error } = await supabase
    .from('credit_audit_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data as CreditAuditLog[]
}

export async function createCreditAuditLog(log: {
  user_id: string
  amount: number
  type: 'debit' | 'credit' | 'refund'
  reason?: string
  reference_id?: string
}) {
  const { data, error } = await supabase
    .from('credit_audit_logs')
    .insert([log])
    .select()
    .single()

  if (error) throw error
  return data as CreditAuditLog
}

export async function getAuditLogByReference(referenceId: string) {
  const { data, error } = await supabase
    .from('credit_audit_logs')
    .select('*')
    .eq('reference_id', referenceId)
    .single()

  if (error) throw error
  return data as CreditAuditLog
}

// ============================================================
// CREDIT TRANSACTIONS
// ============================================================

/**
 * Debitar créditos para geração de imagem
 * Chama RPC para garantir consistência
 */
export async function debitCreditsForGeneration(
  userId: string,
  creditsCost: number,
  generationId: string
) {
  try {
    await debitCreditsRPC(
      userId,
      creditsCost,
      'image_generation',
      generationId
    )
    return true
  } catch (error) {
    console.error('Failed to debit credits:', error)
    throw error
  }
}

/**
 * Reembolsar créditos (geração falhou)
 */
export async function refundCredits(
  userId: string,
  amount: number,
  generationId: string
) {
  try {
    await creditCreditsRPC(
      userId,
      amount,
      'generation_failure_refund',
      generationId
    )
    return true
  } catch (error) {
    console.error('Failed to refund credits:', error)
    throw error
  }
}

/**
 * Verificar se usuário tem créditos suficientes
 */
export async function hasEnoughCredits(userId: string, requiredAmount: number) {
  const { data, error } = await supabase
    .from('users')
    .select('credits')
    .eq('id', userId)
    .single()

  if (error) throw error
  return (data?.credits || 0) >= requiredAmount
}

/**
 * Obter saldo de créditos do usuário
 */
export async function getUserCredits(userId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('credits, monthly_spent, monthly_limit')
    .eq('id', userId)
    .single()

  if (error) throw error
  return {
    credits: data?.credits || 0,
    monthlySpent: data?.monthly_spent || 0,
    monthlyLimit: data?.monthly_limit || 0
  }
}

/**
 * Adicionar créditos de bônus
 */
export async function addCreditsBonus(
  userId: string,
  amount: number,
  reason: string
) {
  try {
    await creditCreditsRPC(userId, amount, reason)
    return true
  } catch (error) {
    console.error('Failed to add bonus credits:', error)
    throw error
  }
}

export default {
  debitCreditsRPC,
  creditCreditsRPC,
  getCreditAuditLogs,
  createCreditAuditLog,
  getAuditLogByReference,
  debitCreditsForGeneration,
  refundCredits,
  hasEnoughCredits,
  getUserCredits,
  addCreditsBonus
}
