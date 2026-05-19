import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

interface RefData {
  type: 'event' | 'news' | 'guide' | 'aar'
  slug: string
  title: string
  severity?: string
  source?: string
  category?: string
  url?: string
  fetched_at?: string
  published_at?: string
  incident_date?: string
  author?: string
  signal_count?: number
}

const SEV_COLOR: Record<string, string> = {
  Extreme: '#EF4444', Severe: '#EF4444', Moderate: '#F59E0B', Minor: '#22C55E',
}

const refCache = new Map<string, RefData | null>()

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function RefCard({ slug }: { slug: string }) {
  const [data, setData] = useState<RefData | null | 'loading'>('loading')

  useEffect(() => {
    if (refCache.has(slug)) { setData(refCache.get(slug) ?? null); return }
    fetch(`/api/refs/lookup?slug=${encodeURIComponent(slug)}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { refCache.set(slug, d); setData(d) })
      .catch(() => { refCache.set(slug, null); setData(null) })
  }, [slug])

  if (data === 'loading') return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', padding: '2px 6px', border: '1px solid var(--color-border)', borderRadius: '4px', display: 'inline-block' }}>
      #{slug}
    </span>
  )

  if (!data) return (
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>#{slug}</span>
  )

  const isGuide = data.type === 'guide'
  const isAar = data.type === 'aar'
  const accentColor = data.severity
    ? (SEV_COLOR[data.severity] ?? 'var(--color-accent)')
    : isGuide ? '#8B5CF6'
    : isAar ? '#3B82F6'
    : 'var(--color-accent)'
  const timestamp = data.fetched_at ?? data.published_at ?? data.incident_date

  const typeLabel = data.type === 'event' ? 'EVENT'
    : data.type === 'news' ? 'NEWS'
    : data.type === 'guide' ? 'GUIDE'
    : 'AAR'

  const meta = isGuide
    ? [data.category, data.signal_count != null ? `${data.signal_count} signal` : null, data.author ? `by @${data.author}` : null].filter(Boolean).join(' · ')
    : isAar
    ? [data.author ? `by @${data.author}` : null, timestamp ? timeAgo(timestamp) : null].filter(Boolean).join(' · ')
    : [data.source?.toUpperCase(), data.category, timestamp ? timeAgo(timestamp) : null].filter(Boolean).join(' · ')

  const card = (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '3px',
      padding: '9px 13px',
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border)',
      borderLeft: `3px solid ${accentColor}`,
      borderRadius: '6px',
      maxWidth: '480px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          {typeLabel}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', letterSpacing: '0.08em' }}>
          #{slug}
        </span>
        {data.severity && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: accentColor, letterSpacing: '0.06em' }}>{data.severity}</span>
        )}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.35 }}>
        {data.title}
      </div>
      {meta && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>
          {meta}
        </div>
      )}
    </div>
  )

  if (data.type === 'news' && data.url) {
    return (
      <a href={data.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
        {card}
      </a>
    )
  }

  if (isGuide) {
    return <Link to={`/compendium/${data.id}`} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link>
  }

  if (isAar) {
    return <Link to={`/aar/${data.id}`} style={{ textDecoration: 'none', display: 'block' }}>{card}</Link>
  }

  return card
}

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'mention'; username: string }
  | { kind: 'ref'; slug: string }

function parseBody(text: string): Segment[] {
  const segments: Segment[] = []
  const pattern = /(@[a-zA-Z0-9_]+|#[A-Za-z]+-[A-Za-z]+(?:-\d+)?)/g
  let last = 0

  for (const match of text.matchAll(pattern)) {
    if (match.index! > last) segments.push({ kind: 'text', value: text.slice(last, match.index) })
    const raw = match[0]
    if (raw.startsWith('@')) {
      segments.push({ kind: 'mention', username: raw.slice(1) })
    } else {
      segments.push({ kind: 'ref', slug: raw.slice(1).toUpperCase() })
    }
    last = match.index! + raw.length
  }

  if (last < text.length) segments.push({ kind: 'text', value: text.slice(last) })
  return segments
}

export function PostBody({ text }: { text: string }) {
  const segments = parseBody(text)
  const refSegments = segments.filter(s => s.kind === 'ref')

  return (
    <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {segments.map((seg, i) => {
        if (seg.kind === 'text') return <span key={i}>{seg.value}</span>

        if (seg.kind === 'mention') return (
          <Link key={i} to={`/profile/${seg.username}`}
            style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
            @{seg.username}
          </Link>
        )

        if (seg.kind === 'ref') return (
          <span key={i} style={{ display: 'block', marginTop: refSegments.length > 1 ? '6px' : '8px' }}>
            <RefCard slug={seg.slug} />
          </span>
        )

        return null
      })}
    </div>
  )
}
