'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useIsAuthenticated } from '@/store/auth.store'
import { scanKeys } from './use-scans'
import type { ScanMetadata } from '@/services/printers/scans.service'

interface ScanEventPayload {
  event: string
  scan: {
    id: string
    fileName: string
    status: string
    metadata: ScanMetadata | null
  }
}

export function useScansSocket() {
  const isAuthenticated = useIsAuthenticated()
  const queryClient = useQueryClient()
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:3000'

    const socket = io(`${wsUrl}/notifications`, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    socket.on('scan:event', (payload: ScanEventPayload) => {
      // Invalida a lista para buscar o scan atualizado
      queryClient.invalidateQueries({ queryKey: scanKeys.all() })

      if (payload.event === 'scan:processed') {
        const { scan } = payload
        const paciente = scan.metadata?.paciente
        const prontuario = scan.metadata?.prontuario

        const label = paciente
          ? `Paciente: ${paciente}${prontuario ? ` · Prontuário: ${prontuario}` : ''}`
          : scan.fileName

        if (scan.metadata?.ocrStatus === 'SUCCESS') {
          toast.success('Digitalização processada', {
            description: label,
            duration: 6000,
          })
        } else {
          toast.warning('Digitalização processada (sem dados OCR)', {
            description: scan.fileName,
            duration: 5000,
          })
        }
      }
    })

    socket.on('connect_error', (err) => {
      console.warn('[WS scans] Erro de conexão:', err.message)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, queryClient])
}
