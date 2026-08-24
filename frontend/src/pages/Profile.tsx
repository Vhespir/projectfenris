import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getTier } from '../utils/tier'

interface Guide {
  id: number
  title: string
  category: string
  signal_count: number
  noise_count: number
  created_at: string
}

interface ProfilePost {
  id: number
  post_type: string
  category: string
  title: string
  upvote_count: number
  created_at: string
}

interface Showcase {
  edc?: string
  bob?: string
  vehicle?: string
  food_water?: string
  power?: string
  comms?: string
  medical?: string
  skills?: string
}

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
  bio: string | null
  prep_level: string | null
  focus_areas: string[] | null
  years_prepping: number | null
  living_situation: string | null
  showcase: Showcase | null
  avatar_url: string | null
  is_founding_member?: boolean
  posts: ProfilePost[]
  guides: Guide[]
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
const PREP_LEVEL_COLOR: Record<string, string> = {
  beginner:     'var(--color-info)',
  intermediate: 'var(--color-warning)',
  advanced:     'var(--color-accent)',
  expert:       '#A78BFA',
}
const SHOWCASE_LABELS: Record<keyof Showcase, string> = {
  edc:        'Every Day Carry',
  bob:        'Bug Out Bag',
  vehicle:    'Vehicle Kit',
  food_water: 'Food and Water',
  power:      'Power and Energy',
  comms:      'Communications',
  medical:    'Medical Supplies',
  skills:     'Skills and Certifications',
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
  const { user: currentUser, login } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'posts' | 'field_reports' | 'guides'>('posts')
  const [avatarHover, setAvatarHover] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/users/me/avatar', { method: 'POST', body: form })
      if (res.ok) {
        const { avatar_url } = await res.json()
        setProfile(p => p ? { ...p, avatar_url } : p)
        if (currentUser) login({ ...currentUser, avatar_url })
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleAvatarRemove() {
    const res = await fetch('/api/users/me/avatar', { method: 'DELETE' })
    if (res.ok) {
      setProfile(p => p ? { ...p, avatar_url: null } : p)
      if (currentUser) login({ ...currentUser, avatar_url: null })
    }
  }

  if (loading) {
    return (
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '32px 20px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
        Loading...
      </div>
    )
  }
  if (!profile) return null

  const isOwn = currentUser?.username === profile.username
  const prepColor = profile.prep_level ? (PREP_LEVEL_COLOR[profile.prep_level] ?? 'var(--color-muted)') : null
  const tier = getTier(profile.reputation)
  const showcaseEntries = profile.showcase
    ? (Object.keys(SHOWCASE_LABELS) as (keyof Showcase)[]).filter(k => profile.showcase![k])
    : []

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '32px 20px' }}>

      {/* Header card */}
      <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '28px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '20px', flexWrap: 'wrap' }}>
          <div
            style={{ position: 'relative', width: '68px', height: '68px', flexShrink: 0, cursor: isOwn ? 'pointer' : 'default' }}
            onMouseEnter={() => isOwn && setAvatarHover(true)}
            onMouseLeave={() => setAvatarHover(false)}
            onClick={() => isOwn && fileInputRef.current?.click()}
          >
            <img
              src={profile.avatar_url || '/wolf-avatar.jpeg'}
              alt={profile.username}
              style={{
                width: '68px', height: '68px', borderRadius: '50%',
                border: '2px solid var(--color-border)', objectFit: 'cover',
                display: 'block',
              }}
            />
            {isOwn && (avatarHover || uploading) && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: '2px',
              }}>
                <span style={{ fontSize: '16px' }}>{uploading ? '...' : '+'}</span>
                <span style={{ fontSize: '9px', fontFamily: 'var(--font-mono)', color: '#fff', letterSpacing: '0.05em' }}>
                  {uploading ? 'uploading' : 'photo'}
                </span>
              </div>
            )}
            {isOwn && (
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: 'none' }}
                onChange={handleAvatarUpload}
              />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '22px', fontWeight: 700, margin: 0 }}>
                {profile.username}
              </h1>
              {tier && (
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '3px', background: `${tier.color}18`, color: tier.color, border: `1px solid ${tier.color}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {tier.title}
                </span>
              )}
              {profile.is_founding_member && (
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '3px', background: '#A78BFA18', color: '#A78BFA', border: '1px solid #A78BFA40', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Founding Member
                </span>
              )}
              {profile.is_moderator && (
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '3px', background: 'rgba(59,130,246,0.1)', color: 'var(--color-info)', border: '1px solid rgba(59,130,246,0.25)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Moderator
                </span>
              )}
              {prepColor && profile.prep_level && (
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 7px', borderRadius: '3px', background: `${prepColor}18`, color: prepColor, border: `1px solid ${prepColor}40`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {profile.prep_level}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
              <span><span style={{ color: 'var(--color-accent)', fontWeight: 700 }}>{profile.reputation}</span> Signal Score</span>
              <span>{profile.posts.length} posts</span>
              <span>{profile.guides.length} guides</span>
              {profile.years_prepping && <span>{profile.years_prepping}yr prepping</span>}
              {profile.living_situation && <span>{profile.living_situation}</span>}
              {(profile.region_state || profile.region_county) && (
                <span>{[profile.region_county, profile.region_state].filter(Boolean).join(', ')}</span>
              )}
              <span>Joined {joinDate(profile.created_at)}</span>
            </div>

            {isOwn && profile.is_founding_member && (
              <a
                href="https://discord.gg/T9PTacJzah"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px',
                  padding: '6px 12px', borderRadius: '6px', textDecoration: 'none',
                  background: '#5865F218', color: '#5865F2', border: '1px solid #5865F240',
                  fontFamily: 'var(--font-mono)', fontSize: '11px',
                }}
              >
                You're a Founding Member -- join the founding members Discord
              </a>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end', flexShrink: 0 }}>
            {isOwn ? (
              <>
                <Link to="/settings" style={{ fontSize: '12px', fontFamily: 'var(--font-display)', padding: '6px 14px', borderRadius: '6px', border: '1px solid var(--color-border)', color: 'var(--color-muted)', textDecoration: 'none' }}>
                  Edit Profile
                </Link>
                {profile.avatar_url && (
                  <button onClick={handleAvatarRemove} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', background: 'none', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', padding: '0 2px' }}>
                    Remove photo
                  </button>
                )}
              </>
            ) : currentUser && (
              <Link
                to={`/inbox/${profile.username}`}
                style={{
                  fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 600,
                  padding: '6px 14px', borderRadius: '6px',
                  border: '1px solid var(--color-border)', color: 'var(--color-muted)',
                  textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Message
              </Link>
            )}
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)', fontSize: '14px', color: 'var(--color-text)', lineHeight: 1.7, fontFamily: 'var(--font-body)' }}>
            {profile.bio}
          </div>
        )}

        {/* Focus areas */}
        {profile.focus_areas && profile.focus_areas.length > 0 && (
          <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Focus Areas
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.focus_areas.map(area => (
                <span key={area} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: 'var(--color-surface-elevated)', border: '1px solid var(--color-border)', color: 'var(--color-muted)', fontFamily: 'var(--font-mono)' }}>
                  {area}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Threat profile */}
        {profile.threat_profile?.length > 0 && (
          <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
              Threat Focus
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.threat_profile.map(t => (
                <span key={t} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '4px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', color: 'var(--color-danger)', fontFamily: 'var(--font-mono)' }}>
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Showcase */}
      {showcaseEntries.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            Showcase
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' }}>
            {showcaseEntries.map(key => (
              <div key={key} style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '14px 16px' }}>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--color-accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                  {SHOWCASE_LABELS[key]}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text)', lineHeight: 1.6, fontFamily: 'var(--font-body)', whiteSpace: 'pre-wrap' }}>
                  {profile.showcase![key]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity tabs */}
      <div>
        {(() => {
          const fieldReports = profile.posts.filter(p => p.post_type === 'field_report')
          const communityPosts = profile.posts.filter(p => p.post_type !== 'field_report')
          const TAB_DEFS = [
            { key: 'posts' as const, label: 'Posts', count: communityPosts.length },
            { key: 'field_reports' as const, label: 'Field Reports', count: fieldReports.length },
            { key: 'guides' as const, label: 'Guides', count: profile.guides.length },
          ]
          const activePosts = tab === 'field_reports' ? fieldReports : communityPosts
          return (
            <>
              <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '1px solid var(--color-border)' }}>
                {TAB_DEFS.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)} style={{
                    padding: '8px 20px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', border: 'none', background: 'transparent',
                    color: tab === t.key ? 'var(--color-text)' : 'var(--color-subtle)',
                    borderBottom: `2px solid ${tab === t.key ? 'var(--color-accent)' : 'transparent'}`,
                    marginBottom: '-1px', transition: 'color 0.15s',
                  }}>
                    {t.label} ({t.count})
                  </button>
                ))}
              </div>

              {(tab === 'posts' || tab === 'field_reports') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activePosts.length === 0
                    ? <div style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>None yet.</div>
                    : activePosts.map(p => {
                      const color = TYPE_COLOR[p.post_type] ?? 'var(--color-muted)'
                      return (
                        <Link key={p.id} to={`/post/${p.id}`} style={{ textDecoration: 'none' }}>
                          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'border-color 0.15s' }}
                            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                          >
                            <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: `${color}18`, color, border: `1px solid ${color}40`, textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                              {TYPE_LABEL[p.post_type] ?? p.post_type}
                            </span>
                            <span style={{ flex: 1, fontSize: '14px', color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {p.title}
                            </span>
                            <span style={{ fontSize: '12px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{p.upvote_count} ▲</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{timeAgo(p.created_at)}</span>
                          </div>
                        </Link>
                      )
                    })
                  }
                </div>
              )}
            </>
          )
        })()}

        {tab === 'guides' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {profile.guides.length === 0
              ? <div style={{ color: 'var(--color-muted)', fontFamily: 'var(--font-mono)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No guides yet.</div>
              : profile.guides.map(g => (
                <Link key={g.id} to={`/compendium/${g.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', transition: 'border-color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
                  >
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', padding: '2px 6px', borderRadius: '3px', background: 'rgba(34,197,94,0.08)', color: 'var(--color-accent)', border: '1px solid rgba(34,197,94,0.2)', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0 }}>
                      {g.category}
                    </span>
                    <span style={{ flex: 1, fontSize: '14px', color: 'var(--color-text)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {g.title}
                    </span>
                    {g.signal_count > 0 && (
                      <span style={{ fontSize: '11px', color: 'var(--color-accent)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{g.signal_count} signal</span>
                    )}
                    <span style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>{timeAgo(g.created_at)}</span>
                  </div>
                </Link>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}
