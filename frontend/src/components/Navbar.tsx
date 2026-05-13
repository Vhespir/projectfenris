import { Link, useLocation } from 'react-router-dom'

const WolfIcon = () => (
  <img src="/logo.png" alt="Project Fenris" width={32} height={32} style={{ display: 'block', objectFit: 'contain' }} />
)

export default function Navbar() {
  const location = useLocation()

  const navLinks = [
    { href: '/map', label: 'Live Map' },
    { href: '/feed', label: 'Feed' },
    { href: '/community', label: 'Community' },
  ]

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      background: 'rgba(10, 10, 10, 0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <WolfIcon />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: '15px',
            letterSpacing: '0.08em',
            color: 'var(--text)',
          }}>
            PROJECT <span style={{ color: 'var(--green)' }}>FENRIS</span>
          </span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {navLinks.map(link => (
            <Link
              key={link.href}
              to={link.href}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '13px',
                fontWeight: 500,
                letterSpacing: '0.02em',
                padding: '6px 14px',
                borderRadius: '6px',
                color: location.pathname === link.href ? 'var(--text)' : 'var(--text-muted)',
                background: location.pathname === link.href ? 'var(--surface)' : 'transparent',
                transition: 'color 0.15s, background 0.15s',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            to="/login"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-muted)',
              padding: '6px 14px',
            }}
          >
            Sign In
          </Link>
          <Link
            to="/register"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '13px',
              fontWeight: 600,
              letterSpacing: '0.02em',
              color: '#0A0A0A',
              background: 'var(--green)',
              padding: '7px 16px',
              borderRadius: '6px',
              transition: 'background 0.15s',
            }}
          >
            Join
          </Link>
        </div>
      </div>
    </nav>
  )
}
