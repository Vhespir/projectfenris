import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useIsMobile } from '../hooks/useIsMobile'

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: '6px', boxSizing: 'border-box' as const,
  background: 'var(--color-bg)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', fontSize: '14px', fontFamily: 'var(--font-body)', outline: 'none',
}
const labelStyle = {
  display: 'block', fontSize: '11px', fontFamily: 'var(--font-display)',
  color: 'var(--color-muted)', marginBottom: '5px', textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const FAMILIES = ['Nightshade', 'Legume', 'Brassica', 'Cucurbit', 'Allium', 'Root', 'Leafy Green', 'Grain', 'Herb', 'Fruit', 'Other'] as const
type Family = typeof FAMILIES[number]

const FAMILY_COLOR: Record<Family, string> = {
  Nightshade: '#EF4444', Legume: '#22C55E', Brassica: '#3B82F6', Cucurbit: '#F59E0B',
  Allium: '#A78BFA', Root: '#F97316', 'Leafy Green': '#84CC16', Grain: '#EAB308',
  Herb: '#06B6D4', Fruit: '#EC4899', Other: '#71717A',
}

const STATUSES = ['planned', 'planted', 'growing', 'harvesting', 'done'] as const
type CropStatus = typeof STATUSES[number]

const STATUS_COLOR: Record<CropStatus, string> = {
  planned: '#71717A', planted: '#3B82F6', growing: '#22C55E', harvesting: '#F59E0B', done: '#94A3B8',
}

interface Bed {
  id: string; name: string; location_label: string | null; size_sqft: number | null
  notes: string | null; crop_count: number; active_crop_count: number
}
interface Crop {
  id: string; bed_id: string; name: string; variety: string | null; family: Family; status: CropStatus
  planted_date: string | null; expected_harvest_date: string | null; season: string | null
  notes: string | null; total_yield: number
}
interface Harvest {
  id: string; crop_id: string; harvest_date: string; quantity: number; unit: string; notes: string | null
}
interface Seed {
  id: string; name: string; variety: string | null; family: Family; qty: number; unit: string
  viability_year: number | null; source: string | null; notes: string | null
}

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}

// ─── Crop detail (harvest log) ─────────────────────────────────────────────────

function CropHarvests({ crop, onChanged }: { crop: Crop; onChanged: () => void }) {
  const [harvests, setHarvests] = useState<Harvest[] | null>(null)
  const [form, setForm] = useState({ harvest_date: '', quantity: '', unit: 'lbs', notes: '' })

  useEffect(() => {
    api<Harvest[]>(`/api/garden/crops/${crop.id}/harvests`).then(setHarvests)
  }, [crop.id])

  async function logHarvest() {
    if (!form.quantity || Number(form.quantity) <= 0) return
    const created = await api<Harvest>(`/api/garden/crops/${crop.id}/harvests`, {
      method: 'POST',
      body: JSON.stringify({ ...form, quantity: Number(form.quantity), harvest_date: form.harvest_date || undefined }),
    })
    if (created) {
      setHarvests(prev => [created, ...(prev ?? [])])
      setForm({ harvest_date: '', quantity: '', unit: form.unit, notes: '' })
      onChanged()
    }
  }

  async function removeHarvest(id: string) {
    await api(`/api/garden/harvests/${id}`, { method: 'DELETE' })
    setHarvests(prev => (prev ?? []).filter(h => h.id !== id))
    onChanged()
  }

  return (
    <div style={{ padding: '14px', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '8px', marginBottom: '12px', alignItems: 'flex-end' }}>
        <div><label style={labelStyle}>Date</label><input type="date" value={form.harvest_date} onChange={e => setForm(f => ({ ...f, harvest_date: e.target.value }))} style={inputStyle} /></div>
        <div><label style={labelStyle}>Quantity</label><input type="number" min={0} step="0.1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} style={inputStyle} placeholder="0" /></div>
        <div><label style={labelStyle}>Unit</label><input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle} placeholder="lbs, count, jars..." /></div>
        <button onClick={logHarvest} style={{ padding: '9px 16px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Log harvest
        </button>
      </div>
      {harvests === null ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
      ) : harvests.length === 0 ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>No harvests logged yet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '4px', overflow: 'hidden' }}>
          {harvests.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 12px', background: 'var(--color-surface)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{h.harvest_date}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--color-accent)' }}>{h.quantity} {h.unit}</span>
              {h.notes && <span style={{ fontSize: '12px', color: 'var(--color-muted)', flex: 1 }}>{h.notes}</span>}
              <button onClick={() => removeHarvest(h.id)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', fontSize: '15px', lineHeight: 1 }}>x</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Bed detail (crops + rotation history) ─────────────────────────────────────

function BedDetail({ bed, onBack, onBedChanged }: { bed: Bed; onBack: () => void; onBedChanged: () => void }) {
  const isMobile = useIsMobile()
  const [crops, setCrops] = useState<Crop[] | null>(null)
  const [showNewCrop, setShowNewCrop] = useState(false)
  const [newCrop, setNewCrop] = useState({ name: '', variety: '', family: 'Other' as Family, status: 'planned' as CropStatus, planted_date: '', expected_harvest_date: '', season: '', notes: '' })
  const [expandedCropId, setExpandedCropId] = useState<string | null>(null)

  function load() {
    api<Crop[]>(`/api/garden/beds/${bed.id}/crops`).then(setCrops)
  }
  useEffect(load, [bed.id])

  async function createCrop() {
    if (!newCrop.name.trim()) return
    const created = await api<Crop>(`/api/garden/beds/${bed.id}/crops`, {
      method: 'POST',
      body: JSON.stringify({ ...newCrop, planted_date: newCrop.planted_date || undefined, expected_harvest_date: newCrop.expected_harvest_date || undefined }),
    })
    if (created) {
      setCrops(prev => [created, ...(prev ?? [])])
      setShowNewCrop(false)
      setNewCrop({ name: '', variety: '', family: 'Other', status: 'planned', planted_date: '', expected_harvest_date: '', season: '', notes: '' })
      onBedChanged()
    }
  }

  async function updateCropStatus(crop: Crop, status: CropStatus) {
    const updated = await api<Crop>(`/api/garden/crops/${crop.id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    if (updated) setCrops(prev => (prev ?? []).map(c => c.id === crop.id ? { ...c, status } : c))
    onBedChanged()
  }

  async function removeCrop(id: string) {
    await api(`/api/garden/crops/${id}`, { method: 'DELETE' })
    setCrops(prev => (prev ?? []).filter(c => c.id !== id))
    onBedChanged()
  }

  const activeCrops = (crops ?? []).filter(c => c.status !== 'done')
  const pastCrops = (crops ?? [])
    .filter(c => c.planted_date)
    .sort((a, b) => (b.planted_date ?? '').localeCompare(a.planted_date ?? ''))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={onBack} style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-muted)', padding: '4px 10px', fontSize: '12px', fontFamily: 'var(--font-display)', cursor: 'pointer' }}>
          Beds
        </button>
        <span style={{ color: 'var(--color-subtle)', fontSize: '12px' }}>/</span>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{bed.name}</h3>
        {bed.location_label && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{bed.location_label}</span>}
        {bed.size_sqft && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{bed.size_sqft} sq ft</span>}
        <button onClick={() => setShowNewCrop(v => !v)} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: 'none', background: showNewCrop ? 'var(--color-border)' : 'var(--color-accent)', color: showNewCrop ? 'var(--color-muted)' : '#0A0A0A' }}>
          {showNewCrop ? 'Cancel' : '+ Plant a crop'}
        </button>
      </div>

      {/* Rotation history */}
      {pastCrops.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: '8px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Rotation history for this bed
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: pastCrops.length >= 2 && pastCrops[0].family === pastCrops[1].family && pastCrops[0].family !== 'Other' ? '10px' : 0 }}>
            {pastCrops.slice(0, 6).map(c => (
              <span key={c.id} style={{
                fontFamily: 'var(--font-mono)', fontSize: '11px', padding: '3px 9px', borderRadius: '4px',
                background: `${FAMILY_COLOR[c.family]}18`, color: FAMILY_COLOR[c.family], border: `1px solid ${FAMILY_COLOR[c.family]}40`,
              }}>
                {c.planted_date?.slice(0, 7)} {c.name} ({c.family})
              </span>
            ))}
          </div>
          {pastCrops.length >= 2 && pastCrops[0].family === pastCrops[1].family && pastCrops[0].family !== 'Other' && (
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#F59E0B' }}>
              Same family ({pastCrops[0].family}) as the last planting here. Rotating families helps avoid soil-borne disease and nutrient depletion building up.
            </div>
          )}
        </div>
      )}

      {/* New crop form */}
      {showNewCrop && (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div><label style={labelStyle}>Crop name</label><input value={newCrop.name} onChange={e => setNewCrop(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Tomatoes" autoFocus /></div>
            <div><label style={labelStyle}>Variety (optional)</label><input value={newCrop.variety} onChange={e => setNewCrop(f => ({ ...f, variety: e.target.value }))} style={inputStyle} placeholder="Roma, Cherokee Purple..." /></div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Family</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FAMILIES.map(f => (
                <button key={f} type="button" onClick={() => setNewCrop(c => ({ ...c, family: f }))} style={{ padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer', fontWeight: newCrop.family === f ? 700 : 400, border: `1px solid ${newCrop.family === f ? FAMILY_COLOR[f] : 'var(--color-border)'}`, background: newCrop.family === f ? `${FAMILY_COLOR[f]}18` : 'transparent', color: newCrop.family === f ? FAMILY_COLOR[f] : 'var(--color-muted)' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div><label style={labelStyle}>Planted date</label><input type="date" value={newCrop.planted_date} onChange={e => setNewCrop(f => ({ ...f, planted_date: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Expected harvest</label><input type="date" value={newCrop.expected_harvest_date} onChange={e => setNewCrop(f => ({ ...f, expected_harvest_date: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Season (optional)</label><input value={newCrop.season} onChange={e => setNewCrop(f => ({ ...f, season: e.target.value }))} style={inputStyle} placeholder="Spring 2026" /></div>
          </div>
          <button onClick={createCrop} disabled={!newCrop.name.trim()} style={{ padding: '8px 22px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: newCrop.name.trim() ? 'pointer' : 'default', border: 'none', background: newCrop.name.trim() ? 'var(--color-accent)' : 'var(--color-border)', color: newCrop.name.trim() ? '#0A0A0A' : 'var(--color-muted)' }}>
            Plant it
          </button>
        </div>
      )}

      {/* Active crops */}
      {crops === null ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', padding: '20px 0' }}>Loading...</div>
      ) : activeCrops.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 24px', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)' }}>Nothing planted right now.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
          {activeCrops.map(crop => {
            const isExpanded = expandedCropId === crop.id
            return (
              <div key={crop.id}>
                <div
                  onClick={() => setExpandedCropId(isExpanded ? null : crop.id)}
                  style={{ background: 'var(--color-surface)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: isMobile ? 'wrap' : 'nowrap', cursor: 'pointer', borderLeft: `3px solid ${FAMILY_COLOR[crop.family]}` }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      {crop.name}
                      {crop.variety && <span style={{ fontWeight: 400, color: 'var(--color-muted)' }}>({crop.variety})</span>}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                      {crop.planted_date ? `Planted ${crop.planted_date}` : 'Not yet planted'}
                      {crop.expected_harvest_date && ` · Expected ${crop.expected_harvest_date}`}
                      {crop.total_yield > 0 && ` · ${crop.total_yield} harvested`}
                    </div>
                  </div>
                  <select value={crop.status} onClick={e => e.stopPropagation()} onChange={e => updateCropStatus(crop, e.target.value as CropStatus)}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: STATUS_COLOR[crop.status], background: `${STATUS_COLOR[crop.status]}18`, border: `1px solid ${STATUS_COLOR[crop.status]}40`, borderRadius: '4px', padding: '3px 6px', cursor: 'pointer' }}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <button onClick={e => { e.stopPropagation(); removeCrop(crop.id) }} style={{ background: 'transparent', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', fontSize: '16px', lineHeight: 1, flexShrink: 0 }}>x</button>
                </div>
                {isExpanded && <CropHarvests crop={crop} onChanged={load} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Bed list ───────────────────────────────────────────────────────────────────

function BedList({ onSelect }: { onSelect: (bed: Bed) => void }) {
  const isMobile = useIsMobile()
  const [beds, setBeds] = useState<Bed[] | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', location_label: '', size_sqft: '' })

  function load() { api<Bed[]>('/api/garden/beds').then(setBeds) }
  useEffect(load, [])

  async function createBed() {
    if (!form.name.trim()) return
    const created = await api<Bed>('/api/garden/beds', {
      method: 'POST',
      body: JSON.stringify({ name: form.name, location_label: form.location_label || undefined, size_sqft: form.size_sqft ? Number(form.size_sqft) : undefined }),
    })
    if (created) {
      setBeds(prev => [...(prev ?? []), created])
      setShowNew(false)
      setForm({ name: '', location_label: '', size_sqft: '' })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Your Beds</div>
        <button onClick={() => setShowNew(v => !v)} style={{ padding: '7px 16px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: 'none', background: showNew ? 'var(--color-border)' : 'var(--color-accent)', color: showNew ? 'var(--color-muted)' : '#0A0A0A' }}>
          {showNew ? 'Cancel' : '+ New bed'}
        </button>
      </div>

      {showNew && (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', marginBottom: '24px', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto', gap: '12px', alignItems: 'flex-end' }}>
          <div><label style={labelStyle}>Bed name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Raised bed 1" autoFocus /></div>
          <div><label style={labelStyle}>Location (optional)</label><input value={form.location_label} onChange={e => setForm(f => ({ ...f, location_label: e.target.value }))} style={inputStyle} placeholder="Back yard, south side" /></div>
          <div><label style={labelStyle}>Size (sq ft, optional)</label><input type="number" min={0} value={form.size_sqft} onChange={e => setForm(f => ({ ...f, size_sqft: e.target.value }))} style={inputStyle} /></div>
          <button onClick={createBed} disabled={!form.name.trim()} style={{ padding: '9px 20px', borderRadius: '6px', border: 'none', background: form.name.trim() ? 'var(--color-accent)' : 'var(--color-border)', color: form.name.trim() ? '#0A0A0A' : 'var(--color-muted)', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: form.name.trim() ? 'pointer' : 'default' }}>
            Create
          </button>
        </div>
      )}

      {beds === null ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
      ) : beds.length === 0 && !showNew ? (
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>No beds yet</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.6 }}>
            A bed can be a raised bed, a field, a row, or a greenhouse. Whatever you actually plant in.
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
          {(beds ?? []).map(bed => (
            <button key={bed.id} onClick={() => onSelect(bed)} style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '6px' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{bed.name}</div>
              {bed.location_label && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{bed.location_label}</div>}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-muted)' }}>
                {bed.active_crop_count} active crop{bed.active_crop_count !== 1 ? 's' : ''} &middot; {bed.crop_count} planted total
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Seed inventory ─────────────────────────────────────────────────────────────

function SeedInventory() {
  const isMobile = useIsMobile()
  const [seeds, setSeeds] = useState<Seed[] | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', variety: '', family: 'Other' as Family, qty: '', unit: 'packets', viability_year: '', source: '' })

  function load() { api<Seed[]>('/api/garden/seeds').then(setSeeds) }
  useEffect(load, [])

  async function createSeed() {
    if (!form.name.trim()) return
    const created = await api<Seed>('/api/garden/seeds', {
      method: 'POST',
      body: JSON.stringify({
        ...form, qty: form.qty ? Number(form.qty) : 0,
        viability_year: form.viability_year ? Number(form.viability_year) : undefined,
      }),
    })
    if (created) {
      setSeeds(prev => [...(prev ?? []), created])
      setShowNew(false)
      setForm({ name: '', variety: '', family: 'Other', qty: '', unit: 'packets', viability_year: '', source: '' })
    }
  }

  async function removeSeed(id: string) {
    await api(`/api/garden/seeds/${id}`, { method: 'DELETE' })
    setSeeds(prev => (prev ?? []).filter(s => s.id !== id))
  }

  const currentYear = new Date().getFullYear()

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>Seed Inventory</div>
        <button onClick={() => setShowNew(v => !v)} style={{ padding: '7px 16px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: 'none', background: showNew ? 'var(--color-border)' : 'var(--color-accent)', color: showNew ? 'var(--color-muted)' : '#0A0A0A' }}>
          {showNew ? 'Cancel' : '+ Add seeds'}
        </button>
      </div>

      {showNew && (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px', marginBottom: '12px' }}>
            <div><label style={labelStyle}>Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} placeholder="Tomato" autoFocus /></div>
            <div><label style={labelStyle}>Variety</label><input value={form.variety} onChange={e => setForm(f => ({ ...f, variety: e.target.value }))} style={inputStyle} placeholder="Roma" /></div>
            <div><label style={labelStyle}>Quantity</label><input type="number" min={0} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={inputStyle} /></div>
            <div><label style={labelStyle}>Unit</label><input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} style={inputStyle} placeholder="packets, grams..." /></div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={labelStyle}>Family</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {FAMILIES.map(f => (
                <button key={f} type="button" onClick={() => setForm(s => ({ ...s, family: f }))} style={{ padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer', fontWeight: form.family === f ? 700 : 400, border: `1px solid ${form.family === f ? FAMILY_COLOR[f] : 'var(--color-border)'}`, background: form.family === f ? `${FAMILY_COLOR[f]}18` : 'transparent', color: form.family === f ? FAMILY_COLOR[f] : 'var(--color-muted)' }}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div><label style={labelStyle}>Viable through year (optional)</label><input type="number" value={form.viability_year} onChange={e => setForm(f => ({ ...f, viability_year: e.target.value }))} style={inputStyle} placeholder={String(currentYear + 2)} /></div>
            <div><label style={labelStyle}>Source (optional)</label><input value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} style={inputStyle} placeholder="Saved from last harvest, seed co..." /></div>
          </div>
          <button onClick={createSeed} disabled={!form.name.trim()} style={{ padding: '8px 22px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: form.name.trim() ? 'pointer' : 'default', border: 'none', background: form.name.trim() ? 'var(--color-accent)' : 'var(--color-border)', color: form.name.trim() ? '#0A0A0A' : 'var(--color-muted)' }}>
            Add to inventory
          </button>
        </div>
      )}

      {seeds === null ? (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>Loading...</div>
      ) : seeds.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 24px', border: '1px dashed var(--color-border)', borderRadius: '8px' }}>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)' }}>No seeds tracked yet.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
          {seeds.map(seed => {
            const expiringSoon = seed.viability_year != null && seed.viability_year <= currentYear + 1
            return (
              <div key={seed.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: 'var(--color-surface)', borderLeft: `3px solid ${FAMILY_COLOR[seed.family]}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)' }}>
                    {seed.name}{seed.variety ? ` (${seed.variety})` : ''}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginTop: '2px' }}>
                    {seed.family}{seed.source ? ` · ${seed.source}` : ''}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-muted)' }}>{seed.qty} {seed.unit}</span>
                {seed.viability_year && (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: expiringSoon ? '#F59E0B' : 'var(--color-subtle)', background: expiringSoon ? 'rgba(245,158,11,0.1)' : 'transparent', border: expiringSoon ? '1px solid rgba(245,158,11,0.25)' : 'none', borderRadius: '3px', padding: expiringSoon ? '1px 6px' : 0 }}>
                    viable through {seed.viability_year}
                  </span>
                )}
                <button onClick={() => removeSeed(seed.id)} style={{ background: 'transparent', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 }}>x</button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Top-level Garden tool ──────────────────────────────────────────────────────

export default function GardenManager() {
  const { user } = useAuth()
  const [view, setView] = useState<'beds' | 'seeds'>('beds')
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null)

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
          Sign in to track your garden
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-muted)', maxWidth: '420px', margin: '0 auto' }}>
          Beds, crops, harvest logs, and seed inventory sync to your account. There's no local-guest mode for this one yet.
        </div>
      </div>
    )
  }

  return (
    <div>
      {!selectedBed && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
          {(['beds', 'seeds'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '6px 14px', borderRadius: '5px', fontSize: '13px', fontFamily: 'var(--font-display)',
              fontWeight: view === v ? 600 : 400, cursor: 'pointer',
              border: `1px solid ${view === v ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: view === v ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: view === v ? 'var(--color-accent)' : 'var(--color-muted)',
            }}>
              {v === 'beds' ? 'Beds' : 'Seed Inventory'}
            </button>
          ))}
        </div>
      )}
      {selectedBed ? (
        <BedDetail bed={selectedBed} onBack={() => setSelectedBed(null)} onBedChanged={() => {}} />
      ) : view === 'beds' ? (
        <BedList onSelect={setSelectedBed} />
      ) : (
        <SeedInventory />
      )}
    </div>
  )
}
