import { Link } from 'react-router-dom'

const LiveDot = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
    <span style={{
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: 'var(--green)',
      display: 'inline-block',
      animation: 'pulse-green 2s ease-in-out infinite',
    }} />
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: '11px',
      letterSpacing: '0.1em',
      color: 'var(--green)',
      textTransform: 'uppercase',
    }}>LIVE</span>
  </span>
)

const pillars = [
  {
    icon: '◈',
    label: 'DATA LAYER',
    title: 'Live Situational Awareness',
    body: 'Real-time map pulling from NOAA, USGS, FEMA, and EPA. Active alerts, seismic events, federal declarations, and air quality, updated continuously.',
  },
  {
    icon: '◉',
    label: 'COMMUNITY LAYER',
    title: 'Ground Truth from the Field',
    body: 'Location-tagged field reports from members on the ground. Road conditions, power outages, local hazards. Clearly labeled, reputation-scored, and time-stamped.',
  },
  {
    icon: '◫',
    label: 'KNOWLEDGE LAYER',
    title: 'A Compendium Built to Last',
    body: 'Community-contributed guides covering water, medical, comms, food, and shelter. High-rated resources surface to the top. Trusted contributors get elevated visibility.',
  },
  {
    icon: '◧',
    label: 'TOOLS LAYER',
    title: 'Practical Planning Tools',
    body: 'Supply calculators, inventory trackers, bug-out bag builders, and evacuation route planners. Operational tools for real scenarios.',
  },
]

const stats = [
  { value: '4', label: 'Live Data Sources', mono: true },
  { value: 'NOAA · USGS · FEMA · EPA', label: 'Federal Feeds', mono: true },
  { value: '0', label: 'Cost to Access', mono: false },
]

const MockMapMarker = ({ x, y, type, severity }: { x: number; y: number; type: 'circle' | 'triangle' | 'square' | 'diamond'; severity: 'green' | 'yellow' | 'red' }) => {
  const colors = { green: '#22C55E', yellow: '#F59E0B', red: '#EF4444' }
  const color = colors[severity]
  const size = 10

  const shapes: Record<string, React.ReactNode> = {
    circle: <circle cx={x} cy={y} r={size / 2} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />,
    triangle: <polygon points={`${x},${y - size / 2} ${x - size / 2},${y + size / 2} ${x + size / 2},${y + size / 2}`} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />,
    square: <rect x={x - size / 2} y={y - size / 2} width={size} height={size} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />,
    diamond: <polygon points={`${x},${y - size / 2} ${x + size / 2},${y} ${x},${y + size / 2} ${x - size / 2},${y}`} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5} />,
  }

  return <>{shapes[type]}</>
}

const MapPreview = () => (
  <div style={{
    position: 'relative',
    background: '#0D1117',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    overflow: 'hidden',
    aspectRatio: '16/9',
    maxHeight: '420px',
  }}>
    <svg width="100%" height="100%" viewBox="0 0 800 450" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      {/* Grid lines */}
      {Array.from({ length: 20 }).map((_, i) => (
        <line key={`v${i}`} x1={i * 42} y1={0} x2={i * 42} y2={450} stroke="#1a2030" strokeWidth={0.5} />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <line key={`h${i}`} x1={0} y1={i * 40} x2={800} y2={i * 40} stroke="#1a2030" strokeWidth={0.5} />
      ))}

      {/* Subtle US outline approximation */}
      <path d="M120,120 L680,120 L720,200 L680,340 L500,360 L380,380 L200,360 L120,280 Z"
        fill="none" stroke="#1e2d1e" strokeWidth={1} />

      {/* Map markers */}
      <MockMapMarker x={280} y={160} type="circle" severity="red" />
      <MockMapMarker x={340} y={200} type="circle" severity="yellow" />
      <MockMapMarker x={420} y={180} type="triangle" severity="yellow" />
      <MockMapMarker x={500} y={220} type="square" severity="green" />
      <MockMapMarker x={580} y={170} type="circle" severity="red" />
      <MockMapMarker x={220} y={240} type="diamond" severity="yellow" />
      <MockMapMarker x={460} y={290} type="circle" severity="green" />
      <MockMapMarker x={320} y={280} type="triangle" severity="red" />
      <MockMapMarker x={600} y={280} type="square" severity="yellow" />
      <MockMapMarker x={160} y={180} type="circle" severity="green" />
      <MockMapMarker x={540} y={320} type="diamond" severity="red" />
      <MockMapMarker x={390} y={240} type="circle" severity="yellow" />

      {/* Scanline overlay */}
      <rect x={0} y={0} width={800} height={450} fill="url(#scanlines)" />
      <defs>
        <pattern id="scanlines" width={1} height={4} patternUnits="userSpaceOnUse">
          <rect width={1} height={2} fill="rgba(0,0,0,0.08)" />
        </pattern>
      </defs>
    </svg>

    {/* HUD overlay */}
    <div style={{
      position: 'absolute',
      top: '16px',
      left: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      <LiveDot />
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
        NOAA · USGS · FEMA · EPA
      </div>
    </div>

    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      alignItems: 'flex-end',
    }}>
      {[
        { shape: '●', color: '#EF4444', label: 'Severe' },
        { shape: '▲', color: '#F59E0B', label: 'Moderate' },
        { shape: '■', color: '#22C55E', label: 'Advisory' },
      ].map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-subtle)' }}>{item.label}</span>
          <span style={{ color: item.color, fontSize: '8px' }}>{item.shape}</span>
        </div>
      ))}
    </div>

    <div style={{
      position: 'absolute',
      top: '16px',
      right: '16px',
      fontFamily: 'var(--font-mono)',
      fontSize: '10px',
      color: 'var(--text-subtle)',
      letterSpacing: '0.05em',
    }}>
      {new Date().toISOString().slice(0, 19).replace('T', ' ')}Z
    </div>
  </div>
)

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section style={{
        minHeight: 'calc(100vh - 60px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px 24px',
        maxWidth: '1200px',
        margin: '0 auto',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <img
          src="/logo.webp"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            right: '-60px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: 'clamp(320px, 45vw, 600px)',
            opacity: 0.06,
            pointerEvents: 'none',
            userSelect: 'none',
            filter: 'grayscale(1)',
          }}
        />
        <div style={{ marginBottom: '24px' }}>
          <LiveDot />
        </div>

        <h1 style={{
          fontSize: 'clamp(52px, 8vw, 96px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.0,
          marginBottom: '8px',
          color: 'var(--text)',
        }}>
          STAY INFORMED.
        </h1>
        <h1 style={{
          fontSize: 'clamp(52px, 8vw, 96px)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
          lineHeight: 1.0,
          marginBottom: '40px',
          color: 'var(--green)',
        }}>
          STAY READY.
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 2vw, 20px)',
          color: 'var(--text-muted)',
          maxWidth: '560px',
          lineHeight: 1.6,
          marginBottom: '48px',
          fontWeight: 400,
        }}>
          Live disaster data, crowdsourced ground truth, and practical tools.
          All in one place, owned by the community.
        </p>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            to="/map"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: '14px',
              letterSpacing: '0.02em',
              padding: '14px 28px',
              borderRadius: '8px',
              background: 'var(--green)',
              color: '#0A0A0A',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            View Live Map
            <span style={{ fontSize: '16px' }}>→</span>
          </Link>
          <Link
            to="/register"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 500,
              fontSize: '14px',
              letterSpacing: '0.02em',
              padding: '14px 28px',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              color: 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            Join the Community
          </Link>
        </div>
      </section>

      {/* Stats bar */}
      <div style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '24px',
          display: 'flex',
          gap: '48px',
          flexWrap: 'wrap',
        }}>
          {stats.map(stat => (
            <div key={stat.label}>
              <div style={{
                fontFamily: stat.mono ? 'var(--font-mono)' : 'var(--font-display)',
                fontSize: stat.mono && stat.value.includes('·') ? '12px' : '28px',
                fontWeight: 600,
                color: 'var(--green)',
                letterSpacing: stat.mono && stat.value.includes('·') ? '0.05em' : '-0.02em',
                marginBottom: '2px',
              }}>
                {stat.value}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '12px',
                color: 'var(--text-subtle)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map preview */}
      <section style={{ padding: '96px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--green)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            Live Data Layer
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}>
            What's happening, right now.
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-muted)',
            maxWidth: '480px',
            lineHeight: 1.6,
          }}>
            Active alerts, seismic events, federal declarations, and air quality
            data, plotted on a single map, updated in real time.
          </p>
        </div>
        <MapPreview />
        <div style={{ marginTop: '16px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {[
            { symbol: '●', label: 'NOAA Weather Alerts' },
            { symbol: '▲', label: 'USGS Seismic' },
            { symbol: '■', label: 'FEMA Declarations' },
            { symbol: '◆', label: 'EPA Air Quality' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '10px', color: 'var(--text-subtle)' }}>{item.symbol}</span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '11px',
                color: 'var(--text-subtle)',
                letterSpacing: '0.04em',
              }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Platform pillars */}
      <section style={{
        padding: '96px 24px',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--green)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: '16px',
          }}>
            Platform Architecture
          </div>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 44px)',
            fontWeight: 600,
            letterSpacing: '-0.02em',
            marginBottom: '64px',
            maxWidth: '560px',
          }}>
            Four layers. One platform.
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '1px',
            background: 'var(--border)',
          }}>
            {pillars.map((pillar, i) => (
              <div
                key={pillar.label}
                style={{
                  background: 'var(--surface)',
                  padding: '40px 32px',
                  position: 'relative',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-subtle)',
                  letterSpacing: '0.1em',
                  marginBottom: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <span style={{ color: 'var(--green)', fontSize: '16px' }}>{pillar.icon}</span>
                  {pillar.label}
                </div>
                <h3 style={{
                  fontSize: '20px',
                  fontWeight: 600,
                  letterSpacing: '-0.01em',
                  marginBottom: '12px',
                  color: 'var(--text)',
                }}>
                  {pillar.title}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text-muted)',
                  lineHeight: 1.7,
                }}>
                  {pillar.body}
                </p>
                <div style={{
                  position: 'absolute',
                  top: '40px',
                  right: '32px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: 'var(--text-subtle)',
                }}>
                  0{i + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Community section */}
      <section style={{ padding: '96px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '64px',
          alignItems: 'center',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              color: 'var(--green)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: '16px',
            }}>
              Community
            </div>
            <h2 style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              marginBottom: '20px',
            }}>
              Preparedness as responsibility, not paranoia.
            </h2>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-muted)',
              lineHeight: 1.7,
              marginBottom: '16px',
            }}>
              Project Fenris is built for people who take preparedness seriously. Not as a hobby, but as a responsibility to themselves and their communities.
            </p>
            <p style={{
              fontSize: '16px',
              color: 'var(--text-muted)',
              lineHeight: 1.7,
              marginBottom: '32px',
            }}>
              One principle guides everything here: don't waste each other's time.
              No fearmongering. No politics. Real information, real tools, real people.
            </p>
            <Link
              to="/register"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '14px',
                letterSpacing: '0.02em',
                padding: '12px 24px',
                borderRadius: '8px',
                background: 'var(--green)',
                color: '#0A0A0A',
                display: 'inline-block',
              }}
            >
              Join the Community
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { category: 'FIELD REPORT', title: 'I-40 westbound closed near Flagstaff, winter storm', time: '14 min ago', severity: 'warning' },
              { category: 'VERIFIED', title: 'NOAA: Winter Storm Warning issued for Coconino County', time: '32 min ago', severity: 'danger' },
              { category: 'COMMUNITY', title: 'Shelter-in-place lifted for downtown Phoenix district', time: '1h ago', severity: 'info' },
              { category: 'GUIDE', title: 'Vehicle winter kit: what to actually carry', time: '2h ago', severity: 'neutral' },
            ].map(item => (
              <div
                key={item.title}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  padding: '16px 20px',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '6px',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    letterSpacing: '0.08em',
                    color: item.severity === 'danger' ? 'var(--danger)'
                      : item.severity === 'warning' ? 'var(--warning)'
                      : item.severity === 'info' ? 'var(--info)'
                      : 'var(--text-subtle)',
                  }}>
                    {item.category}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '10px',
                    color: 'var(--text-subtle)',
                  }}>
                    {item.time}
                  </span>
                </div>
                <p style={{
                  fontSize: '14px',
                  color: 'var(--text)',
                  lineHeight: 1.4,
                }}>
                  {item.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{
        padding: '96px 24px',
        borderTop: '1px solid var(--border)',
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            marginBottom: '16px',
          }}>
            The community for people who take preparedness seriously.
          </h2>
          <p style={{
            fontSize: '16px',
            color: 'var(--text-muted)',
            lineHeight: 1.6,
            marginBottom: '40px',
          }}>
            Free. No ads. Community owned.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/register"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 600,
                fontSize: '14px',
                letterSpacing: '0.02em',
                padding: '14px 32px',
                borderRadius: '8px',
                background: 'var(--green)',
                color: '#0A0A0A',
              }}
            >
              Create Account
            </Link>
            <Link
              to="/map"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 500,
                fontSize: '14px',
                padding: '14px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              View the Map
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
