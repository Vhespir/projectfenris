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
            { href: '/community?channel=aar', label: 'After Action Reports' },
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

        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <a
          href="https://discord.gg/NWNZBDsJKc"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '7px 14px',
            borderRadius: '6px',
            background: '#5865F2',
            color: '#fff',
            fontFamily: 'var(--font-display)',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            letterSpacing: '0.02em',
            flexShrink: 0,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#4752C4' }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#5865F2' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
          </svg>
          Discord
        </a>
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
      </div>
    </footer>
  )
}
