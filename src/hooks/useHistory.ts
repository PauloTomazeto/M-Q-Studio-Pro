/**
 * useHistory Hook - Real-time Generation History
 * Subscriptions em tempo real ao histórico de gerações
 *
 * Substitui: src/hooks/useHistory.ts
 */

import { useEffect, useState, useCallback } from 'react'
import { supabase, getCurrentUser, ImageGeneration } from '../supabase'
import * as imageGenerationService from '../services/imageGenerationService'

interface UseHistoryOptions {
  limit?: number
  projectId?: string
  status?: 'pending' | 'processing' | 'completed' | 'failed'
  autoRefresh?: boolean
  refreshInterval?: number
}

interface UseHistoryReturns {
  generations: ImageGeneration[]
  history: ImageGeneration[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  addGeneration: (generation: ImageGeneration) => void
  updateGeneration: (id: string, updates: Partial<ImageGeneration>) => void
  deleteGeneration: (id: string) => void
  clearHistory: () => Promise<void>
}

export function useHistory(options: UseHistoryOptions = {}): UseHistoryReturns {
  const {
    limit = 50,
    projectId,
    status,
    autoRefresh = true,
    refreshInterval = 5000
  } = options

  const [generations, setGenerations] = useState<ImageGeneration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true)
      const user = await getCurrentUser()

      if (!user) {
        setGenerations([])
        return
      }

      let data: ImageGeneration[]

      if (projectId) {
        data = await imageGenerationService.getProjectGenerations(projectId)
      } else if (status) {
        data = await imageGenerationService.getGenerationsByStatus(user.id, status)
      } else {
        data = await imageGenerationService.getUserGenerations(user.id, limit)
      }

      setGenerations(data)
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch history')
      setError(error)
      setGenerations([])
    } finally {
      setLoading(false)
    }
  }, [limit, projectId, status])

  useEffect(() => {
    let subscription: any;

    const setupSubscription = async () => {
      const user = await getCurrentUser()
      if (!user) return

      const channel = supabase
        .channel('user-generations')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'image_generations',
            filter: projectId
              ? `project_id=eq.${projectId}`
              : `user_id=eq.${user.id}`
          },
          () => {
            fetchHistory()
          }
        )
        .subscribe()
      
      subscription = channel;
    };

    setupSubscription();

    // Set up auto-refresh if enabled
    let refreshTimer: NodeJS.Timeout | undefined

    if (autoRefresh) {
      refreshTimer = setInterval(() => {
        fetchHistory()
      }, refreshInterval)
    }

    return () => {
      subscription.unsubscribe()
      if (refreshTimer) {
        clearInterval(refreshTimer)
      }
    }
  }, [fetchHistory, projectId, autoRefresh, refreshInterval])

  const handleRealtimeUpdate = (payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload

    setGenerations((prevGenerations) => {
      switch (eventType) {
        case 'INSERT':
          return [newRecord, ...prevGenerations].slice(0, limit)

        case 'UPDATE':
          return prevGenerations.map((g) =>
            g.id === newRecord.id ? newRecord : g
          )

        case 'DELETE':
          return prevGenerations.filter((g) => g.id !== oldRecord.id)

        default:
          return prevGenerations
      }
    })
  }

  const addGeneration = useCallback((generation: ImageGeneration) => {
    setGenerations((prev) => [generation, ...prev].slice(0, limit))
  }, [limit])

  const updateGeneration = useCallback((id: string, updates: Partial<ImageGeneration>) => {
    setGenerations((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, ...updates } : g
      )
    )
  }, [])

  const deleteGeneration = useCallback((id: string) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id))
  }, [])

  const clearHistory = useCallback(async () => {
    try {
      const user = await getCurrentUser()
      if (!user) return

      // Delete all generations for user
      for (const generation of generations) {
        await imageGenerationService.deleteGeneration(generation.id)
      }

      setGenerations([])
      setError(null)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to clear history')
      setError(error)
    }
  }, [generations])

  return {
    generations,
    history: generations, // Adicionado alias para compatibilidade
    loading,
    error,
    refetch: fetchHistory,
    addGeneration: (g) => setGenerations(prev => [g, ...prev]),
    updateGeneration: (id, updates) => setGenerations(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g)),
    deleteGeneration: (id) => setGenerations(prev => prev.filter(g => g.id !== id)),
    clearHistory: async () => setGenerations([])
  } as any
}
