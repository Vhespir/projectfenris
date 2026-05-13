import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface UserProfile {
  id: number
  username: string
  reputation: number
  is_trusted: boolean
  is_moderator: boolean
  region_state: string | null
  region_county: string | null
  threat_profile: string[]
  created_at: string
  posts: ProfilePost[]
}

interface ProfilePost {
  id: number
  post_type: string
  category: string
  title: string
  upvote_count: number
  created_at: string
}

const TYPE_COLOR: Record<string, string> = {
  community: 'var(--color-info)',
  field_report: 'var(--color-warning)',
  self_reported_news: 'var(--color-accent)',
}

const TYPE_LABEL: Record<string, string> = {
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
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

function joinDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function Profile() {
  const { username } = useParams()
  const { user: currentUser } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) navigate('/community')
        else setProfile(data)
        setLoading(false)
      })
      .catch(() => { setLoading(false); navigate('/community') })
  }, [username])

  if (loading) {
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 20px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
        Loading...
      </div>
    )
  }

  if (!profile) return null

  const isOwn = currentUser?.username === profile.username

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', padding: '32px 20px' }}>
      <div style={{
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: '8px', padding: '28px', marginBottom: '20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '50%', flexShrink: 0,
            background: 'var(--color-surface-elevated)', border: '2px solid var(--color-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700,
            color: 'var(--color-accent)',
          }}>
            {profile.username[0].toUpperCase()}
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, margin: 0 }}>
                {profile.username}
              </h1>
              {profile.is_trusted && (
                <span style={{
                  fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '2px 8px',
                  borderRadius: '3px', background: 'rgba(34,197,94,0.1)',
                  color: 'var(--color-accent)', border: '1px solid rgba(34,197,94,0.25)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Trusted Contributor
                </span>
              )}
              {profile.is_moderator && (
                <span style={{
                  fontSize: '11px', fontFamily: 'var(--font-mono)', padding: '2px 8px',
                  borderRadius: '3px', background: 'rgba(59,130,246,0.1)',
                  color: 'var(--color-info)', border: '1px solid rgba(59,130,246,0.25)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>
                  Moderator
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              <span>
                <span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{profile.reputation}</span> rep
              </span>
              <span>{profile.posts.length} posts</span>
              {(profile.region_state || profile.region_county) && (
                <span>
                  {[profile.region_county, profile.region_state].filter(Boolean).join(', ')}
                </span>
              )}
              <span>Joined {joinDate(profile.created_at)}</span>
            </div>
          </div>

          {isOwn && (
            <Link to="/settings" style={{
              fontSize: '12px', fontFamily: 'var(--font-display)', padding: '6px 14px',
              borderRadius: '6px', border: '1px solid var(--color-border)',
              color: 'var(--color-muted)', textDecoration: 'none',
            }}>
              Edit Profile
            </Link>
          )}
        </div>

        {profile.threat_profile?.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '11px', fontFamily: 'var(--font-display)', color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px' }}>
              Threat Focus
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.threat_profile.map((t: string) => (
                <span key={t} style={{
                  fontSize: '12px', padding: '3px 10px', borderRadius: '4px',
                  background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)',
                  color: 'var(--color-muted)', fontFamily: 'var(--font-mono)',
                }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {profile.posts.length > 0 && (
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Recent Posts
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profile.posts.map(p => {
              const color = TYPE_COLOR[p.post_type] ?? 'var(--color-muted)'
              return (
                <Link key={p.id} to={`/post/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                    borderRadius: '6px', padding: '12px 16px',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    transition: 'border-color 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    <span style={{
                      fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px',
                      borderRadius: '3px', background: `${color}18`, color,
                      border: `1px solid ${color}40`, textTransform: 'uppercase',
                      letterSpacing: '0.05em', flexShrink: 0,
                    }}>
                      {TYPE_LABEL[p.post_type] ?? p.post_type}
                    </span>
                    <span style={{ flex: 1, fontSize: '14px', color: 'var(--color-text)', fontWeight: 500 }}>
                      {p.title}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {p.upvote_count} ▲
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                      {timeAgo(p.created_at)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {profile.posts.length === 0 && (
        <div style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
          No posts yet.
        </div>
      )}
    </div>
  )
}
