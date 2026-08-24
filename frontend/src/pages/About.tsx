import { Link } from 'react-router-dom'

const layers = [
  {
    icon: '◈', label: 'DATA LAYER',
    title: 'Live Situational Awareness',
    body: 'Real-time map pulling from NOAA, USGS, GDACS, and EPA. Active alerts, seismic events, global disasters, and air quality plotted and updated every ten minutes.',
  },
  {
    icon: '◉', label: 'COMMUNITY LAYER',
    title: 'Ground Truth from the Field',
    body: 'Location-tagged field reports from members on the ground. Road conditions, power outages, local hazards. Reputation-scored and time-stamped so you know what to trust.',
  },
  {
    icon: '◫', label: 'KNOWLEDGE LAYER',
    title: 'A Compendium Built to Last',
    body: 'Community-contributed guides covering water, medical, comms, food, and shelter. High-rated resources surface to the top. Trusted contributors get elevated visibility.',
  },
  {
    icon: '◧', label: 'TOOLS LAYER',
    title: 'Practical Planning Tools',
    body: 'Water storage calculators, caloric needs estimators, bug-out bag builders, and inventory managers. Operational tools built for real scenarios, not hypotheticals.',
  },
]

export default function About() {
  return (
    <div>
      {/* Hero */}
      <section style={{
        minHeight: '70vh', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '80px 24px',
        maxWidth: '1200px', margin: '0 auto', position: 'relative', overflow: 'hidden',
      }}>
        <img src="/logo.webp" alt="" aria-hidden style={{
          position: 'absolute', right: '-60px', top: '50%', transform: 'translateY(-50%)',
          width: 'clamp(320px, 45vw, 600px)', opacity: 0.06,
          pointerEvents: 'none', userSelect: 'none', filter: 'grayscale(1)',
        }} />
        <div style={{ marginBottom: '20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.12em', color: 'var(--color-muted)', textTransform: 'uppercase' }}>
            About Project Fenris
          </span>
        </div>
        <h1 style={{
          fontSize: 'clamp(44px, 7vw, 88px)', fontWeight: 700,
          letterSpacing: '-0.02em', lineHeight: 1.0,
          marginBottom: '8px', color: 'var(--color-text)',
        }}>
          FOR PEOPLE WHO
        </h1>
        <h1 style={{
          fontSize: 'clamp(44px, 7vw, 88px)', fontWeight: 700,
          letterSpacing: '-0.02em', lineHeight: 1.0,
          marginBottom: '40px', color: 'var(--color-accent)',
        }}>
          PAY ATTENTION.
        </h1>
        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--color-muted)',
          maxWidth: '520px', lineHeight: 1.7, marginBottom: '40px',
        }}>
          Not out of fear. Out of habit. Out of a belief that knowing what's happening, early and clearly, is one of the most responsible things a person can do.
        </p>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link to="/feed" style={{
            fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px',
            letterSpacing: '0.02em', padding: '12px 24px', borderRadius: '8px',
            background: 'var(--color-accent)', color: '#0A0A0A',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}>
            Open the Feed
          </Link>
          <Link to="/register" style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '14px',
            letterSpacing: '0.02em', padding: '12px 24px', borderRadius: '8px',
            border: '1px solid var(--color-border)', color: 'var(--color-muted)',
            display: 'inline-flex', alignItems: 'center', gap: '8px',
          }}>
            Join the Community
          </Link>
          <a href="https://discord.gg/NWNZBDsJKc" target="_blank" rel="noopener noreferrer" style={{
            fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '14px',
            letterSpacing: '0.02em', padding: '12px 24px', borderRadius: '8px',
            border: '1px solid var(--color-border)', color: 'var(--color-muted)',
            display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none',
          }}>
            Join our Discord
          </a>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '28px 24px', display: 'flex', gap: '48px', flexWrap: 'wrap' }}>
          {[
            { value: 'NOAA · USGS · GDACS · EPA', label: 'Live Data Sources', mono: true },
            { value: '45', label: 'Countries with Weather Alerts', mono: false },
            { value: '$0', label: 'Cost to Access', mono: false },
            { value: 'No ads. Ever.', label: 'Monetization Model', mono: true },
          ].map(stat => (
            <div key={stat.label}>
              <div style={{
                fontFamily: stat.mono ? 'var(--font-mono)' : 'var(--font-display)',
                fontSize: stat.mono ? '12px' : '28px',
                fontWeight: 600, color: 'var(--color-accent)',
                letterSpacing: stat.mono ? '0.05em' : '-0.02em', marginBottom: '2px',
              }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--color-subtle)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Platform pillars */}
      <section style={{ padding: '96px 24px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Platform Architecture
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 600, letterSpacing: '-0.02em', marginBottom: '64px', maxWidth: '560px' }}>
            Four layers. One platform.
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1px', background: 'var(--color-border)' }}>
            {layers.map((layer, i) => (
              <div key={layer.label} style={{ background: 'var(--color-bg)', padding: '40px 32px', position: 'relative' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', letterSpacing: '0.1em', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--color-accent)', fontSize: '16px' }}>{layer.icon}</span>
                  {layer.label}
                </div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, letterSpacing: '-0.01em', marginBottom: '12px', color: 'var(--color-text)' }}>
                  {layer.title}
                </h3>
                <p style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: 1.7 }}>
                  {layer.body}
                </p>
                <div style={{ position: 'absolute', top: '40px', right: '32px', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>
                  0{i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About copy */}
      <section style={{ padding: '96px 24px', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '48px' }}>
            Mission
          </div>
          {[
            'The information has always been out there. The tools exist. The community exists. But they\'ve always been scattered across subreddits, bookmark folders, and apps that never talk to each other. No single place to watch, prepare, and connect.',
            'Project Fenris is not a doomsday platform. No bunkers, no collapse fantasies, no gear affiliate links. Just real data, practical tools, and a community of people who believe preparedness is about responsibility.',
            'To yourself. To your neighbors. To the people around you when things go sideways.',
          ].map((para, i) => (
            <p key={i} style={{
              fontSize: 'clamp(16px, 2vw, 20px)', color: i === 2 ? 'var(--color-text)' : 'var(--color-muted)',
              lineHeight: 1.7, marginBottom: '32px',
              fontWeight: i === 2 ? 500 : 400,
            }}>
              {para}
            </p>
          ))}
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(20px, 3vw, 28px)',
            fontWeight: 700, color: 'var(--color-accent)',
            letterSpacing: '-0.01em', lineHeight: 1.3, marginTop: '48px',
          }}>
            The wolf watches. So do we.
          </p>
        </div>
      </section>

      {/* Philosophy */}
      <section style={{ padding: '96px 24px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-accent)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '16px' }}>
            Philosophy
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '40px', marginTop: '48px' }}>
            {[
              { headline: 'Quiet confidence.', body: 'Serious without being heavy. Technical without gatekeeping.' },
              { headline: 'No paranoia.', body: 'Preparedness as responsibility, not fear. Built for people who think ahead.' },
              { headline: 'Built for the world.', body: 'Not just the US. Global data sources, global community, global relevance.' },
              { headline: 'Simple and fast.', body: 'No friction. Open it and immediately see what\'s happening.' },
            ].map(item => (
              <div key={item.headline}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px', letterSpacing: '-0.01em' }}>
                  {item.headline}
                </div>
                <p style={{ fontSize: '14px', color: 'var(--color-muted)', lineHeight: 1.7 }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '96px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 700, letterSpacing: '-0.02em', marginBottom: '16px' }}>
            The definitive home for the global preparedness community.
          </h2>
          <p style={{ fontSize: '16px', color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: '40px' }}>
            Free. No ads. Community owned.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/register" style={{
              fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '14px',
              letterSpacing: '0.02em', padding: '14px 32px', borderRadius: '8px',
              background: 'var(--color-accent)', color: '#0A0A0A',
            }}>
              Create Account
            </Link>
            <Link to="/map" style={{
              fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: '14px',
              padding: '14px 32px', borderRadius: '8px',
              border: '1px solid var(--color-border)', color: 'var(--color-muted)',
            }}>
              View the Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
