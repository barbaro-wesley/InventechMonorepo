'use client'

import { useState, useEffect, useCallback } from 'react'
import type { EquipmentStatus } from '@/services/equipment/equipment.service'

export type EquipmentStatusFilter = EquipmentStatus | ''

const DEFAULT_STATUS: EquipmentStatusFilter = 'ACTIVE'

function storageKey(userId: string) {
  return `equipamentos-status-filter:${userId}`
}

function load(userId: string): EquipmentStatusFilter {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (raw === null) return DEFAULT_STATUS
    return JSON.parse(raw) as EquipmentStatusFilter
  } catch {
    return DEFAULT_STATUS
  }
}

function save(userId: string, status: EquipmentStatusFilter) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(status))
  } catch {
    // ignore (e.g., storage quota exceeded in private mode)
  }
}

export function usePersistedEquipmentStatus(userId: string | undefined) {
  const [status, setStatusState] = useState<EquipmentStatusFilter>(DEFAULT_STATUS)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (!userId) return
    setStatusState(load(userId))
    setHydrated(true)
  }, [userId])

  const setStatus = useCallback(
    (value: EquipmentStatusFilter) => {
      setStatusState(value)
      if (userId) save(userId, value)
    },
    [userId],
  )

  return { status, setStatus, hydrated }
}
