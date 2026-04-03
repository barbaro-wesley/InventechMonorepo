'use client'

import { useState } from 'react'
import { Send, Lock, Globe, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { ServiceOrderComment } from '@/services/service-orders/service-orders.types'
import { useAddComment } from '@/hooks/service-orders/use-service-orders'
import { useCurrentUser } from '@/store/auth.store'
import { timeAgo } from '../os-utils'

interface OsCommentsTabProps {
  clientId: string
  osId: string
  comments: ServiceOrderComment[]
}

function CommentBubble({ comment }: { comment: ServiceOrderComment }) {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500']
  let hash = 0
  for (let i = 0; i < comment.author.name.length; i++)
    hash = comment.author.name.charCodeAt(i) + ((hash << 5) - hash)
  const color = colors[Math.abs(hash) % colors.length]
  const initials = comment.author.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()

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
        </div>
      </div>
    </div>
  )
}

export function OsCommentsTab({ clientId, osId, comments }: OsCommentsTabProps) {
  const [content, setContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const addComment = useAddComment(clientId, osId)
  const user = useCurrentUser()

  const canSetInternal =
    user?.role &&
    ['COMPANY_ADMIN', 'COMPANY_MANAGER', 'TECHNICIAN'].includes(user.role)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    addComment.mutate(
      { content: content.trim(), isInternal },
      { onSuccess: () => setContent('') },
    )
  }

  return (
    <div className="flex flex-col h-full space-y-4 py-1">
      {/* Lista de comentários */}
      <div className="flex-1 space-y-4 overflow-y-auto">
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
      <form onSubmit={handleSubmit} className="space-y-2 border-t border-[#e0e5eb] pt-4">
        <Textarea
          placeholder="Escreva um comentário..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={3}
          className="text-sm resize-none bg-[#f3f4f7] border-transparent focus:border-[#0d4da5] focus:bg-white"
        />
        <div className="flex items-center justify-between">
          {canSetInternal && (
            <button
              type="button"
              onClick={() => setIsInternal(!isInternal)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                isInternal
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'text-[#6c7c93] hover:bg-[#f3f4f7]'
              }`}
            >
              {isInternal ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {isInternal ? 'Nota interna' : 'Visível ao cliente'}
            </button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!content.trim() || addComment.isPending}
            className="ml-auto h-8 gap-1.5 bg-[#0d4da5] hover:bg-[#0a3776] text-white text-xs"
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
  )
}
