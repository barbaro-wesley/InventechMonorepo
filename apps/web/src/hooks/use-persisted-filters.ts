'use client'

import { useState, useEffect, useCallback } from 'react'
import type {
  ServiceOrderStatus,
  ServiceOrderPriority,
  SlaStatus,
  MaintenanceType,
} from '@/services/service-orders/service-orders.types'

export type ViewMode = 'board' | 'list'

export interface OperacionalFilters {
  search: string
  status: ServiceOrderStatus | ''
  priority: ServiceOrderPriority | ''
  slaStatus: SlaStatus | ''
  maintenanceType: MaintenanceType | ''
  clientId: string
  groupId: string
  patrimonyNumber: string
  equipmentName: string
  dateFrom: string
  dateTo: string
  myOrders: boolean
  showClosed: boolean
  view: ViewMode
}

const DEFAULTS: OperacionalFilters = {
  search: '',
  status: '',
  priority: '',
  slaStatus: '',
  maintenanceType: '',
  clientId: '',
  groupId: '',
  patrimonyNumber: '',
  equipmentName: '',
  dateFrom: '',
  dateTo: '',
  myOrders: false,
  showClosed: false,
  view: 'board',
}

function storageKey(userId: string) {
  return `operacional-filters:${userId}`
}

function load(userId: string): OperacionalFilters {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return DEFAULTS
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return DEFAULTS
  }
}

function save(userId: string, filters: OperacionalFilters) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(filters))
  } catch {
    // ignore (e.g., storage quota exceeded in private mode)
  }
}

export function usePersistedFilters(userId: string | undefined) {
  const [filters, setFilters] = useState<OperacionalFilters>(DEFAULTS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!userId) return
    setFilters(load(userId))
    setHydrated(true)
  }, [userId])

  const set = useCallback(
    <K extends keyof OperacionalFilters>(key: K, value: OperacionalFilters[K]) => {
      setFilters((prev) => {
        const next = { ...prev, [key]: value }
        if (userId) save(userId, next)
        return next
      })
    },
    [userId],
  )

  // Aplica vários filtros de uma vez (usado pelo modal de filtros avançados),
  // evitando múltiplos renders/gravações ao setar campo a campo.
  const setMany = useCallback(
    (partial: Partial<OperacionalFilters>) => {
      setFilters((prev) => {
        const next = { ...prev, ...partial }
        if (userId) save(userId, next)
        return next
      })
    },
    [userId],
  )

  return { filters, set, setMany, hydrated }
}
