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
            { href: '/aar', label: 'After Action Reports' },
            { href: '/frequencies', label: 'Frequencies' },
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

        <a
          href="https://ko-fi.com/projectfenris"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '6px',
            background: '#22C55E',
            color: '#0A0A0A',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#4ADE80' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#22C55E' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M2 7h18.5a2.5 2.5 0 0 1 0 5H18v2a6 6 0 0 1-6 6H6a4 4 0 0 1-4-4V7zm16 5h2.5a.5.5 0 0 0 0-1H18v1z" />
          </svg>
          Support Us
        </a>
      </div>
    </footer>
  )
}
