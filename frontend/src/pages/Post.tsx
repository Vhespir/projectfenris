import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTier } from '../utils/tier'
import { PostBody } from '../components/PostBody'
import { MentionTextarea } from '../components/MentionTextarea'

interface Post {
  id: number
  post_type: string
  category: string
  title: string
  body: string
  location_label: string | null
  latitude: number | null
  longitude: number | null
  incident_type?: string | null
  state?: string | null
  duration?: string | null
  what_worked?: string[]
  what_failed?: string[]
  wish_had?: string[]
  key_takeaway?: string | null
  upvote_count: number
  downvote_count: number
  created_at: string
  updated_at: string
  user_id: number | null
  username: string | null
  reputation: number
  is_founding_member?: boolean
}

interface Comment {
  id: number
  user_id: number | null
  body: string
  created_at: string
  username: string | null
  reputation: number
  is_founding_member?: boolean
  upvote_count: number
  noise_count: number
}

const TYPE_COLOR: Record<string, string> = {
  community: 'var(--color-info)',
  field_report: 'var(--color-warning)',
  self_reported_news: 'var(--color-accent)',
}
const TYPE_LABELS: Record<string, string> = {
  community: 'Community',
  field_report: 'Field Report',
  self_reported_news: 'News Report',
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: '6px', boxSizing: 'border-box',
  background: 'var(--color-surface)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)',
  outline: 'none', resize: 'vertical',
}

export default function PostPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [myVote, setMyVote] = useState<'up' | 'down' | null>(null)
  const [upvoteCount, setUpvoteCount] = useState(0)
  const [downvoteCount, setDownvoteCount] = useState(0)
  const [voting, setVoting] = useState(false)

  const [editingPost, setEditingPost] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [savingPost, setSavingPost] = useState(false)

  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editCommentBody, setEditCommentBody] = useState('')
  const [commentVotes, setCommentVotes] = useState<Record<number, 'signal' | 'noise' | null>>({})
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { navigate('/community'); return }
        setPost(data)
        setUpvoteCount(data.upvote_count)
        setDownvoteCount(data.downvote_count ?? 0)
        setLoading(false)
      })
      .catch(() => navigate('/community'))
  }, [id])

  useEffect(() => {
    if (!id || !user) return
    fetch(`/api/posts/${id}/myvote`)
      .then(r => r.ok ? r.json() : null)
      .then(data => data && setMyVote(data.vote))
      .catch(() => {})
  }, [id, user])

  useEffect(() => {
    if (!id) return
    fetch(`/api/posts/${id}/comments`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setComments(data))
      .catch(() => {})
  }, [id])

  async function handleVote(dir: 'up' | 'down') {
    if (!user) { navigate('/login'); return }
    if (voting) return
    setVoting(true)
    try {
      const res = await fetch(`/api/posts/${id}/${dir === 'up' ? 'upvote' : 'downvote'}`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setMyVote(data.vote)
        setUpvoteCount(data.upvote_count)
        setDownvoteCount(data.downvote_count)
      }
    } finally {
      setVoting(false)
    }
  }

  async function handleSavePost(e: React.FormEvent) {
    e.preventDefault()
    if (savingPost) return
    setSavingPost(true)
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, body: editBody }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPost(p => p ? { ...p, title: updated.title, body: updated.body } : p)
        setEditingPost(false)
      }
    } finally {
      setSavingPost(false)
    }
  }

  async function handleRemovePost() {
    if (!confirm('Remove this post?')) return
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' })
    if (res.ok) navigate('/community')
  }

  async function handleRemoveComment(commentId: number) {
    if (!confirm('Remove this comment?')) return
    const res = await fetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    if (res.ok) setComments(cs => cs.filter(c => c.id !== commentId))
  }

  async function handleSaveComment(commentId: number) {
    if (!editCommentBody.trim()) return
    const res = await fetch(`/api/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editCommentBody.trim() }),
    })
    if (res.ok) {
      setComments(cs => cs.map(c => c.id === commentId ? { ...c, body: editCommentBody.trim() } : c))
      setEditingCommentId(null)
    }
  }

  async function handleCommentVote(commentId: number, dir: 'signal' | 'noise') {
    if (!user) { navigate('/login'); return }
    const current = commentVotes[commentId] ?? null
    const active = current === dir
    const method = active ? 'DELETE' : 'POST'
    const res = await fetch(`/api/comments/${commentId}/${dir}`, { method })
    if (res.ok) {
      const data = await res.json()
      setCommentVotes(m => ({ ...m, [commentId]: data.vote }))
      setComments(cs => cs.map(c => c.id === commentId ? { ...c, upvote_count: data.upvote_count, noise_count: data.noise_count } : c))
    }
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/posts/${id}/comments`, {
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

  if (loading) return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
      Loading...
    </div>
  )
  if (!post) return null

  const color = TYPE_COLOR[post.post_type] ?? 'var(--color-muted)'
  const isAuthor = user && post.user_id === user.id

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
      <Link to="/community" style={{ fontSize: '13px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', display: 'inline-block', marginBottom: '24px' }}>
        &larr; Back to Community
      </Link>

      {/* Post */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '28px', borderLeft: `4px solid ${color}`, marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '3px', background: `${color}18`, color, border: `1px solid ${color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {TYPE_LABELS[post.post_type] ?? post.post_type}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{post.category}</span>
          {post.location_label && (
            <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{post.location_label}</span>
          )}
        </div>

        {editingPost ? (
          <form onSubmit={handleSavePost} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            <input
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ ...textareaStyle, resize: 'none', fontSize: '18px', fontFamily: 'var(--font-display)', fontWeight: 700 }}
              required
            />
            <MentionTextarea
              value={editBody}
              onChange={setEditBody}
              rows={8}
              style={{ ...textareaStyle, resize: 'vertical', width: '100%' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" disabled={savingPost} style={{ padding: '7px 16px', borderRadius: '6px', border: 'none', cursor: savingPost ? 'not-allowed' : 'pointer', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600 }}>
                {savingPost ? 'Saving...' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditingPost(false)} style={{ padding: '7px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', cursor: 'pointer', background: 'transparent', color: 'var(--color-muted)', fontFamily: 'var(--font-display)', fontSize: '13px' }}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.3 }}>
              {post.title}
            </h1>
            <div style={{ marginBottom: '24px' }}>
              <PostBody text={post.body} />
            </div>

            {post.post_type === 'aar' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
                {(post.state || post.duration) && (
                  <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)' }}>
                    {[post.state, post.duration].filter(Boolean).join(' · ')}
                  </div>
                )}
                {post.key_takeaway && (
                  <div style={{ padding: '12px 16px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
                    <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#3B82F6', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Key Takeaway</div>
                    <div style={{ fontSize: '14px', color: 'var(--color-text)' }}>{post.key_takeaway}</div>
                  </div>
                )}
                {([
                  ['What Worked', post.what_worked, '#22C55E'],
                  ['What Failed', post.what_failed, '#EF4444'],
                  ['What They Wish They Had', post.wish_had, '#F59E0B'],
                ] as [string, string[] | undefined, string][]).map(([label, items, itemColor]) => (
                  items && items.length > 0 ? (
                    <div key={label}>
                      <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: itemColor, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
                      <ul style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {items.map((item, i) => <li key={i} style={{ fontSize: '13px', color: 'var(--color-muted)' }}>{item}</li>)}
                      </ul>
                    </div>
                  ) : null
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <button onClick={() => handleVote('up')} disabled={voting} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '6px', cursor: voting ? 'not-allowed' : 'pointer',
            border: `1px solid ${myVote === 'up' ? 'rgba(34,197,94,0.6)' : 'var(--color-border)'}`,
            background: myVote === 'up' ? 'rgba(34,197,94,0.12)' : 'transparent',
            color: myVote === 'up' ? 'var(--color-accent)' : 'var(--color-muted)',
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
          }}>
            Signal{upvoteCount > 0 ? ` ${upvoteCount}` : ''}
          </button>

          <button onClick={() => handleVote('down')} disabled={voting} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 14px', borderRadius: '6px', cursor: voting ? 'not-allowed' : 'pointer',
            border: `1px solid ${myVote === 'down' ? 'rgba(239,68,68,0.5)' : 'var(--color-border)'}`,
            background: myVote === 'down' ? 'rgba(239,68,68,0.1)' : 'transparent',
            color: myVote === 'down' ? 'var(--color-danger)' : 'var(--color-muted)',
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
          }}>
            Noise{downvoteCount > 0 ? ` ${downvoteCount}` : ''}
          </button>

          <div style={{ fontSize: '13px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginLeft: '8px', display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
            {post.username ? (
              <Link to={`/profile/${post.username}`} style={{ color: 'var(--color-muted)', fontWeight: 500 }}>
                {post.username}
              </Link>
            ) : <span style={{ color: 'var(--color-muted)' }}>anonymous</span>}
            {(() => { const t = getTier(post.reputation ?? 0); return t ? (
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t.short}
              </span>
            ) : null })()}
            {post.is_founding_member && (
              <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', padding: '1px 5px', borderRadius: '3px', background: '#A78BFA18', color: '#A78BFA', border: '1px solid #A78BFA40', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Founder
              </span>
            )}
            <span style={{ margin: '0 4px' }}>·</span>
            {timeAgo(post.created_at)}
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
              {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
            </span>
            {isAuthor && !editingPost && (
              <button onClick={() => { setEditTitle(post.title); setEditBody(post.body); setEditingPost(true) }} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'none', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-muted)', cursor: 'pointer', padding: '2px 8px' }}>
                Edit
              </button>
            )}
            {(isAuthor || user?.is_moderator) && (
              <button onClick={handleRemovePost} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px 8px' }}>
                Delete
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Comments */}
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '14px' }}>
          Comments ({comments.length})
        </div>

        {comments.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '16px' }}>
            {comments.map(c => {
              const isMyComment = user && c.user_id === user.id
              const myCommentVote = commentVotes[c.id] ?? null
              return (
                <div key={c.id} style={{ background: 'var(--color-surface)', padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
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
                    {isMyComment && editingCommentId !== c.id && (
                      <button onClick={() => { setEditingCommentId(c.id); setEditCommentBody(c.body) }} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'none', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', padding: '0 2px' }}>
                        edit
                      </button>
                    )}
                    {(isMyComment || user?.is_moderator) && (
                      <button onClick={() => handleRemoveComment(c.id)} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0 2px', opacity: 0.6 }}>
                        remove
                      </button>
                    )}
                  </div>

                  {editingCommentId === c.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <textarea
                        value={editCommentBody}
                        onChange={e => setEditCommentBody(e.target.value)}
                        rows={3}
                        style={{ ...textareaStyle, resize: 'vertical' }}
                        autoFocus
                      />
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => handleSaveComment(c.id)} style={{ padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600 }}>
                          Save
                        </button>
                        <button onClick={() => setEditingCommentId(null)} style={{ padding: '4px 12px', borderRadius: '4px', border: '1px solid var(--color-border)', cursor: 'pointer', background: 'transparent', color: 'var(--color-muted)', fontFamily: 'var(--font-display)', fontSize: '12px' }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.6, fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap' }}>
                        {c.body}
                      </div>
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button onClick={() => handleCommentVote(c.id, 'signal')} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
                          border: `1px solid ${myCommentVote === 'signal' ? 'rgba(34,197,94,0.4)' : 'transparent'}`,
                          background: myCommentVote === 'signal' ? 'rgba(34,197,94,0.12)' : 'transparent',
                          color: myCommentVote === 'signal' ? 'var(--color-accent)' : 'var(--color-subtle)',
                          fontFamily: 'var(--font-mono)', fontSize: '11px',
                        }}>
                          Signal {c.upvote_count > 0 && c.upvote_count}
                        </button>
                        <button onClick={() => handleCommentVote(c.id, 'noise')} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          padding: '2px 8px', borderRadius: '4px', cursor: 'pointer',
                          border: `1px solid ${myCommentVote === 'noise' ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
                          background: myCommentVote === 'noise' ? 'rgba(239,68,68,0.1)' : 'transparent',
                          color: myCommentVote === 'noise' ? 'var(--color-danger)' : 'var(--color-subtle)',
                          fontFamily: 'var(--font-mono)', fontSize: '11px',
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
              style={{ ...textareaStyle, marginBottom: '10px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={submitting || !commentBody.trim()} style={{
                padding: '8px 20px', borderRadius: '6px', fontFamily: 'var(--font-display)',
                fontSize: '13px', fontWeight: 600, border: 'none', cursor: submitting || !commentBody.trim() ? 'not-allowed' : 'pointer',
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
