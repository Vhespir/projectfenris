import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { useIsMobile } from '../hooks/useIsMobile'

interface Conversation {
  partner_id: number
  partner_username: string
  partner_avatar: string | null
  last_at: string
  unread_count: number
  last_body: string | null
}

interface Message {
  id: number
  is_mine: boolean
  body: string
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function Avatar({ url, username, size = 36 }: { url: string | null; username: string; size?: number }) {
  return (
    <img
      src={url || '/wolf-avatar.jpeg'}
      alt={username}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)', flexShrink: 0 }}
    />
  )
}

export default function Inbox() {
  const { username: partnerUsername } = useParams<{ username?: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const socket = useSocket()

  const [convos, setConvos] = useState<Conversation[]>([])
  const [convosLoading, setConvosLoading] = useState(true)
  const [messages, setMessages] = useState<Message[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const loadConvos = useCallback(async () => {
    try {
      const r = await fetch('/api/messages')
      if (r.ok) setConvos(await r.json())
    } catch {}
    setConvosLoading(false)
  }, [])

  const loadThread = useCallback(async (username: string) => {
    setThreadLoading(true)
    setMessages([])
    try {
      const r = await fetch(`/api/messages/${username}`)
      if (r.ok) setMessages(await r.json())
    } catch {}
    setThreadLoading(false)
    await fetch(`/api/messages/${username}/read`, { method: 'PATCH' }).catch(() => {})
    setConvos(cs => cs.map(c =>
      c.partner_username === username ? { ...c, unread_count: 0 } : c
    ))
  }, [])

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    loadConvos()
  }, [user, loadConvos, navigate])

  useEffect(() => {
    if (partnerUsername && user) loadThread(partnerUsername)
  }, [partnerUsername, loadThread, user])

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!socket) return
    const handler = (data: { from: string; preview: string }) => {
      if (partnerUsername === data.from) {
        loadThread(data.from)
      } else {
        setConvos(cs => {
          const exists = cs.find(c => c.partner_username === data.from)
          if (exists) {
            return cs.map(c => c.partner_username === data.from
              ? { ...c, unread_count: c.unread_count + 1, last_body: data.preview, last_at: new Date().toISOString() }
              : c
            )
          }
          loadConvos()
          return cs
        })
      }
    }
    socket.on('new_message', handler)
    return () => { socket.off('new_message', handler) }
  }, [socket, partnerUsername, loadThread, loadConvos])

  if (!user) return null

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || sending || !partnerUsername) return
    setSending(true)
    try {
      const res = await fetch(`/api/messages/${partnerUsername}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      if (res.ok) {
        const msg = await res.json()
        setMessages(ms => [...ms, msg])
        setBody('')
        setConvos(cs => {
          const exists = cs.find(c => c.partner_username === partnerUsername)
          if (exists) {
            return [
              { ...exists, last_body: msg.body, last_at: msg.created_at },
              ...cs.filter(c => c.partner_username !== partnerUsername),
            ]
          }
          loadConvos()
          return cs
        })
        inputRef.current?.focus()
      }
    } finally {
      setSending(false)
    }
  }

  const showList = !isMobile || !partnerUsername
  const showThread = !isMobile || !!partnerUsername

  const ConvoList = (
    <div style={{
      width: isMobile ? '100%' : '260px',
      flexShrink: 0,
      borderRight: isMobile ? 'none' : '1px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
        fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700,
      }}>
        Messages
      </div>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {convosLoading ? (
          <div style={{ padding: '32px 20px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
            Loading...
          </div>
        ) : convos.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px', marginBottom: '12px' }}>
              No messages yet
            </div>
            <div style={{ color: 'var(--color-muted)', fontSize: '13px', fontFamily: 'var(--font-body)' }}>
              Visit a user's profile to start a conversation.
            </div>
          </div>
        ) : (
          convos.map(c => {
            const isActive = c.partner_username === partnerUsername
            return (
              <Link
                key={c.partner_id}
                to={`/inbox/${c.partner_username}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 20px',
                  background: isActive ? 'var(--color-surface)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? 'var(--color-accent)' : 'transparent'}`,
                  transition: 'background 0.1s',
                }}>
                  <Avatar url={c.partner_avatar} username={c.partner_username} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: c.unread_count > 0 ? 700 : 500,
                        color: c.unread_count > 0 ? 'var(--color-text)' : 'var(--color-muted)',
                      }}>
                        {c.partner_username}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {c.unread_count > 0 && (
                          <span style={{
                            background: 'var(--color-accent)', color: '#0A0A0A',
                            fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '1px 5px', borderRadius: '8px', lineHeight: 1.6,
                          }}>
                            {c.unread_count}
                          </span>
                        )}
                        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                          {timeAgo(c.last_at)}
                        </span>
                      </div>
                    </div>
                    {c.last_body && (
                      <div style={{
                        fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-body)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        fontWeight: c.unread_count > 0 ? 600 : 400,
                      }}>
                        {c.last_body}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )

  const ThreadPanel = partnerUsername ? (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        {isMobile && (
          <Link to="/inbox" style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '12px', textDecoration: 'none', flexShrink: 0 }}>
            &larr; Back
          </Link>
        )}
        <Link to={`/profile/${partnerUsername}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flex: 1, minWidth: 0 }}>
          {(() => {
            const c = convos.find(c => c.partner_username === partnerUsername)
            return <Avatar url={c?.partner_avatar ?? null} username={partnerUsername} size={32} />
          })()}
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {partnerUsername}
          </span>
        </Link>
      </div>

      <div ref={threadRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {threadLoading ? (
          <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px', textAlign: 'center', paddingTop: '40px' }}>
            Loading...
          </div>
        ) : messages.length === 0 ? (
          <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px', textAlign: 'center', paddingTop: '40px' }}>
            No messages yet. Say hello.
          </div>
        ) : (
          messages.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: m.is_mine ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%', padding: '10px 14px', borderRadius: m.is_mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.is_mine ? 'var(--color-accent)' : 'var(--color-surface)',
                color: m.is_mine ? '#0A0A0A' : 'var(--color-text)',
                border: m.is_mine ? 'none' : '1px solid var(--color-border)',
                fontSize: '14px', fontFamily: 'var(--font-body)', lineHeight: 1.5,
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {m.body}
                <div style={{
                  fontSize: '10px', fontFamily: 'var(--font-mono)', marginTop: '4px', textAlign: 'right',
                  color: m.is_mine ? 'rgba(10,10,10,0.5)' : 'var(--color-subtle)',
                }}>
                  {timeAgo(m.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} style={{ padding: '12px 20px', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={body}
          onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e as unknown as React.FormEvent) } }}
          placeholder="Write a message..."
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: '8px', resize: 'none',
            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
            color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
            outline: 'none', lineHeight: 1.5, maxHeight: '120px', overflowY: 'auto',
          }}
          onInput={e => {
            const t = e.currentTarget
            t.style.height = 'auto'
            t.style.height = Math.min(t.scrollHeight, 120) + 'px'
          }}
          onFocus={e => (e.target.style.borderColor = 'var(--color-accent)')}
          onBlur={e => (e.target.style.borderColor = 'var(--color-border)')}
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          style={{
            padding: '10px 18px', borderRadius: '8px', border: 'none', cursor: sending || !body.trim() ? 'not-allowed' : 'pointer',
            background: sending || !body.trim() ? 'var(--color-border)' : 'var(--color-accent)',
            color: sending || !body.trim() ? 'var(--color-muted)' : '#0A0A0A',
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          Send
        </button>
      </form>
    </div>
  ) : (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--color-border)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: 'var(--color-muted)' }}>
          Select a conversation
        </div>
      </div>
    </div>
  )

  return (
    <div style={{
      height: 'calc(100vh - 60px)', display: 'flex', overflow: 'hidden',
      maxWidth: '900px', margin: '0 auto',
      borderLeft: '1px solid var(--color-border)', borderRight: '1px solid var(--color-border)',
    }}>
      {showList && ConvoList}
      {showThread && ThreadPanel}
    </div>
  )
}
