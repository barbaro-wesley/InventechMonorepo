'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Lock, Globe, Loader2, Paperclip, X, File as FileIcon, Download, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ServiceOrderComment } from '@/services/service-orders/service-orders.types'
import type { Attachment } from '@/services/storage/storage.service'
import { useAddComment } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { storageService } from '@/services/storage/storage.service'
import { timeAgo } from '../os-utils'
import Image from 'next/image'

interface OsCommentsTabProps {
  clientId: string | null
  osId: string
  comments: ServiceOrderComment[]
}

function CommentAttachment({ attachment }: { attachment: Attachment }) {
  const [url, setUrl] = useState<string | null>(null)
  const isImage = attachment.mimeType.startsWith('image/')

  useEffect(() => {
    if (isImage) {
      storageService.getUrl(attachment.id).then(setUrl)
    }
  }, [attachment.id, isImage])

  if (isImage && url) {
    return (
      <div className="group relative">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative h-20 w-20 rounded-lg overflow-hidden border border-black/5 hover:border-black/10 transition-all shadow-sm"
        >
          <img
            src={url}
            alt={attachment.fileName}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <Download className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
          </div>
        </a>
        <span className="mt-1 text-[9px] text-[#6c7c93] truncate block max-w-[80px]">
          {attachment.fileName}
        </span>
      </div>
    )
  }

  return (
    <a
      href={storageService.getDownloadUrl(attachment.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-2 bg-white/50 border border-black/5 hover:border-black/10 rounded-lg group transition-all"
    >
      <FileIcon className="h-4 w-4 text-[#6c7c93]" />
      <span className="text-[11px] font-medium truncate max-w-[120px]">
        {attachment.fileName}
      </span>
      <Download className="h-3 w-3 text-[#6c7c93] opacity-0 group-hover:opacity-100 transition-opacity" />
    </a>
  )
}

function CommentBubble({ comment }: { comment: ServiceOrderComment }) {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500']
  let hash = 0
  for (let i = 0; i < comment.author.name.length; i++)
    hash = comment.author.name.charCodeAt(i) + ((hash << 5) - hash)
  const color = colors[Math.abs(hash) % colors.length]
  const initials = comment.author.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

  const isImage = (mime: string) => mime.startsWith('image/')

  return (
    <div className="flex gap-3">
      <div className={`h-7 w-7 rounded-full ${color} flex items-center justify-center shrink-0 mt-0.5`}>
        <span className="text-white text-[10px] font-semibold">{initials}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-[#1d2530]">{comment.author.name}</span>
          <span className="text-[10px] text-[#6c7c93]">{timeAgo(comment.createdAt)}</span>
          {comment.isInternal && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5">
              <Lock className="h-2.5 w-2.5" />
              Interno
            </span>
          )}
        </div>
        <div
          className={`text-sm text-[#1d2530] rounded-xl rounded-tl-none p-3 leading-relaxed ${
            comment.isInternal
              ? 'bg-amber-50 border border-amber-200'
              : 'bg-[#f3f4f7] border border-[#e0e5eb]'
          }`}
        >
          {comment.content}
          
          {/* Anexos do comentário */}
          {comment.attachments && comment.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {comment.attachments.map((att) => (
                <CommentAttachment key={att.id} attachment={att} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function OsCommentsTab({ clientId, osId, comments }: OsCommentsTabProps) {
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const addComment = useAddComment(clientId, osId)
  const user = useCurrentUser()

  const canSetInternal =
    user?.role &&
    ['COMPANY_ADMIN', 'COMPANY_MANAGER', 'TECHNICIAN'].includes(user.role)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && files.length === 0) return
    
    addComment.mutate(
      { content: content.trim() || 'Anexo enviado', isInternal, files },
      { 
        onSuccess: () => {
          setContent('')
          setFiles([])
          setIsInternal(false)
        } 
      },
    )
  }

  return (
    <div className="flex flex-col h-full space-y-4 py-1">
      {/* Lista de comentários */}
      <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        {comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#6c7c93]">
            <div className="h-8 w-8 rounded-full bg-[#f3f4f7] flex items-center justify-center mb-2">
              <Send className="h-3.5 w-3.5 opacity-50" />
            </div>
            <p className="text-sm">Nenhum comentário ainda</p>
          </div>
        ) : (
          comments.map((comment) => (
            <CommentBubble key={comment.id} comment={comment} />
          ))
        )}
      </div>

      {/* Caixa de novo comentário */}
      <div className="border-t border-[#e0e5eb] pt-4">
        {/* Preview de arquivos selecionados */}
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {files.map((file, i) => (
              <div 
                key={i} 
                className="flex items-center gap-1.5 bg-[#f3f4f7] border border-[#e0e5eb] rounded-lg px-2 py-1 text-[10px] text-[#1d2530]"
              >
                <FileIcon className="h-3 w-3 text-[#6c7c93]" />
                <span className="truncate max-w-[100px]">{file.name}</span>
                <button 
                  type="button" 
                  onClick={() => removeFile(i)}
                  className="hover:text-red-500 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2">
          <Textarea
            placeholder="Escreva um comentário..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="text-sm resize-none bg-[#f3f4f7] border-transparent focus:border-[#0d4da5] focus:bg-white transition-all"
          />
          <input 
            type="file" 
            multiple 
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canSetInternal && (
                <button
                  type="button"
                  onClick={() => setIsInternal(!isInternal)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors border ${
                    isInternal
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'text-[#6c7c93] hover:bg-[#f3f4f7] border-transparent'
                  }`}
                >
                  {isInternal ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                  {isInternal ? 'Nota interna' : 'Visível ao cliente'}
                </button>
              )}
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-[#6c7c93] hover:bg-[#f3f4f7] transition-colors"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Anexar
              </button>
            </div>

            <Button
              type="submit"
              size="sm"
              disabled={(!content.trim() && files.length === 0) || addComment.isPending}
              className="h-8 gap-1.5 bg-[#0d4da5] hover:bg-[#0a3776] text-white text-xs px-4"
            >
              {addComment.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Enviar
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
