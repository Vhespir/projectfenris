import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface Post {
  id: number
  post_type: string
  category: string
  title: string
  body: string
  location_label: string | null
  latitude: number | null
  longitude: number | null
  upvote_count: number
  created_at: string
  updated_at: string
  username: string | null
  is_trusted: boolean
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

export default function PostPage() {
  const { id } = useParams()
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [upvoted, setUpvoted] = useState(false)
  const [upvoteCount, setUpvoteCount] = useState(0)
  const [upvoting, setUpvoting] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) { navigate('/community'); return }
        setPost(data)
        setUpvoteCount(data.upvote_count)
        setLoading(false)
      })
      .catch(() => { navigate('/community') })
  }, [id])

  async function handleUpvote() {
    if (!user) { navigate('/login'); return }
    if (upvoting) return
    setUpvoting(true)

    const method = upvoted ? 'DELETE' : 'POST'
    try {
      const res = await fetch(`/api/posts/${id}/upvote`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        setUpvoted(v => !v)
        setUpvoteCount(c => upvoted ? c - 1 : c + 1)
      }
    } finally {
      setUpvoting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
        Loading...
      </div>
    )
  }

  if (!post) return null

  const color = TYPE_COLOR[post.post_type] ?? 'var(--color-muted)'

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 20px' }}>
      <Link to="/community" style={{ fontSize: '13px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', display: 'inline-block', marginBottom: '24px' }}>
        &larr; Back to Community
      </Link>

      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '28px', borderLeft: `4px solid ${color}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '2px 7px',
            borderRadius: '3px', background: `${color}18`, color, border: `1px solid ${color}40`,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {TYPE_LABELS[post.post_type] ?? post.post_type}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>{post.category}</span>
          {post.location_label && (
            <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>{post.location_label}</span>
          )}
        </div>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, marginBottom: '16px', lineHeight: 1.3 }}>
          {post.title}
        </h1>

        <div style={{ fontSize: '15px', color: 'var(--color-text)', lineHeight: 1.7, fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap', marginBottom: '24px' }}>
          {post.body}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)', flexWrap: 'wrap' }}>
          <button onClick={handleUpvote} disabled={upvoting} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '7px 16px', borderRadius: '6px', cursor: upvoting ? 'not-allowed' : 'pointer',
            border: `1px solid ${upvoted ? 'var(--color-accent)' : 'var(--color-border)'}`,
            background: upvoted ? 'rgba(34,197,94,0.1)' : 'transparent',
            color: upvoted ? 'var(--color-accent)' : 'var(--color-muted)',
            fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
            transition: 'all 0.15s',
          }}>
            <span>▲</span>
            <span>{upvoteCount}</span>
          </button>

          <div style={{ fontSize: '13px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--color-muted)', fontWeight: 500 }}>{post.username ?? 'anonymous'}</span>
            {post.is_trusted && <span style={{ color: 'var(--color-accent)', marginLeft: '4px' }}>✓</span>}
            <span style={{ margin: '0 8px' }}>·</span>
            {timeAgo(post.created_at)}
          </div>
        </div>
      </div>
    </div>
  )
}
