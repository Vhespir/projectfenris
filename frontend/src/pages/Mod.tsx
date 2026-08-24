import { Fragment, useEffect, useState } from 'react'
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
  is_banned: boolean
  banned_at: string | null
  banned_reason: string | null
  muted_until: string | null
}

interface ActivityItem {
  id: number
  title?: string
  body?: string
  post_type?: string
  is_removed?: boolean
  created_at: string
}

interface ModActivity {
  user: { id: number; username: string; email: string }
  posts: ActivityItem[]
  comments: ActivityItem[]
  guides: ActivityItem[]
  aars: ActivityItem[]
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

  const [selectedPosts, setSelectedPosts] = useState<Set<number>>(new Set())
  const [selectedComments, setSelectedComments] = useState<Set<number>>(new Set())
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set())

  const [activityUserId, setActivityUserId] = useState<number | null>(null)
  const [activity, setActivity] = useState<ModActivity | null>(null)
  const [activityLoading, setActivityLoading] = useState(false)

  useEffect(() => {
    if (!user) { navigate('/login'); return }
    if (!user.is_moderator) { navigate('/403'); return }
  }, [user])

  useEffect(() => {
    setSelectedPosts(new Set())
    setSelectedComments(new Set())
    setSelectedUsers(new Set())
    setActivityUserId(null)
    setActivity(null)
  }, [tab, status])

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

  function toggle(set: Set<number>, setFn: (s: Set<number>) => void, id: number) {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setFn(next)
  }

  function toggleAll(ids: number[], set: Set<number>, setFn: (s: Set<number>) => void) {
    setFn(set.size === ids.length ? new Set() : new Set(ids))
  }

  async function banUser(id: number) {
    const reason = window.prompt('Ban reason (optional, shown to no one but moderators):') ?? undefined
    const res = await fetch(`/api/mod/users/${id}/ban`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers(us => us.map(u => u.id === id ? { ...u, ...updated } : u))
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Ban failed' }))
      window.alert(error)
    }
  }

  async function unbanUser(id: number) {
    const res = await fetch(`/api/mod/users/${id}/unban`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await res.json()
      setUsers(us => us.map(u => u.id === id ? { ...u, ...updated, banned_at: null, banned_reason: null } : u))
    }
  }

  async function muteUser(id: number) {
    const input = window.prompt('Mute for how many hours? (e.g. 24)', '24')
    if (!input) return
    const hours = Number(input)
    if (!hours || hours <= 0) return window.alert('Enter a positive number of hours')
    const res = await fetch(`/api/mod/users/${id}/mute`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    })
    if (res.ok) {
      const updated = await res.json()
      setUsers(us => us.map(u => u.id === id ? { ...u, ...updated } : u))
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Mute failed' }))
      window.alert(error)
    }
  }

  async function unmuteUser(id: number) {
    const res = await fetch(`/api/mod/users/${id}/unmute`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await res.json()
      setUsers(us => us.map(u => u.id === id ? { ...u, ...updated } : u))
    }
  }

  async function deleteUser(id: number, username: string) {
    if (!window.confirm(
      `Permanently delete "${username}"? This cannot be undone. Their votes, messages, and ` +
      `notifications are deleted with them; their posts/comments/guides survive but show no author.`
    )) return
    const res = await fetch(`/api/mod/users/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setUsers(us => us.filter(u => u.id !== id))
      if (activityUserId === id) { setActivityUserId(null); setActivity(null) }
    } else {
      const { error } = await res.json().catch(() => ({ error: 'Delete failed' }))
      window.alert(error)
    }
  }

  async function viewActivity(id: number) {
    if (activityUserId === id) { setActivityUserId(null); setActivity(null); return }
    setActivityUserId(id)
    setActivityLoading(true)
    const res = await fetch(`/api/mod/users/${id}/activity`)
    if (res.ok) setActivity(await res.json())
    setActivityLoading(false)
  }

  async function bulkRemovePosts() {
    if (!selectedPosts.size) return
    if (!window.confirm(`Remove ${selectedPosts.size} post(s)?`)) return
    const ids = [...selectedPosts]
    await fetch('/api/mod/posts/bulk-remove', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    })
    setPosts(ps => ps.map(p => ids.includes(p.id) ? { ...p, is_removed: true } : p))
    setSelectedPosts(new Set())
  }

  async function bulkRemoveComments() {
    if (!selectedComments.size) return
    if (!window.confirm(`Remove ${selectedComments.size} comment(s)?`)) return
    const ids = [...selectedComments]
    await fetch('/api/mod/comments/bulk-remove', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
    })
    setComments(cs => cs.map(c => ids.includes(c.id) ? { ...c, is_removed: true } : c))
    setSelectedComments(new Set())
  }

  async function bulkBanUsers() {
    if (!selectedUsers.size) return
    const reason = window.prompt(`Ban reason for ${selectedUsers.size} account(s) (optional):`) ?? undefined
    const ids = [...selectedUsers]
    const res = await fetch('/api/mod/users/bulk-ban', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, reason }),
    })
    if (res.ok) {
      setUsers(us => us.map(u => ids.includes(u.id)
        ? { ...u, is_banned: true, banned_at: new Date().toISOString(), banned_reason: reason ?? null }
        : u
      ))
      setSelectedUsers(new Set())
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

  const bulkBar = {
    display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
    marginBottom: '12px', borderRadius: '6px', background: 'rgba(34,197,94,0.06)',
    border: '1px solid rgba(34,197,94,0.2)', fontSize: '12px', fontFamily: 'var(--font-mono)',
    color: 'var(--color-muted)',
  }

  const checkboxCell = { padding: '10px 12px', borderBottom: '1px solid var(--color-border)', width: '32px' }

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

      {tab === 'posts' && selectedPosts.size > 0 && (
        <div style={bulkBar}>
          <span>{selectedPosts.size} selected</span>
          <button style={actionBtn(true)} onClick={bulkRemovePosts}>Remove selected</button>
          <button style={{ ...actionBtn(false), marginLeft: 'auto' }} onClick={() => setSelectedPosts(new Set())}>Clear</button>
        </div>
      )}
      {tab === 'comments' && selectedComments.size > 0 && (
        <div style={bulkBar}>
          <span>{selectedComments.size} selected</span>
          <button style={actionBtn(true)} onClick={bulkRemoveComments}>Remove selected</button>
          <button style={{ ...actionBtn(false), marginLeft: 'auto' }} onClick={() => setSelectedComments(new Set())}>Clear</button>
        </div>
      )}
      {tab === 'users' && selectedUsers.size > 0 && (
        <div style={bulkBar}>
          <span>{selectedUsers.size} selected</span>
          <button style={actionBtn(true)} onClick={bulkBanUsers}>Ban selected</button>
          <button style={{ ...actionBtn(false), marginLeft: 'auto' }} onClick={() => setSelectedUsers(new Set())}>Clear</button>
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
                  <th style={headCell}>
                    <input
                      type="checkbox"
                      checked={posts.length > 0 && selectedPosts.size === posts.length}
                      onChange={() => toggleAll(posts.map(p => p.id), selectedPosts, setSelectedPosts)}
                    />
                  </th>
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
                  <tr><td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>No posts</td></tr>
                ) : posts.map(p => (
                  <tr key={p.id} style={{ opacity: p.is_removed ? 0.5 : 1 }}>
                    <td style={checkboxCell}>
                      <input
                        type="checkbox"
                        checked={selectedPosts.has(p.id)}
                        onChange={() => toggle(selectedPosts, setSelectedPosts, p.id)}
                      />
                    </td>
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
                  <th style={headCell}>
                    <input
                      type="checkbox"
                      checked={comments.length > 0 && selectedComments.size === comments.length}
                      onChange={() => toggleAll(comments.map(c => c.id), selectedComments, setSelectedComments)}
                    />
                  </th>
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
                  <tr><td colSpan={7} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>No comments</td></tr>
                ) : comments.map(c => {
                  const parentLink = c.post_id ? `/post/${c.post_id}` : c.guide_id ? `/compendium/${c.guide_id}` : null
                  const parentTitle = c.post_title ?? c.guide_title ?? 'Unknown'
                  return (
                    <tr key={c.id} style={{ opacity: c.is_removed ? 0.5 : 1 }}>
                      <td style={checkboxCell}>
                        <input
                          type="checkbox"
                          checked={selectedComments.has(c.id)}
                          onChange={() => toggle(selectedComments, setSelectedComments, c.id)}
                        />
                      </td>
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
                  <th style={headCell}>
                    <input
                      type="checkbox"
                      checked={users.length > 0 && selectedUsers.size === users.length}
                      onChange={() => toggleAll(users.map(u => u.id), selectedUsers, setSelectedUsers)}
                    />
                  </th>
                  <th style={headCell}>Username</th>
                  <th style={headCell}>Email</th>
                  <th style={headCell}>Region</th>
                  <th style={headCell}>Score</th>
                  <th style={headCell}>Joined</th>
                  <th style={headCell}>Trusted</th>
                  <th style={headCell}>Mod</th>
                  <th style={headCell}>Status</th>
                  <th style={headCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={10} style={{ ...cellStyle, textAlign: 'center', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>No users found</td></tr>
                ) : users.map(u => {
                  const isMuted = !!u.muted_until && new Date(u.muted_until) > new Date()
                  return (
                  <Fragment key={u.id}>
                    <tr style={{ opacity: u.is_banned ? 0.5 : 1 }}>
                      <td style={checkboxCell}>
                        {u.id !== user.id && (
                          <input
                            type="checkbox"
                            checked={selectedUsers.has(u.id)}
                            onChange={() => toggle(selectedUsers, setSelectedUsers, u.id)}
                          />
                        )}
                      </td>
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
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        {u.is_banned && (
                          <span title={u.banned_reason ?? undefined} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.25)', marginRight: '4px' }}>
                            banned
                          </span>
                        )}
                        {isMuted && (
                          <span title={`Muted until ${new Date(u.muted_until as string).toLocaleString()}`} style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: 'rgba(245,158,11,0.1)', color: 'var(--color-warning)', border: '1px solid rgba(245,158,11,0.25)' }}>
                            muted
                          </span>
                        )}
                      </td>
                      <td style={{ ...cellStyle, whiteSpace: 'nowrap' }}>
                        {u.id === user.id ? (
                          <span style={{ fontSize: '10px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>-</span>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <button style={actionBtn(false)} onClick={() => viewActivity(u.id)}>
                              {activityUserId === u.id ? 'Hide' : 'Activity'}
                            </button>
                            {u.is_banned ? (
                              <button style={actionBtn(false)} onClick={() => unbanUser(u.id)}>Unban</button>
                            ) : (
                              <button style={actionBtn(true)} onClick={() => banUser(u.id)}>Ban</button>
                            )}
                            {isMuted ? (
                              <button style={actionBtn(false)} onClick={() => unmuteUser(u.id)}>Unmute</button>
                            ) : (
                              <button style={actionBtn(false)} onClick={() => muteUser(u.id)}>Mute</button>
                            )}
                            <button style={actionBtn(true)} onClick={() => deleteUser(u.id, u.username)}>Delete</button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {activityUserId === u.id && (
                      <tr>
                        <td colSpan={10} style={{ ...cellStyle, background: 'var(--color-bg)' }}>
                          {activityLoading ? (
                            <span style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>Loading activity...</span>
                          ) : activity && activity.user.id === u.id ? (
                            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '16px' }}>
                              {([
                                ['Posts', activity.posts],
                                ['Comments', activity.comments],
                                ['Guides', activity.guides],
                                ['AARs', activity.aars],
                              ] as [string, ActivityItem[]][]).map(([label, items]) => (
                                <div key={label}>
                                  <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                                    {label} ({items.length})
                                  </div>
                                  {items.length === 0 ? (
                                    <div style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>none</div>
                                  ) : items.slice(0, 10).map(item => (
                                    <div key={item.id} style={{ fontSize: '11px', color: item.is_removed ? 'var(--color-danger)' : 'var(--color-muted)', marginBottom: '4px' }}>
                                      {(item.title ?? item.body ?? '').slice(0, 50)}
                                      <span style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}> &middot; {timeAgo(item.created_at)}</span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
