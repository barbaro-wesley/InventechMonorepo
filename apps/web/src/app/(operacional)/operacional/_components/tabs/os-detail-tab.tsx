'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, Clock, Wrench, User, Building2, Tag, Plus, X, Loader2, File as FileIcon, Download, Paperclip, ChevronLeft, ChevronRight, ZoomIn, FileText } from 'lucide-react'
import { storageService } from '@/services/storage/storage.service'
import type { Attachment } from '@/services/storage/storage.service'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ServiceOrderDetail } from '@/services/service-orders/service-orders.types'
import { useAddTechnician, useRemoveTechnician } from '@/hooks/service-orders/use-service-orders'
import { useUsers } from '@/hooks/users/use-users'
import { PRIORITY_CONFIG, STATUS_CONFIG, MAINTENANCE_TYPE_LABELS, timeAgo, formatDuration } from '../os-utils'

interface OsDetailTabProps {
  os: ServiceOrderDetail
  clientId: string | null
  osId: string
  canManage: boolean
}

function InfoRow({ icon: Icon, label, children }: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[#f3f4f7]">
        <Icon className="h-3 w-3 text-[#6c7c93]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[#6c7c93] mb-0.5">{label}</p>
        <div className="text-sm text-[#1d2530]">{children}</div>
      </div>
    </div>
  )
}

function TechAvatar({ name }: { name: string }) {
  const colors = ['bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500']
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const color = colors[Math.abs(hash) % colors.length]
  const initials = name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
  return (
    <div className={`h-7 w-7 rounded-full ${color} flex items-center justify-center shrink-0`}>
      <span className="text-white text-xs font-semibold">{initials}</span>
    </div>
  )
}

function AttachmentCarousel({ images }: { images: Attachment[] }) {
  const [current, setCurrent] = useState(0)
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    images.forEach((img) => {
      storageService.getUrl(img.id).then((url) =>
        setUrls((prev) => ({ ...prev, [img.id]: url })),
      )
    })
  }, [images])

  const prev = useCallback(() => setCurrent((i) => (i - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setCurrent((i) => (i + 1) % images.length), [images.length])

  useEffect(() => {
    if (lightbox === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setCurrent((i) => (i - 1 + images.length) % images.length)
      if (e.key === 'ArrowRight') setCurrent((i) => (i + 1) % images.length)
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, images.length])

  if (images.length === 0) return null

  return (
    <>
      {/* Carousel */}
      <div className="relative rounded-xl overflow-hidden bg-[#0d1117] select-none" style={{ height: 220 }}>
        {/* Slides */}
        <div
          className="flex h-full transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {images.map((img, i) => (
            <div key={img.id} className="relative shrink-0 w-full h-full flex items-center justify-center">
              {urls[img.id] ? (
                <>
                  <img
                    src={urls[img.id]}
                    alt={img.fileName}
                    className="max-h-full max-w-full object-contain"
                    draggable={false}
                  />
                  <button
                    onClick={() => setLightbox(i)}
                    className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
                  >
                    <ZoomIn className="h-8 w-8 text-white drop-shadow-lg" />
                  </button>
                </>
              ) : (
                <Loader2 className="h-6 w-6 text-white/40 animate-spin" />
              )}
            </div>
          ))}
        </div>

        {/* Arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center text-white transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Counter */}
        {images.length > 1 && (
          <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
            {current + 1}/{images.length}
          </div>
        )}

        {/* Dots */}
        {images.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`rounded-full transition-all ${
                  i === current ? 'bg-white w-4 h-1.5' : 'bg-white/40 w-1.5 h-1.5'
                }`}
              />
            ))}
          </div>
        )}

        {/* File name */}
        <div className="absolute bottom-7 left-0 right-0 text-center pointer-events-none">
          {images.length > 1 && (
            <span className="text-[10px] text-white/60 truncate px-4 block">
              {images[current].fileName}
            </span>
          )}
        </div>
      </div>

      {/* Thumbnails strip */}
      {images.length > 1 && (
        <div className="flex gap-1.5 mt-1.5 overflow-x-auto pb-0.5">
          {images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setCurrent(i)}
              className={`shrink-0 h-10 w-10 rounded-md overflow-hidden border-2 transition-all ${
                i === current ? 'border-[#0d4da5]' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {urls[img.id] ? (
                <img src={urls[img.id]} alt={img.fileName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[#f3f4f7]" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev() }}
                className="absolute left-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next() }}
                className="absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}

          <div className="max-w-4xl max-h-[85vh] p-4" onClick={(e) => e.stopPropagation()}>
            {urls[images[current].id] && (
              <img
                src={urls[images[current].id]}
                alt={images[current].fileName}
                className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl"
              />
            )}
            <p className="text-center text-white/60 text-xs mt-3">{images[current].fileName}</p>
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-[11px]">
            {current + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  )
}

export function OsDetailTab({ os, clientId, osId, canManage }: OsDetailTabProps) {
  const priority = PRIORITY_CONFIG[os.priority]
  const status = STATUS_CONFIG[os.status]

  const [selectedTechId, setSelectedTechId] = useState('')
  const addTechnician = useAddTechnician(clientId, osId)
  const removeTechnician = useRemoveTechnician(clientId, osId)

  // Busca técnicos: do prestador (se OS externa) ou da empresa (se OS interna)
  const { data: techData } = useUsers({ role: 'TECHNICIAN', clientId: os.client?.id, limit: 100 })
  const linkedIds = new Set(os.technicians.map((t) => t.technician.id))
  const availableTechs = (techData?.data ?? []).filter((u) => !linkedIds.has(u.id))

  const isTerminal = os.status === 'COMPLETED_APPROVED' || os.status === 'CANCELLED'

  const handleAddTechnician = () => {
    if (!selectedTechId) return
    addTechnician.mutate(
      { technicianId: selectedTechId, role: 'ASSISTANT' },
      { onSuccess: () => setSelectedTechId('') },
    )
  }

  return (
    <div className="space-y-5 py-1">
      {/* Descrição */}
      <div>
        <p className="text-[11px] text-[#6c7c93] mb-1.5 font-medium uppercase tracking-wide">Descrição</p>
        <p className="text-sm text-[#1d2530] leading-relaxed bg-[#f8f9fb] rounded-lg p-3 border border-[#e0e5eb]">
          {os.description}
        </p>
      </div>

      {/* Informações principais */}
      <div>
        <p className="text-[11px] text-[#6c7c93] mb-3 font-medium uppercase tracking-wide">Informações</p>
        <div className="space-y-3">
          <InfoRow icon={Tag} label="Status">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${status.bg} ${status.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </InfoRow>

          <InfoRow icon={Tag} label="Prioridade">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border ${priority.badge}`}>
              {priority.label}
            </span>
          </InfoRow>

          <InfoRow icon={Wrench} label="Tipo de manutenção">
            <span>{MAINTENANCE_TYPE_LABELS[os.maintenanceType]}</span>
          </InfoRow>

          <InfoRow icon={Building2} label="Prestador">
            <span>{os.client?.name ?? 'Interno'}</span>
          </InfoRow>

          <InfoRow icon={Wrench} label="Equipamento">
            <div>
              <p>{os.equipment?.name ?? '—'}</p>
              {os.equipment?.patrimonyNumber && (
                <p className="text-[11px] text-[#6c7c93]">Patrimônio: {os.equipment.patrimonyNumber}</p>
              )}
              {os.equipment?.serialNumber && (
                <p className="text-[11px] text-[#6c7c93]">N/S: {os.equipment.serialNumber}</p>
              )}
              {(os.equipment?.brand || os.equipment?.model) && (
                <p className="text-[11px] text-[#6c7c93]">
                  {[os.equipment?.brand, os.equipment?.model].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
          </InfoRow>

          {os.group && (
            <InfoRow icon={Tag} label="Grupo">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ background: os.group.color ?? '#94a3b8' }}
                />
                <span>{os.group.name}</span>
              </div>
            </InfoRow>
          )}

          {os.requester && (
            <InfoRow icon={User} label="Solicitante">
              <span>{os.requester.name}</span>
            </InfoRow>
          )}

          <InfoRow icon={Clock} label="Criada">
            <span>{timeAgo(os.createdAt)}</span>
          </InfoRow>

          {os.startedAt && (
            <InfoRow icon={Clock} label="Iniciada">
              <span>
                {timeAgo(os.startedAt)}
                {!os.completedAt && (
                  <span className="ml-2 text-[#6c7c93] text-xs">
                    ({formatDuration(os.startedAt)} em andamento)
                  </span>
                )}
              </span>
            </InfoRow>
          )}

          {os.completedAt && (
            <InfoRow icon={Clock} label="Concluída">
              <span>
                {timeAgo(os.completedAt)}
                <span className="ml-2 text-[#6c7c93] text-xs">
                  (duração: {formatDuration(os.startedAt ?? os.createdAt, os.completedAt)})
                </span>
              </span>
            </InfoRow>
          )}

          {os.scheduledFor && (
            <InfoRow icon={Calendar} label="Agendada para">
              <span>{new Date(os.scheduledFor).toLocaleDateString('pt-BR')}</span>
            </InfoRow>
          )}

          {(os.estimatedHours || os.actualHours) && (
            <InfoRow icon={Clock} label="Horas">
              <div className="flex gap-4">
                {os.estimatedHours && (
                  <span className="text-xs">
                    <span className="text-[#6c7c93]">Estimado: </span>
                    {os.estimatedHours}h
                  </span>
                )}
                {os.actualHours && (
                  <span className="text-xs">
                    <span className="text-[#6c7c93]">Real: </span>
                    {os.actualHours}h
                  </span>
                )}
              </div>
            </InfoRow>
          )}
        </div>
      </div>

      {/* Técnicos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-[#6c7c93] font-medium uppercase tracking-wide">Técnicos</p>
        </div>

        <div className="space-y-2">
          {os.technicians.length === 0 && (
            <p className="text-xs text-[#6c7c93] italic">Nenhum técnico vinculado</p>
          )}
          {os.technicians.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-[#f8f9fb] border border-[#e0e5eb]">
              <TechAvatar name={t.technician.name} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#1d2530]">{t.technician.name}</p>
                <p className="text-xs text-[#6c7c93]">{t.technician.email}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                t.role === 'LEAD'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-slate-50 text-slate-600 border border-slate-200'
              }`}>
                {t.role === 'LEAD' ? 'Responsável' : 'Auxiliar'}
              </span>
              {canManage && !isTerminal && t.role !== 'LEAD' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-[#6c7c93] hover:text-red-500 shrink-0"
                  disabled={removeTechnician.isPending}
                  onClick={() => removeTechnician.mutate(t.technician.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}

          {/* Adicionar técnico auxiliar */}
          {canManage && !isTerminal && availableTechs.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <Select value={selectedTechId} onValueChange={setSelectedTechId}>
                <SelectTrigger className="h-8 text-xs flex-1 bg-[#f3f4f7] border-transparent">
                  <SelectValue placeholder="Adicionar técnico auxiliar..." />
                </SelectTrigger>
                <SelectContent>
                  {availableTechs.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-8 text-xs px-3 shrink-0"
                disabled={!selectedTechId || addTechnician.isPending}
                onClick={handleAddTechnician}
              >
                {addTechnician.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Resolução */}
      {os.resolution && (
        <div>
          <p className="text-[11px] text-[#6c7c93] mb-1.5 font-medium uppercase tracking-wide">Resolução</p>
          <p className="text-sm text-[#1d2530] leading-relaxed bg-emerald-50 rounded-lg p-3 border border-emerald-200">
            {os.resolution}
          </p>
        </div>
      )}

      {/* Laudos Vinculados */}
      {os.laudos && os.laudos.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <FileText className="h-3 w-3 text-[#6c7c93]" />
            <p className="text-[11px] text-[#6c7c93] font-medium uppercase tracking-wide">
              Laudos Vinculados ({os.laudos.length})
            </p>
          </div>
          <div className="space-y-2">
            {os.laudos.map((laudo) => {
              const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
                DRAFT: { label: 'Rascunho', bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600' },
                PENDING_REVIEW: { label: 'Em Revisão', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
                PENDING_SIGNATURE: { label: 'Aguard. Assinatura', bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700' },
                SIGNED: { label: 'Assinado', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
                APPROVED: { label: 'Aprovado', bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700' },
                CANCELLED: { label: 'Cancelado', bg: 'bg-red-50 border-red-200', text: 'text-red-600' },
              }
              const st = statusConfig[laudo.status] ?? { label: laudo.status, bg: 'bg-slate-50 border-slate-200', text: 'text-slate-600' }
              const laudoNum = String(laudo.number).padStart(4, '0')
              const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1'

              return (
                <div
                  key={laudo.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#f8f9fb] border border-[#e0e5eb] hover:border-[#c5cdd8] transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[#1d2530] truncate">
                        #{laudoNum} — {laudo.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium border ${st.bg} ${st.text}`}>
                        {st.label}
                      </span>
                      {laudo.technician && (
                        <span className="text-[11px] text-[#6c7c93] truncate">
                          Técnico: {laudo.technician.name}
                        </span>
                      )}
                      <span className="text-[11px] text-[#6c7c93]">
                        {new Date(laudo.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {laudo.status === 'SIGNED' && (
                      <a
                        href={`${apiBase}/laudos/${laudo.id}/signed-pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-50 hover:bg-violet-100 text-violet-600 transition-colors"
                        title="Baixar PDF assinado"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <a
                      href={`${apiBase}/laudos/${laudo.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                      title={laudo.status === 'SIGNED' ? 'Baixar PDF original' : 'Baixar PDF'}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notas internas */}
      {os.internalNotes && (
        <div>
          <p className="text-[11px] text-[#6c7c93] mb-1.5 font-medium uppercase tracking-wide">Notas Internas</p>
          <p className="text-sm text-[#1d2530] leading-relaxed bg-amber-50 rounded-lg p-3 border border-amber-200">
            {os.internalNotes}
          </p>
        </div>
      )}

      {/* Anexos da OS */}
      {os.attachments && os.attachments.length > 0 && (() => {
        const images = os.attachments.filter((a) => a.mimeType.startsWith('image/'))
        const docs = os.attachments.filter((a) => !a.mimeType.startsWith('image/'))
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5">
              <Paperclip className="h-3 w-3 text-[#6c7c93]" />
              <p className="text-[11px] text-[#6c7c93] font-medium uppercase tracking-wide">
                Anexos ({os.attachments.length})
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
                    className="flex items-center gap-2 p-2.5 bg-[#f8f9fb] border border-[#e0e5eb] hover:border-[#c5cdd8] rounded-lg group transition-all"
                  >
                    <FileIcon className="h-4 w-4 text-[#6c7c93] shrink-0" />
                    <span className="text-xs font-medium text-[#1d2530] truncate flex-1">{doc.fileName}</span>
                    <Download className="h-3.5 w-3.5 text-[#6c7c93] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
