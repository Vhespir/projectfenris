import { Link } from 'react-router-dom'

export default function NotFound() {
  return <ErrorPage code="404" title="Signal Lost" message="This location isn't on the map. Whatever you were looking for has gone dark." cta={{ label: 'Return to Base', to: '/' }} />
}

export function ServerError() {
  return <ErrorPage code="500" title="Something Went Wrong" message="The network is experiencing interference. Our systems are aware and working to restore signal." cta={{ label: 'Try Again', onClick: () => window.location.reload() }} flicker />
}

export function Forbidden() {
  return <ErrorPage code="403" title="Access Denied" message="You don't have clearance for this location. Make sure you're signed in." cta={{ label: 'Sign In', to: '/login' }} />
}

export function Maintenance() {
  return <ErrorPage code="503" title="Going Dark Briefly" message="Project Fenris is undergoing maintenance. We'll be back online shortly. Stay ready." />
}

interface ErrorPageProps {
  code: string
  title: string
  message: string
  cta?: { label: string; to?: string; onClick?: () => void }
  flicker?: boolean
}

function ErrorPage({ code, title, message, cta, flicker }: ErrorPageProps) {
  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '40px 20px', textAlign: 'center',
    }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <WolfEye flicker={flicker} />

        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.15em',
          color: 'var(--color-subtle)', textTransform: 'uppercase', marginBottom: '16px',
        }}>
          Error {code}
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700,
          color: 'var(--color-text)', marginBottom: '16px', lineHeight: 1.2,
        }}>
          {title}
        </h1>

        <p style={{
          fontSize: '15px', color: 'var(--color-muted)', lineHeight: 1.7,
          marginBottom: cta ? '32px' : 0,
        }}>
          {message}
        </p>

        {cta && (
          cta.to ? (
            <Link to={cta.to} style={{
              display: 'inline-block', padding: '10px 24px', borderRadius: '6px',
              fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600,
              background: 'var(--color-accent)', color: '#0A0A0A', textDecoration: 'none',
            }}>
              {cta.label}
            </Link>
          ) : (
            <button onClick={cta.onClick} style={{
              padding: '10px 24px', borderRadius: '6px', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600,
              background: 'var(--color-accent)', color: '#0A0A0A',
            }}>
              {cta.label}
            </button>
          )
        )}
      </div>
    </div>
  )
}

function WolfEye({ flicker }: { flicker?: boolean }) {
  return (
    <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'center' }}>
      <img
        src="/logo.png"
        alt="Project Fenris"
        width={80}
        height={80}
        style={{
          opacity: 0.3,
          objectFit: 'contain',
          animation: flicker ? 'flicker 2.5s ease-in-out infinite' : undefined,
        }}
      />
      {flicker && (
        <style>{`
          @keyframes flicker {
            0%, 100% { opacity: 0.3; }
            45% { opacity: 0.3; }
            50% { opacity: 0.05; }
            55% { opacity: 0.3; }
            80% { opacity: 0.3; }
            83% { opacity: 0.1; }
            86% { opacity: 0.3; }
          }
        `}</style>
      )}
    </div>
  )
}
