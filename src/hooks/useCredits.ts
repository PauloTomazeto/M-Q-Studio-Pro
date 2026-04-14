/**
 * useCredits Hook - Real-time Credit Balance
 * Subscriptions em tempo real ao saldo de créditos
 *
 * Substitui: src/hooks/useCredits.ts
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase, getCurrentUser } from '../supabase'
import * as creditsService from '../services/creditsService'

export interface UserCredits {
  user_id: string
  credits_available: number
  credits_used_this_month: number
  monthly_limit: number
  is_admin: boolean
  last_updated: string
}

interface UseCreditReturns {
  credits: UserCredits | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  debit: (amount: number, reason: string) => Promise<boolean>
  credit: (amount: number, reason: string) => Promise<boolean>
  hasEnough: (amount: number) => boolean
}

export function useCredits(): UseCreditReturns {
  const [credits, setCredits] = useState<UserCredits | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchCredits = useCallback(async () => {
    try {
      setLoading(true)
      const user = await getCurrentUser()

      if (!user) {
        setCredits(null)
        return
      }

      const userCredits = await creditsService.getUserCredits(user.id)

      setCredits({
        user_id: user.id,
        credits_available: userCredits.credits || 0,
        credits_used_this_month: userCredits.monthlySpent || 0,
        monthly_limit: userCredits.monthlyLimit || 100,
        is_admin: false, // Pode ser inferido de outro lugar se necessário
        last_updated: new Date().toISOString()
      })
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch credits')
      setError(error)
      setCredits(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Fetch initial credits
    fetchCredits()

    // Subscribe to real-time updates
    const user = getCurrentUser()
    if (!user) return

    const subscription = supabase
      .channel('user-credits')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`
        },
        () => {
          fetchCredits()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchCredits])

  const debit = useCallback(
    async (amount: number, reason: string): Promise<boolean> => {
      try {
        const user = await getCurrentUser()
        if (!user) return false

        // Check if user has enough credits
        if (!creditsService.hasEnoughCredits(user.id, amount)) {
          throw new Error('Insufficient credits')
        }

        await creditsService.debitCreditsRPC(user.id, amount, reason)
        await fetchCredits()
        return true
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to debit credits')
        setError(error)
        return false
      }
    },
    [fetchCredits]
  )

  const credit = useCallback(
    async (amount: number, reason: string): Promise<boolean> => {
      try {
        const user = await getCurrentUser()
        if (!user) return false

        await creditsService.creditCreditsRPC(user.id, amount, reason)
        await fetchCredits()
        return true
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to credit credits')
        setError(error)
        return false
      }
    },
    [fetchCredits]
  )

  const hasEnough = useCallback(
    (amount: number): boolean => {
      if (!credits) return false
      return credits.credits_available >= amount
    },
    [credits]
  )

  return {
    credits,
    loading,
    error,
    refetch: fetchCredits,
    debit,
    credit,
    hasEnough
  }
}
