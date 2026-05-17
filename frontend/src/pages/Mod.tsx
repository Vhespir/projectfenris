import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'

type Tab = 'posts' | 'comments' | 'guides' | 'users'
type Status = 'all' | 'active' | 'removed'

interface ModPost {
  id: number
  post_type: string
  category: string
  title: string
  body: string
  upvote_count: number
  downvote_count: number
  is_removed: boolean
  created_at: string
  username: string | null
  user_id: number | null
}

interface ModComment {
  id: number
  body: string
  is_removed: boolean
  created_at: string
  username: string | null
  user_id: number | null
  post_id: number | null
  guide_id: number | null
  post_title: string | null
  guide_title: string | null
}

interface ModGuide {
  id: number
  title: string
  category: string
  region: string | null
  signal_count: number
  noise_count: number
  is_removed: boolean
  created_at: string
  username: string | null
  user_id: number | null
}

interface ModUser {
  id: number
  username: string
  email: string
  reputation: number
  is_trusted: boolean
  is_moderator: boolean
  created_at: string
  region_state: string | null
  region_county: string | null
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

const POST_TYPE_LABEL: Record<string, string> = {
  community: 'Community',
  field_report: 'Field',
  self_reported_news: 'News',
}

export default function Mod() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('posts')
  const [status, setStatus] = useState<Status>('all')
  const [userSearch, setUserSearch] = useState('')

  const [posts, setPosts] = useState<ModPost[]>([])
  const [comments, setComments] = useState<ModComment[]>([])
  const [guides, setGuides] = useState<ModGuide[]>([])
  const [users, setUsers] = useState<ModUser[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (!user.is_moderator) { navigate('/403'); return }
  }, [user])

  useEffect(() => {
    if (!user?.is_moderator) return
    setLoading(true)
    if (tab === 'posts') {
      fetch(`/api/mod/posts?status=${status}&limit=200`)
        .then(r => r.json()).then(d => { setPosts(Array.isArray(d) ? d : []); setLoading(false) })
        .catch(() => setLoading(false))
    } else if (tab === 'comments') {
      fetch(`/api/mod/comments?status=${status}&limit=200`)
        .then(r => r.json()).then(d => { setComments(Array.isArray(d) ? d : []); setLoading(false) })
        .catch(() => setLoading(false))
    } else if (tab === 'guides') {
      fetch(`/api/mod/guides?status=${status}&limit=200`)
        .then(r => r.json()).then(d => { setGuides(Array.isArray(d) ? d : []); setLoading(false) })
        .catch(() => setLoading(false))
    } else {
      fetch(`/api/mod/users?search=${encodeURIComponent(userSearch)}&limit=200`)
        .then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
        .catch(() => setLoading(false))
    }
  }, [tab, status, user?.is_moderator])

  function searchUsers() {
    setLoading(true)
    fetch(`/api/mod/users?search=${encodeURIComponent(userSearch)}&limit=200`)
      .then(r => r.json()).then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  async function removePost(id: number) {
    await fetch(`/api/mod/posts/${id}`, { method: 'DELETE' })
    setPosts(ps => ps.map(p => p.id === id ? { ...p, is_removed: true } : p))
  }

  async function restorePost(id: number) {
    await fetch(`/api/mod/posts/${id}/restore`, { method: 'PATCH' })
    setPosts(ps => ps.map(p => p.id === id ? { ...p, is_removed: false } : p))
  }

  async function removeComment(id: number) {
    await fetch(`/api/mod/comments/${id}`, { method: 'DELETE' })
    setComments(cs => cs.map(c => c.id === id ? { ...c, is_removed: true } : c))
  }

  async function restoreComment(id: number) {
    await fetch(`/api/mod/comments/${id}/restore`, { method: 'PATCH' })
    setComments(cs => cs.map(c => c.id === id ? { ...c, is_removed: false } : c))
  }

  async function removeGuide(id: number) {
    await fetch(`/api/mod/guides/${id}`, { method: 'DELETE' })
    setGuides(gs => gs.map(g => g.id === id ? { ...g, is_removed: true } : g))
  }

  async function restoreGuide(id: number) {
    await fetch(`/api/mod/guides/${id}/restore`, { method: 'PATCH' })
    setGuides(gs => gs.map(g => g.id === id ? { ...g, is_removed: false } : g))
  }

  async function toggleUserFlag(id: number, field: 'is_trusted' | 'is_moderator', current: boolean) {
    const res = await fetch(`/api/mod/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: !current }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers(us => us.map(u => u.id === id ? { ...u, ...updated } : u))
    }
  }

  if (!user?.is_moderator) return null

  const inputStyle = {
    padding: '6px 10px', borderRadius: '5px', fontSize: '12px',
    fontFamily: 'var(--font-mono)', background: 'var(--color-surface)',
    border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none',
  }

  const tabBtn = (t: Tab) => ({
    padding: '6px 16px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px',
    fontFamily: 'var(--font-display)', fontWeight: tab === t ? 600 : 400,
    background: tab === t ? 'rgba(34,197,94,0.1)' : 'transparent',
    color: tab === t ? 'var(--color-accent)' : 'var(--color-muted)',
    border: `1px solid ${tab === t ? 'rgba(34,197,94,0.3)' : 'transparent'}`,
  })

  const statusBtn = (s: Status) => ({
    padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    background: status === s ? 'var(--color-surface)' : 'transparent',
    color: status === s ? 'var(--color-text)' : 'var(--color-subtle)',
    border: `1px solid ${status === s ? 'var(--color-border)' : 'transparent'}`,
  })

  const actionBtn = (danger = false) => ({
    padding: '3px 10px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-mono)',
    cursor: 'pointer', border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
    background: danger ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)',
    color: danger ? 'var(--color-danger)' : 'var(--color-accent)',
  })

  const flagBtn = (active: boolean) => ({
    padding: '2px 8px', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-mono)',
    cursor: 'pointer', border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'var(--color-border)'}`,
    background: active ? 'rgba(34,197,94,0.08)' : 'transparent',
    color: active ? 'var(--color-accent)' : 'var(--color-subtle)',
  })

  const cellStyle = {
    padding: '10px 12px', borderBottom: '1px solid var(--color-border)',
    fontSize: '12px', color: 'var(--color-text)', verticalAlign: 'top' as const,
  }

  const headCell = {
    ...cellStyle,
    fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)',
    textTransform: 'uppercase' as const, letterSpacing: '0.06em', fontWeight: 600,
    background: 'var(--color-surface)',
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '20px 16px' : '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
          Mod Queue
        </h1>
        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 8px', borderRadius: '3px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Moderator
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
        <button style={tabBtn('posts')} onClick={() => setTab('posts')}>Posts</button>
        <button style={tabBtn('comments')} onClick={() => setTab('comments')}>Comments</button>
        <button style={tabBtn('guides')} onClick={() => setTab('guides')}>Guides</button>
        <button style={tabBtn('users')} onClick={() => setTab('users')}>Users</button>
      </div>

      {/* Status filter (posts, comments, guides) */}
      {tab !== 'users' && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
          <button style={statusBtn('all')} onClick={() => setStatus('all')}>All</button>
          <button style={statusBtn('active')} onClick={() => setStatus('active')}>Active</button>
          <button style={statusBtn('removed')} onClick={() => setStatus('removed')}>Removed</button>
        </div>
      )}

      {/* User search */}
      {tab === 'users' && (
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <input
            style={{ ...inputStyle, flex: 1, minWidth: 0 }}
            placeholder="Search username or email..."
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchUsers()}
          />
          <button
            onClick={searchUsers}
            style={{ ...actionBtn(false), padding: '6px 14px', fontSize: '12px' }}
          >
            Search
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '40px 0', textAlign: 'center' }}>
          Loading...
        </div>
      ) : (
        <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'auto' }}>

          {/* Posts table */}
          {tab === 'posts' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headCell}>Type</th>
                  <th style={headCell}>Title</th>
                  <th style={headCell}>Author</th>
                  <th style={headCell}>Age</th>
                  <th style={headCell}>Status</th>
                  <th style={headCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {posts.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>No posts</td></tr>
                ) : posts.map(p => (
                  <tr key={p.id} style={{ opacity: p.is_removed ? 0.5 : 1 }}>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-muted)' }}>
                        {POST_TYPE_LABEL[p.post_type] ?? p.post_type}
                      </span>
                    </td>
                    <td style={cellStyle}>
                      <Link to={`/post/${p.id}`} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                        {p.title.length > 60 ? p.title.slice(0, 60) + '...' : p.title}
                      </Link>
                      <div style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                        {p.category} &middot; {p.upvote_count}S / {p.downvote_count}N
                      </div>
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      {p.username ? (
                        <Link to={`/profile/${p.username}`} style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>
                          {p.username}
                        </Link>
                      ) : <span style={{ color: 'var(--color-subtle)' }}>deleted</span>}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
                      {timeAgo(p.created_at)}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: p.is_removed ? 'var(--color-danger)' : 'var(--color-accent)' }}>
                        {p.is_removed ? 'removed' : 'active'}
                      </span>
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      {p.is_removed ? (
                        <button style={actionBtn(false)} onClick={() => restorePost(p.id)}>Restore</button>
                      ) : (
                        <button style={actionBtn(true)} onClick={() => removePost(p.id)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Comments table */}
          {tab === 'comments' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headCell}>Author</th>
                  <th style={headCell}>Comment</th>
                  <th style={headCell}>On</th>
                  <th style={headCell}>Age</th>
                  <th style={headCell}>Status</th>
                  <th style={headCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {comments.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>No comments</td></tr>
                ) : comments.map(c => {
                  const parentLink = c.post_id ? `/post/${c.post_id}` : c.guide_id ? `/compendium/${c.guide_id}` : null
                  const parentTitle = c.post_title ?? c.guide_title ?? 'Unknown'
                  return (
                    <tr key={c.id} style={{ opacity: c.is_removed ? 0.5 : 1 }}>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        {c.username ? (
                          <Link to={`/profile/${c.username}`} style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>
                            {c.username}
                          </Link>
                        ) : <span style={{ color: 'var(--color-subtle)' }}>deleted</span>}
                      </td>
                      <td style={cellStyle}>
                        <span style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>
                          {c.body.length > 100 ? c.body.slice(0, 100) + '...' : c.body}
                        </span>
                      </td>
                      <td style={cellStyle}>
                        {parentLink ? (
                          <Link to={parentLink} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: '11px' }}>
                            {parentTitle.length > 40 ? parentTitle.slice(0, 40) + '...' : parentTitle}
                          </Link>
                        ) : <span style={{ color: 'var(--color-subtle)' }}>-</span>}
                      </td>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
                        {timeAgo(c.created_at)}
                      </td>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: c.is_removed ? 'var(--color-danger)' : 'var(--color-accent)' }}>
                          {c.is_removed ? 'removed' : 'active'}
                        </span>
                      </td>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        {c.is_removed ? (
                          <button style={actionBtn(false)} onClick={() => restoreComment(c.id)}>Restore</button>
                        ) : (
                          <button style={actionBtn(true)} onClick={() => removeComment(c.id)}>Remove</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* Guides table */}
          {tab === 'guides' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headCell}>Title</th>
                  <th style={headCell}>Category</th>
                  <th style={headCell}>Author</th>
                  <th style={headCell}>Score</th>
                  <th style={headCell}>Age</th>
                  <th style={headCell}>Status</th>
                  <th style={headCell}>Action</th>
                </tr>
              </thead>
              <tbody>
                {guides.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>No guides</td></tr>
                ) : guides.map(g => (
                  <tr key={g.id} style={{ opacity: g.is_removed ? 0.5 : 1 }}>
                    <td style={cellStyle}>
                      <Link to={`/compendium/${g.id}`} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                        {g.title.length > 60 ? g.title.slice(0, 60) + '...' : g.title}
                      </Link>
                      {g.region && (
                        <div style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{g.region}</div>
                      )}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: 'var(--color-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                      {g.category}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      {g.username ? (
                        <Link to={`/profile/${g.username}`} style={{ color: 'var(--color-muted)', textDecoration: 'none' }}>
                          {g.username}
                        </Link>
                      ) : <span style={{ color: 'var(--color-subtle)' }}>deleted</span>}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      <span style={{ color: 'var(--color-accent)' }}>{g.signal_count}S</span>
                      {' / '}
                      <span style={{ color: 'var(--color-danger)' }}>{g.noise_count}N</span>
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
                      {timeAgo(g.created_at)}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: g.is_removed ? 'var(--color-danger)' : 'var(--color-accent)' }}>
                        {g.is_removed ? 'removed' : 'active'}
                      </span>
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                      {g.is_removed ? (
                        <button style={actionBtn(false)} onClick={() => restoreGuide(g.id)}>Restore</button>
                      ) : (
                        <button style={actionBtn(true)} onClick={() => removeGuide(g.id)}>Remove</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Users table */}
          {tab === 'users' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headCell}>Username</th>
                  <th style={headCell}>Email</th>
                  <th style={headCell}>Region</th>
                  <th style={headCell}>Score</th>
                  <th style={headCell}>Joined</th>
                  <th style={headCell}>Trusted</th>
                  <th style={headCell}>Mod</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>No users found</td></tr>
                ) : users.map(u => (
                  <tr key={u.id}>
                    <td style={cellStyle}>
                      <Link to={`/profile/${u.username}`} style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 500 }}>
                        {u.username}
                      </Link>
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {u.email}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--color-subtle)', fontSize: '11px' }}>
                      {[u.region_county, u.region_state].filter(Boolean).join(', ') || '-'}
                    </td>
                    <td style={{ ...cellStyle, fontFamily: 'var(--font-mono)', color: 'var(--color-muted)' }}>
                      {u.reputation}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: 'nowrap', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                      {timeAgo(u.created_at)}
                    </td>
                    <td style={cellStyle}>
                      {u.id !== user.id ? (
                        <button style={flagBtn(u.is_trusted)} onClick={() => toggleUserFlag(u.id, 'is_trusted', u.is_trusted)}>
                          {u.is_trusted ? 'Yes' : 'No'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>{u.is_trusted ? 'Yes' : 'No'}</span>
                      )}
                    </td>
                    <td style={cellStyle}>
                      {u.id !== user.id ? (
                        <button style={flagBtn(u.is_moderator)} onClick={() => toggleUserFlag(u.id, 'is_moderator', u.is_moderator)}>
                          {u.is_moderator ? 'Yes' : 'No'}
                        </button>
                      ) : (
                        <span style={{ fontSize: '10px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>You</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
