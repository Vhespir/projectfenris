import { useState, useRef, useEffect } from 'react'

interface UserSuggestion {
  kind: 'user'
  username: string
  avatar_url: string | null
  is_trusted: boolean
}

interface RefSuggestion {
  kind: 'ref'
  type: 'event' | 'news'
  slug: string
  title: string
  severity?: string
  source: string
}

type Suggestion = UserSuggestion | RefSuggestion

const SEV_COLOR: Record<string, string> = {
  Extreme: '#EF4444', Severe: '#EF4444', Moderate: '#F59E0B', Minor: '#22C55E',
}

export function MentionTextarea({
  value, onChange, rows, placeholder, style,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  style?: React.CSSProperties
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [triggerStart, setTriggerStart] = useState<number | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function getActiveToken(text: string, cursor: number): { char: '@' | '#'; query: string; start: number } | null {
    let i = cursor - 1
    while (i >= 0 && !/\s/.test(text[i])) i--
    i++
    const word = text.slice(i, cursor)
    if (!word) return null
    const tc = word[0]
    if (tc !== '@' && tc !== '#') return null
    return { char: tc as '@' | '#', query: word.slice(1), start: i }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const newVal = e.target.value
    onChange(newVal)

    const cursor = e.target.selectionStart ?? newVal.length
    const token = getActiveToken(newVal, cursor)

    if (!token) {
      setSuggestions([])
      setTriggerStart(null)
      return
    }

    setTriggerStart(token.start)
    setSelectedIdx(0)

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        if (token.char === '@') {
          const res = await fetch(`/api/users/autocomplete?q=${encodeURIComponent(token.query)}`, { credentials: 'include' })
          const data = await res.json()
          setSuggestions(
            Array.isArray(data)
              ? data.map((u: { username: string; avatar_url: string | null; is_trusted: boolean }) => ({ kind: 'user' as const, username: u.username, avatar_url: u.avatar_url, is_trusted: u.is_trusted }))
              : []
          )
        } else {
          if (!token.query) { setSuggestions([]); return }
          const res = await fetch(`/api/refs/search?q=${encodeURIComponent(token.query)}`, { credentials: 'include' })
          const data = await res.json()
          setSuggestions(
            Array.isArray(data)
              ? data.map((r: { type: string; slug: string; title: string; severity?: string; source: string }) => ({ kind: 'ref' as const, type: r.type as 'event' | 'news', slug: r.slug, title: r.title, severity: r.severity, source: r.source }))
              : []
          )
        }
      } catch { setSuggestions([]) }
    }, 180)
  }

  function applySuggestion(s: Suggestion) {
    if (triggerStart === null) return
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const insert = s.kind === 'user' ? `@${s.username} ` : `#${s.slug} `
    const newVal = value.slice(0, triggerStart) + insert + value.slice(cursor)
    onChange(newVal)
    setSuggestions([])
    setTriggerStart(null)
    setTimeout(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      const pos = triggerStart + insert.length
      textareaRef.current.setSelectionRange(pos, pos)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applySuggestion(suggestions[selectedIdx]) }
    else if (e.key === 'Escape') { setSuggestions([]); setTriggerStart(null) }
  }

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (textareaRef.current && !textareaRef.current.contains(e.target as Node)) {
        setSuggestions([])
        setTriggerStart(null)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  return (
    <div style={{ position: 'relative' }}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        rows={rows ?? 4}
        placeholder={placeholder}
        style={style}
      />

      {suggestions.length > 0 && (
        <div style={{
          position: 'absolute', bottom: '100%', left: 0, zIndex: 100,
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '6px', minWidth: '240px', maxWidth: '380px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.35)', overflow: 'hidden',
          marginBottom: '4px',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onPointerDown={e => { e.preventDefault(); applySuggestion(s) }}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                padding: '8px 12px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '9px',
                background: i === selectedIdx ? 'rgba(255,255,255,0.05)' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--color-border)' : 'none',
              }}
            >
              {s.kind === 'user' ? (
                <>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0, background: 'var(--color-bg)', border: '1px solid var(--color-border)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {s.avatar_url
                      ? <img src={s.avatar_url} alt={s.username} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)' }}>{s.username[0].toUpperCase()}</span>
                    }
                  </div>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', color: 'var(--color-text)', flex: 1 }}>@{s.username}</span>
                  {s.is_trusted && (
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-accent)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '3px', padding: '1px 4px', flexShrink: 0 }}>TRUSTED</span>
                  )}
                </>
              ) : (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: s.severity ? (SEV_COLOR[s.severity] ?? 'var(--color-accent)') : 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {s.type === 'event' ? 'EVENT' : 'NEWS'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', letterSpacing: '0.06em' }}>#{s.slug}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '12px', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div style={{ padding: '3px 12px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', background: 'rgba(0,0,0,0.2)', letterSpacing: '0.04em' }}>
            Tab or Enter to select
          </div>
        </div>
      )}
    </div>
  )
}
