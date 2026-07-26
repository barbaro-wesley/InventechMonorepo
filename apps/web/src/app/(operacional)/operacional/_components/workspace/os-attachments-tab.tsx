'use client'

import { Paperclip, File as FileIcon, Download } from 'lucide-react'
import { storageService } from '@/services/storage/storage.service'
import type { ServiceOrderDetail } from '@/services/service-orders/service-orders.types'
import { AttachmentCarousel } from './attachment-carousel'

interface OsAttachmentsTabProps {
  os: ServiceOrderDetail
}

/** Aba Anexos — imagens em carrossel + documentos para download. */
export function OsAttachmentsTab({ os }: OsAttachmentsTabProps) {
  const attachments = os.attachments ?? []

  if (attachments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f3f4f7] dark:bg-zinc-800 mb-3">
          <Paperclip className="h-5 w-5 text-[#6c7c93] dark:text-zinc-400" />
        </div>
        <p className="text-sm text-[#6c7c93] dark:text-zinc-400">Nenhum anexo nesta OS</p>
      </div>
    )
  }

  const images = attachments.filter((a) => a.mimeType.startsWith('image/'))
  const docs = attachments.filter((a) => !a.mimeType.startsWith('image/'))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5">
        <Paperclip className="h-3.5 w-3.5 text-[#6c7c93] dark:text-zinc-400" />
        <p className="text-[11px] text-[#6c7c93] dark:text-zinc-400 font-medium uppercase tracking-wide">
          Anexos ({attachments.length})
        </p>
      </div>

      {images.length > 0 && <AttachmentCarousel images={images} />}

      {docs.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {docs.map((doc) => (
            <a
              key={doc.id}
              href={storageService.getDownloadUrl(doc.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 p-2.5 bg-[#f8f9fb] dark:bg-zinc-900/50 border border-[#e0e5eb] dark:border-zinc-800 hover:border-[#c5cdd8] dark:hover:border-zinc-700 rounded-lg group transition-all"
            >
              <FileIcon className="h-4 w-4 text-[#6c7c93] dark:text-zinc-400 shrink-0" />
              <span className="text-xs font-medium text-[#1d2530] dark:text-zinc-100 truncate flex-1">{doc.fileName}</span>
              <Download className="h-3.5 w-3.5 text-[#6c7c93] dark:text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
