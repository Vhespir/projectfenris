import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'
import { useSocket } from '../context/SocketContext'

interface Notification {
  id: number
  type: string
  message: string
  link: string | null
  is_read: boolean
  created_at: string
}

const navLinks = [
  { href: '/feed',       label: 'Feed' },
  { href: '/map',        label: 'Map' },
  { href: '/community',  label: 'Community' },
  { href: '/compendium', label: 'Compendium' },
  { href: '/tools',      label: 'Tools' },
]

const WolfIcon = () => (
  <img src="/logo.png" alt="Project Fenris" width={32} height={32} style={{ display: 'block', objectFit: 'contain' }} />
)

const Hamburger = ({ open }: { open: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ display: 'block' }}>
    {open ? (
      <>
        <line x1="4" y1="4" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        <line x1="18" y1="4" x2="4" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </>
    ) : (
      <>
        <rect x="3" y="5"  width="16" height="2" rx="1" fill="currentColor"/>
        <rect x="3" y="10" width="16" height="2" rx="1" fill="currentColor"/>
        <rect x="3" y="15" width="16" height="2" rx="1" fill="currentColor"/>
      </>
    )}
  </svg>
)

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const BellIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

const InboxIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Navbar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const isMobile = useIsMobile()
  const socket = useSocket()
  const [menuOpen, setMenuOpen] = useState(false)
  const [bellOpen, setBellOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const bellRef = useRef<HTMLDivElement>(null)

  const fetchCount = useCallback(async () => {
    if (!user) return
    try {
      const r = await fetch('/api/notifications/count')
      if (r.ok) {
        const d = await r.json()
        setUnreadCount(d.count ?? 0)
      }
    } catch {}
  }, [user])

  const fetchMsgCount = useCallback(async () => {
    if (!user) return
    try {
      const r = await fetch('/api/messages/unread-count')
      if (r.ok) {
        const d = await r.json()
        setUnreadMessages(d.count ?? 0)
      }
    } catch {}
  }, [user])

  useEffect(() => {
    fetchCount()
    fetchMsgCount()
  }, [fetchCount, fetchMsgCount])

  useEffect(() => {
    if (!socket) return
    const notifHandler = () => setUnreadCount(c => c + 1)
    const msgHandler = () => setUnreadMessages(c => c + 1)
    socket.on('notification', notifHandler)
    socket.on('new_message', msgHandler)
    return () => {
      socket.off('notification', notifHandler)
      socket.off('new_message', msgHandler)
    }
  }, [socket])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false)
      }
    }
    if (bellOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [bellOpen])

  async function openBell() {
    if (bellOpen) { setBellOpen(false); return }
    setBellOpen(true)
    try {
      const r = await fetch('/api/notifications')
      if (r.ok) setNotifications(await r.json())
    } catch {}
  }

  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' })
    setNotifications(ns => ns.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function handleNotificationClick(n: Notification) {
    setBellOpen(false)
    if (!n.is_read) {
      await fetch(`/api/notifications/${n.id}/read`, { method: 'PATCH' })
      setNotifications(ns => ns.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      setUnreadCount(c => Math.max(0, c - 1))
    }
    if (n.link) navigate(n.link)
  }

  function handleLogout() {
    logout()
    navigate('/')
    setMenuOpen(false)
  }

  const isActive = (href: string) => location.pathname === href

  const BellButton = () => (
    <div ref={bellRef} style={{ position: 'relative' }}>
      <button
        onClick={openBell}
        style={{
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '36px', height: '36px', borderRadius: '6px', cursor: 'pointer',
          background: bellOpen ? 'var(--color-surface)' : 'transparent',
          border: `1px solid ${bellOpen ? 'var(--color-border)' : 'transparent'}`,
          color: 'var(--color-muted)', transition: 'all 0.15s',
        }}
        aria-label="Notifications"
      >
        <BellIcon />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '4px', right: '4px',
            width: '14px', height: '14px', borderRadius: '50%',
            background: 'var(--color-danger)', color: '#fff',
            fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1,
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {bellOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: '320px', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', borderRadius: '8px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 200,
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid var(--color-border)',
          }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-accent)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                }}
              >
                Mark all read
              </button>
            )}
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: '32px 16px', textAlign: 'center',
                color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '12px',
              }}>
                No notifications
              </div>
            ) : (
              notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 16px',
                    background: n.is_read ? 'transparent' : 'rgba(34,197,94,0.04)',
                    borderLeft: `3px solid ${n.is_read ? 'transparent' : 'var(--color-accent)'}`,
                    border: 'none', borderBottom: '1px solid var(--color-border)',
                    cursor: n.link ? 'pointer' : 'default',
                    display: 'block',
                  }}
                >
                  <div style={{
                    fontSize: '13px', fontFamily: 'var(--font-body)',
                    color: n.is_read ? 'var(--color-muted)' : 'var(--color-text)',
                    lineHeight: 1.4, marginBottom: '4px',
                  }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
                    {timeAgo(n.created_at)}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(10,10,10,0.92)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{
        maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '0 16px' : '0 24px',
        height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative',
      }}>
        {/* Logo */}
        <Link to="/" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          <WolfIcon />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '15px', letterSpacing: '0.08em', color: 'var(--color-text)' }}>
            PROJECT <span style={{ color: 'var(--color-accent)' }}>FENRIS</span>
          </span>
        </Link>

        {isMobile ? (
          /* Mobile: hamburger */
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {user && (
              <Link
                to="/inbox"
                aria-label="Inbox"
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '6px',
                  color: 'var(--color-muted)', border: '1px solid transparent',
                }}
              >
                <InboxIcon />
                {unreadMessages > 0 && (
                  <span style={{
                    position: 'absolute', top: '4px', right: '4px',
                    width: '14px', height: '14px', borderRadius: '50%',
                    background: 'var(--color-accent)', color: '#0A0A0A',
                    fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>
            )}
            {user && <BellButton />}
            <button
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              style={{
                color: 'var(--color-muted)', background: 'transparent', border: 'none',
                padding: '8px', borderRadius: '6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Hamburger open={menuOpen} />
            </button>
          </div>
        ) : (
          /* Desktop: inline links */
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              {navLinks.map(link => (
                <Link key={link.href} to={link.href} style={{
                  fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500,
                  letterSpacing: '0.02em', padding: '6px 12px', borderRadius: '6px',
                  color: isActive(link.href) ? 'var(--color-text)' : 'var(--color-muted)',
                  background: isActive(link.href) ? 'var(--color-surface)' : 'transparent',
                  transition: 'color 0.15s, background 0.15s',
                }}>
                  {link.label}
                </Link>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link
                to="/search"
                aria-label="Search"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '36px', height: '36px', borderRadius: '6px',
                  color: 'var(--color-muted)', border: '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <SearchIcon />
              </Link>
              {user ? (
                <>
                  {user.is_moderator && (
                    <Link
                      to="/mod"
                      aria-label="Mod queue"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: '4px 10px', height: '36px', borderRadius: '6px',
                        fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
                        color: 'var(--color-danger)', border: '1px solid rgba(239,68,68,0.3)',
                        background: 'rgba(239,68,68,0.06)', letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      Mod
                    </Link>
                  )}
                  <Link
                    to="/inbox"
                    aria-label="Inbox"
                    style={{
                      position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: '36px', height: '36px', borderRadius: '6px',
                      color: 'var(--color-muted)', border: '1px solid transparent', transition: 'all 0.15s',
                    }}
                  >
                    <InboxIcon />
                    {unreadMessages > 0 && (
                      <span style={{
                        position: 'absolute', top: '4px', right: '4px',
                        width: '14px', height: '14px', borderRadius: '50%',
                        background: 'var(--color-accent)', color: '#0A0A0A',
                        fontSize: '9px', fontFamily: 'var(--font-mono)', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                      }}>
                        {unreadMessages > 9 ? '9+' : unreadMessages}
                      </span>
                    )}
                  </Link>
                  <BellButton />
                  <Link to={`/profile/${user.username}`} style={{ display: 'flex', alignItems: 'center', gap: '7px', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500, color: 'var(--color-muted)', padding: '4px 10px', borderRadius: '6px', textDecoration: 'none' }}>
                    <img
                      src={user.avatar_url || '/wolf-avatar.jpeg'}
                      alt={user.username}
                      style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)', flexShrink: 0 }}
                    />
                    {user.username}
                  </Link>
                  <button onClick={handleLogout} style={{
                    fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500,
                    color: 'var(--color-muted)', padding: '6px 14px',
                    border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer',
                    background: 'transparent',
                  }}>
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 500, color: 'var(--color-muted)', padding: '6px 12px' }}>
                    Sign In
                  </Link>
                  <Link to="/register" style={{
                    fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
                    letterSpacing: '0.02em', color: '#0A0A0A', background: 'var(--color-accent)',
                    padding: '7px 16px', borderRadius: '6px',
                  }}>
                    Join
                  </Link>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Mobile dropdown menu */}
      {isMobile && menuOpen && (
        <div className="nav-mobile-menu">
          {navLinks.map(link => (
            <Link
              key={link.href}
              to={link.href}
              className={`nav-mobile-link${isActive(link.href) ? ' active' : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          <Link to="/search" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>
            Search
          </Link>

          {user && (
            <Link to="/inbox" className="nav-mobile-link" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Inbox</span>
              {unreadMessages > 0 && (
                <span style={{ background: 'var(--color-accent)', color: '#0A0A0A', fontSize: '10px', fontFamily: 'var(--font-mono)', fontWeight: 700, padding: '1px 6px', borderRadius: '8px' }}>
                  {unreadMessages}
                </span>
              )}
            </Link>
          )}

          <div className="nav-mobile-divider" />

          {user ? (
            <>
              {user.is_moderator && (
                <Link to="/mod" className="nav-mobile-link" onClick={() => setMenuOpen(false)} style={{ color: 'var(--color-danger)' }}>
                  Mod Queue
                </Link>
              )}
              <Link to={`/profile/${user.username}`} className="nav-mobile-link" onClick={() => setMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img
                  src={user.avatar_url || '/wolf-avatar.jpeg'}
                  alt={user.username}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--color-border)', flexShrink: 0 }}
                />
                {user.username}
              </Link>
              <button className="nav-mobile-link" onClick={handleLogout}>
                Sign Out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-mobile-link" onClick={() => setMenuOpen(false)}>
                Sign In
              </Link>
              <Link to="/register" onClick={() => setMenuOpen(false)} style={{
                margin: '8px 24px 0',
                padding: '10px 20px', borderRadius: '6px',
                fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600,
                color: '#0A0A0A', background: 'var(--color-accent)',
                textAlign: 'center', display: 'block',
              }}>
                Join
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  )
}
