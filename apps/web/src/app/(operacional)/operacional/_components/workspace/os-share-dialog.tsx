'use client'

import { useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { Check, Copy, Download, Link2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface OsShareDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  osId: string
  osNumber: number
}

export function OsShareDialog({ open, onOpenChange, osId, osNumber }: OsShareDialogProps) {
  const [copied, setCopied] = useState(false)
  const qrWrapRef = useRef<HTMLDivElement>(null)

  // Computado no render (client component); no SSR fica vazio, mas o conteúdo
  // do dialog só monta quando aberto, então não há mismatch de hidratação.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = origin ? `${origin}/operacional/os/${osId}` : ''

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard indisponível — seleção manual continua possível
    }
  }

  const handleDownloadPng = () => {
    const svg = qrWrapRef.current?.querySelector('svg')
    if (!svg) return
    const serialized = new XMLSerializer().serializeToString(svg)
    const svgBlob = new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' })
    const svgUrl = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      URL.revokeObjectURL(svgUrl)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `os-${osNumber}-qrcode.png`
      a.click()
    }
    img.src = svgUrl
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Compartilhar OS #{osNumber}
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR code ou copie o link. Requer login para acessar.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          {/* QR */}
          <div ref={qrWrapRef} className="rounded-xl bg-white p-4 border border-[#e0e5eb]">
            {url && <QRCode value={url} size={180} level="M" />}
          </div>

          {/* Link + copiar */}
          <div className="flex w-full items-center gap-2">
            <input
              readOnly
              value={url}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 h-9 rounded-lg border border-[#e0e5eb] dark:border-zinc-800 bg-[#f8f9fb] dark:bg-zinc-900 px-3 text-xs text-[#4a5568] dark:text-zinc-300 truncate"
            />
            <Button variant="outline" size="sm" className="h-9 shrink-0 gap-1.5" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleDownloadPng}>
            <Download className="h-3.5 w-3.5" />
            Baixar QR (PNG)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
