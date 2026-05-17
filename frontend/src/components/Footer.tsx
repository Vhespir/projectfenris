import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid var(--color-border)',
      padding: '40px 24px',
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: '13px',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--color-subtle)',
        }}>
          PROJECT <span style={{ color: 'var(--color-accent)' }}>FENRIS</span>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { href: '/feed', label: 'Feed' },
            { href: '/map', label: 'Map' },
            { href: '/community', label: 'Community' },
            { href: '/compendium', label: 'Compendium' },
            { href: '/tools', label: 'Tools' },
            { href: '/about', label: 'About' },
          ].map(link => (
            <Link
              key={link.href}
              to={link.href}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                color: 'var(--color-subtle)',
                letterSpacing: '0.02em',
              }}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: 'var(--color-subtle)',
          letterSpacing: '0.04em',
        }}>
          Stay informed. Stay ready.
        </div>
      </div>
    </footer>
  )
}
