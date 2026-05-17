import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { getTier } from '../utils/tier'

interface Guide {
  id: number
  user_id: number | null
  title: string
  body: string
  category: string
  region: string | null
  signal_count: number
  noise_count: number
  created_at: string
  username: string | null
  reputation: number
  is_trusted?: boolean
  is_founding_member?: boolean
}

interface Comment {
  id: number
  user_id: number | null
  body: string
  created_at: string
  upvote_count: number
  noise_count: number
  username: string | null
  reputation: number
  is_trusted?: boolean
  is_founding_member?: boolean
}

const GUIDE_CATEGORIES = [
  'Beginner Guides', 'Advanced Techniques', 'Regional Specific', 'Gear Reviews',
  'DIY and Build', 'Medical References', 'Comms and Technology',
  'Homesteading and Farming', 'Off Grid Systems', 'Ham Radio and Comms',
  'Security and Defense', 'Financial Resilience',
]

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1 day ago'
  if (days < 30) return `${days} days ago`
  if (days < 365) return `${Math.floor(days / 30)} months ago`
  return `${Math.floor(days / 365)}y ago`
}

export default function GuideDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const [guide, setGuide] = useState<Guide | null>(null)
  const [loading, setLoading] = useState(true)
  const [myVote, setMyVote] = useState<'signal' | 'noise' | null>(null)
  const [voting, setVoting] = useState(false)
  const [signalCount, setSignalCount] = useState(0)
  const [noiseCount, setNoiseCount] = useState(0)

  const [editingGuide, setEditingGuide] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', body: '', category: '', region: '' })
  const [editSaving, setEditSaving] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editCommentBody, setEditCommentBody] = useState('')
  const [commentVotes, setCommentVotes] = useState<Record<number, 'signal' | 'noise' | null>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!id) return
    fetch(`/api/guides/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { navigate('/compendium'); return }
        setGuide(data)
        setSignalCount(data.signal_count)
        setNoiseCount(data.noise_count)
        setEditForm({ title: data.title, body: data.body, category: data.category, region: data.region ?? '' })
        setLoading(false)
      })
      .catch(() => navigate('/compendium'))
  }, [id])

  useEffect(() => {
    if (!id) return
    fetch(`/api/guides/${id}/comments`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setComments(data))
      .catch(() => {})
  }, [id])

  useEffect(() => {
    if (!id || !user) return
    fetch(`/api/guides/${id}/myvote`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setMyVote(data.vote))
      .catch(() => {})
  }, [id, user])

  async function handleVote(dir: 'signal' | 'noise') {
    if (!user) { navigate('/login'); return }
    if (voting) return
    setVoting(true)
    try {
      const active = myVote === dir
      const method = active ? 'DELETE' : 'POST'
      const res = await fetch(`/api/guides/${id}/${dir}`, { method })
      if (!res.ok) return
      const data = await res.json()
      setSignalCount(data.signal_count)
      setNoiseCount(data.noise_count)
      setMyVote(active ? null : dir)
    } finally {
      setVoting(false)
    }
  }

  async function handleSaveGuide(e: React.FormEvent) {
    e.preventDefault()
    if (!guide || editSaving) return
    setEditSaving(true)
    try {
      const res = await fetch(`/api/guides/${guide.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          body: editForm.body,
          category: editForm.category,
          region: editForm.region || null,
        }),
      })
      if (!res.ok) return
      const updated = await res.json()
      setGuide(g => g ? { ...g, ...updated } : g)
      setEditingGuide(false)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDeleteGuide() {
    if (!guide || !confirm('Delete this guide? This cannot be undone.')) return
    const res = await fetch(`/api/guides/${guide.id}`, { method: 'DELETE' })
    if (res.ok) navigate('/compendium')
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/guides/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody.trim() }),
      })
      if (res.ok) {
        const newComment = await res.json()
        setComments(c => [...c, newComment])
        setCommentBody('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveComment(commentId: number) {
    if (!editCommentBody.trim()) return
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editCommentBody.trim() }),
    })
    if (res.ok) {
      const updated = await res.json()
      setComments(cs => cs.map(c => c.id === commentId ? { ...c, body: updated.body } : c))
      setEditingCommentId(null)
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!confirm('Remove this comment?')) return
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    if (res.ok) setComments(cs => cs.filter(c => c.id !== commentId))
  }

  async function handleCommentVote(commentId: number, dir: 'signal' | 'noise') {
    if (!user) { navigate('/login'); return }
    const current = commentVotes[commentId] ?? null
    const active = current === dir
    const method = active ? 'DELETE' : 'POST'
    const res = await fetch(`/api/comments/${commentId}/${dir}`, { method })
    if (!res.ok) return
    const data = await res.json()
    setCommentVotes(prev => ({ ...prev, [commentId]: data.vote }))
    setComments(cs => cs.map(c => c.id === commentId ? { ...c, upvote_count: data.upvote_count, noise_count: data.noise_count } : c))
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: '6px', boxSizing: 'border-box',
    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
    color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontFamily: 'var(--font-display)',
    color: 'var(--color-muted)', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em',
  }
  const smallBtnStyle: React.CSSProperties = {
    padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
    cursor: 'pointer', border: '1px solid var(--color-border)',
    background: 'transparent', color: 'var(--color-muted)',
  }

  const isGuideAuthor = !!(user && guide && guide.user_id === user.id)
  const isMod = !!(user && user.is_moderator)

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
        Loading...
      </div>
    )
  }
  if (!guide) return null

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
      <Link to="/compendium" style={{ fontSize: '13px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', display: 'inline-block', marginBottom: '24px' }}>
        &larr; Back to Compendium
      </Link>

      {/* Guide content */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: isMobile ? '20px' : '28px', marginBottom: '24px' }}>
        {editingGuide ? (
          <form onSubmit={handleSaveGuide} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} required style={inputStyle}>
                  {GUIDE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Region (optional)</label>
                <input value={editForm.region} onChange={e => setEditForm(f => ({ ...f, region: e.target.value }))} placeholder="e.g. Pacific Northwest" style={inputStyle} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Title</label>
              <input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Content</label>
              <textarea value={editForm.body} onChange={e => setEditForm(f => ({ ...f, body: e.target.value }))} required rows={10} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={editSaving} style={{
                padding: '8px 20px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                fontSize: '13px', fontWeight: 600, border: 'none',
                cursor: editSaving ? 'not-allowed' : 'pointer',
                background: 'var(--color-accent)', color: '#0A0A0A',
              }}>
                {editSaving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => { setEditingGuide(false); setEditForm({ title: guide.title, body: guide.body, category: guide.category, region: guide.region ?? '' }) }} style={smallBtnStyle}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '2px 7px',
                borderRadius: '3px', background: 'rgba(34,197,94,0.08)', color: 'var(--color-accent)',
                border: '1px solid rgba(34,197,94,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {guide.category}
              </span>
              {guide.region && (
                <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
                  {guide.region}
                </span>
              )}
              {(isGuideAuthor || isMod) && (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                  {isGuideAuthor && (
                    <button onClick={() => setEditingGuide(true)} style={smallBtnStyle}>
                      Edit
                    </button>
                  )}
                  <button onClick={handleDeleteGuide} style={{ ...smallBtnStyle, color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.3)' }}>
                    Delete
                  </button>
                </div>
              )}
            </div>

            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '20px', lineHeight: 1.3 }}>
              {guide.title}
            </h1>

            <div style={{ fontSize: '15px', color: 'var(--color-text)', lineHeight: 1.75, fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', marginBottom: '28px' }}>
              {guide.body}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '20px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              <button disabled={voting} onClick={() => handleVote('signal')} style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px',
                border: `1px solid ${myVote === 'signal' ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
                background: myVote === 'signal' ? 'rgba(34,197,94,0.12)' : 'transparent',
                color: myVote === 'signal' ? 'var(--color-accent)' : 'var(--color-subtle)',
                fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: voting ? 'not-allowed' : 'pointer',
              }}>
                Signal {signalCount > 0 && signalCount}
              </button>
              <button disabled={voting} onClick={() => handleVote('noise')} style={{
                display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '4px',
                border: `1px solid ${myVote === 'noise' ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                background: myVote === 'noise' ? 'rgba(239,68,68,0.1)' : 'transparent',
                color: myVote === 'noise' ? 'var(--color-danger)' : 'var(--color-subtle)',
                fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: voting ? 'not-allowed' : 'pointer',
              }}>
                Noise {noiseCount > 0 && noiseCount}
              </button>
              <span style={{ color: 'var(--color-border)' }}>|</span>
              <span style={{ color: 'var(--color-subtle)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                {guide.username ? (
                  <Link to={`/profile/${guide.username}`} style={{ color: 'var(--color-muted)', fontWeight: 500, textDecoration: 'none' }}>
                    {guide.username}
                  </Link>
                ) : <span style={{ color: 'var(--color-muted)' }}>anonymous</span>}
                {(() => { const t = getTier(guide.reputation ?? 0); return t ? (
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t.short}
                  </span>
                ) : null })()}
                {guide.is_founding_member && (
                  <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: '#A78BFA18', color: '#A78BFA', border: '1px solid #A78BFA40', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Founder
                  </span>
                )}
              </span>
              <span style={{ color: 'var(--color-subtle)' }}>{timeAgo(guide.created_at)}</span>
            </div>
          </>
        )}
      </div>

      {/* Comments */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>
          Comments ({comments.length})
        </div>

        {comments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
            {comments.map(c => {
              const isCommentAuthor = !!(user && c.user_id === user.id)
              const myCommentVote = commentVotes[c.id] ?? null
              return (
                <div key={c.id} style={{ background: 'var(--color-surface)', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {c.username ? (
                      <Link to={`/profile/${c.username}`} style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-text)', textDecoration: 'none' }}>
                        {c.username}
                      </Link>
                    ) : <span style={{ fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--color-muted)' }}>anonymous</span>}
                    {(() => { const t = getTier(c.reputation ?? 0); return t ? (
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {t.short}
                      </span>
                    ) : null })()}
                    {c.is_founding_member && (
                      <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: '#A78BFA18', color: '#A78BFA', border: '1px solid #A78BFA40', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Founder
                      </span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginLeft: 'auto' }}>
                      {timeAgo(c.created_at)}
                    </span>
                    {isCommentAuthor && editingCommentId !== c.id && (
                      <button onClick={() => { setEditingCommentId(c.id); setEditCommentBody(c.body) }} style={smallBtnStyle}>
                        Edit
                      </button>
                    )}
                    {(isCommentAuthor || isMod) && (
                      <button onClick={() => handleDeleteComment(c.id)} style={{ ...smallBtnStyle, color: 'var(--color-danger)', borderColor: 'rgba(239,68,68,0.3)' }}>
                        Remove
                      </button>
                    )}
                  </div>

                  {editingCommentId === c.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea
                        value={editCommentBody}
                        onChange={e => setEditCommentBody(e.target.value)}
                        rows={3}
                        style={{
                          width: '100%', padding: '10px 12px', borderRadius: '6px', boxSizing: 'border-box',
                          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                          color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
                          outline: 'none', resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => handleSaveComment(c.id)} style={{
                          padding: '5px 14px', borderRadius: '4px', fontFamily: 'var(--font-display)',
                          fontSize: '12px', fontWeight: 600, border: 'none',
                          cursor: 'pointer', background: 'var(--color-accent)', color: '#0A0A0A',
                        }}>
                          Save
                        </button>
                        <button onClick={() => setEditingCommentId(null)} style={smallBtnStyle}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.6, fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', marginBottom: '8px' }}>
                        {c.body}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => handleCommentVote(c.id, 'signal')} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                          border: `1px solid ${myCommentVote === 'signal' ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
                          background: myCommentVote === 'signal' ? 'rgba(34,197,94,0.12)' : 'transparent',
                          color: myCommentVote === 'signal' ? 'var(--color-accent)' : 'var(--color-subtle)',
                        }}>
                          Signal {c.upvote_count > 0 && c.upvote_count}
                        </button>
                        <button onClick={() => handleCommentVote(c.id, 'noise')} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
                          cursor: 'pointer',
                          border: `1px solid ${myCommentVote === 'noise' ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                          background: myCommentVote === 'noise' ? 'rgba(239,68,68,0.1)' : 'transparent',
                          color: myCommentVote === 'noise' ? 'var(--color-danger)' : 'var(--color-subtle)',
                        }}>
                          Noise {c.noise_count > 0 && c.noise_count}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {user ? (
          <form onSubmit={handleComment}>
            <textarea
              ref={textareaRef}
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              placeholder="Add a comment..."
              rows={3}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: '6px', boxSizing: 'border-box',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
                outline: 'none', resize: 'vertical', marginBottom: '10px',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={submitting || !commentBody.trim()} style={{
                padding: '8px 20px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                fontSize: '13px', fontWeight: 600, border: 'none',
                cursor: submitting || !commentBody.trim() ? 'not-allowed' : 'pointer',
                background: submitting || !commentBody.trim() ? 'var(--color-border)' : 'var(--color-accent)',
                color: submitting || !commentBody.trim() ? 'var(--color-muted)' : '#0A0A0A',
                transition: 'all 0.15s',
              }}>
                {submitting ? 'Posting...' : 'Post Comment'}
              </button>
            </div>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px' }}>
            <Link to="/login" style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-accent)', textDecoration: 'none' }}>
              Sign in to comment
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
