'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import type { Source } from '@/types'

const CARD_W = 280
const GRACE_MS = 150

interface Preview {
  title: string
  url: string
  hostname: string
  top: number
  left: number
  placeAbove: boolean
}

function normalize(url: string) {
  return url.replace(/\/+$/, '')
}

interface Props {
  sources: Source[]
  containerRef: RefObject<HTMLDivElement | null>
}

export default function CitationHoverCard({ sources, containerRef }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [imgFailed, setImgFailed] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }, [])
  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => setPreview(null), GRACE_MS)
  }, [cancelClose])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    function handleOver(e: MouseEvent) {
      const target = e.target as Element | null
      const anchor = target?.closest('a[data-citation]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href) return

      cancelClose()
      setImgFailed(false)

      let hostname = ''
      try { hostname = new URL(href).hostname } catch { /* keep empty */ }

      const match =
        sources.find((s) => s.url === href) ??
        sources.find((s) => normalize(s.url) === normalize(href))
      const title = match?.title || hostname || href

      const rect = anchor.getBoundingClientRect()
      const centered = rect.left + rect.width / 2 - CARD_W / 2
      const left = Math.min(Math.max(8, centered), window.innerWidth - CARD_W - 8)
      // Flip above when there isn't comfortable room below the citation.
      const placeAbove = window.innerHeight - rect.bottom < 140
      const top = placeAbove ? rect.top - 8 : rect.bottom + 8

      setPreview({ title, url: href, hostname, top, left, placeAbove })
    }

    function handleOut(e: MouseEvent) {
      const target = e.target as Element | null
      if (target?.closest('a[data-citation]')) scheduleClose()
    }

    container.addEventListener('mouseover', handleOver)
    container.addEventListener('mouseout', handleOut)
    return () => {
      container.removeEventListener('mouseover', handleOver)
      container.removeEventListener('mouseout', handleOut)
      cancelClose()
    }
  }, [containerRef, sources, cancelClose, scheduleClose])

  if (!preview) return null

  const favicon = preview.hostname
    ? `https://www.google.com/s2/favicons?domain=${preview.hostname}&sz=64`
    : null

  return (
    <>
      <style>{`
        @keyframes citation-card-in {
          from { opacity: 0; transform: translateY(4px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    <div
      key={preview.url}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      style={{
        position: 'fixed',
        left: preview.left,
        top: preview.placeAbove ? undefined : preview.top,
        bottom: preview.placeAbove ? window.innerHeight - preview.top : undefined,
        width: CARD_W,
        zIndex: 1100,
        transformOrigin: preview.placeAbove ? 'bottom center' : 'top center',
        animation: 'citation-card-in 170ms cubic-bezier(0, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 14,
        borderRadius: 14,
        background: 'var(--panel-bg)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid var(--panel-border)',
        boxShadow: 'var(--slab-shadow), inset 0 0 22px var(--glass-inset-shadow)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {favicon && !imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={favicon}
            alt=""
            width={20}
            height={20}
            onError={() => setImgFailed(true)}
            style={{ flexShrink: 0, borderRadius: 4, marginTop: 1 }}
          />
        )}
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          lineHeight: 1.4,
          color: 'var(--text)',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {preview.title}
        </span>
      </div>
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontSize: 12,
          color: 'var(--node-factual)',
          textDecoration: 'none',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {preview.url}
      </a>
    </div>
    </>
  )
}
