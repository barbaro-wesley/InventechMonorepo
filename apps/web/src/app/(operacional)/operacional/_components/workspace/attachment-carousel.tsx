'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, Loader2, X } from 'lucide-react'
import { storageService } from '@/services/storage/storage.service'
import type { Attachment } from '@/services/storage/storage.service'

/** Carrossel de imagens com lightbox e navegação por teclado. */
export function AttachmentCarousel({ images }: { images: Attachment[] }) {
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
                i === current ? 'border-[#0d4da5] dark:border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              {urls[img.id] ? (
                <img src={urls[img.id]} alt={img.fileName} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[#f3f4f7] dark:bg-zinc-800 " />
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
