import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { useAuth } from '../context/AuthContext'
import GardenManager from './Garden'

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
const resultRow = (label: string, value: string, accent = false) => (
  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
    <span style={{ fontSize: '13px', color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
    <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: accent ? 'var(--color-accent)' : 'var(--color-text)' }}>{value}</span>
  </div>
)

// Shared math behind the water and calorie targets, used both by the
// standalone calculators and by the per-kit targets panel in Inventory
// Manager, so the two never drift apart.
function computeWaterTargets(people: number, pets: number, days: number, heat: boolean, active: boolean) {
  const dailyPerPerson = (heat ? 1.5 : 1) * (active ? 1.5 : 1)
  const totalPeople = people + pets * 0.5
  const totalGallons = Math.ceil(totalPeople * days * dailyPerPerson)
  const drinkingGallons = Math.ceil(totalPeople * days * 0.5 * (heat ? 1.5 : 1) * (active ? 1.5 : 1))
  return { totalGallons, drinkingGallons }
}

type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'heavy'
const ACTIVITY_CALORIES: Record<ActivityLevel, number> = { sedentary: 1800, light: 2200, moderate: 2600, heavy: 3200 }

function computeCalorieTargets(adults: number, children: number, elderly: number, activity: ActivityLevel) {
  const adultCals = ACTIVITY_CALORIES[activity]
  const childCals = Math.round(adultCals * 0.65)
  const elderlyCals = Math.round(adultCals * 0.85)
  const dailyTotal = adults * adultCals + children * childCals + elderly * elderlyCals
  return { adultCals, childCals, elderlyCals, dailyTotal }
}

// ─── Water Storage Calculator ──────────────────────────────────────────────────

function WaterCalculator({ household, onHouseholdChange }: { household?: Household; onHouseholdChange?: (h: Household) => void } = {}) {
  const isMobile = useIsMobile()
  const controlled = !!household
  const [localPeople, setLocalPeople] = useState(2)
  const [localPets, setLocalPets] = useState(0)
  const [localDays, setLocalDays] = useState(14)
  const [heat, setHeat] = useState(false)
  const [active, setActive] = useState(false)

  const people = household?.people ?? localPeople
  const pets = household?.pets ?? localPets
  const days = household?.days ?? localDays
  function setPeople(v: number) { onHouseholdChange ? onHouseholdChange({ people: v, pets, days }) : setLocalPeople(v) }
  function setPets(v: number)   { onHouseholdChange ? onHouseholdChange({ people, pets: v, days }) : setLocalPets(v) }
  function setDays(v: number)   { onHouseholdChange ? onHouseholdChange({ people, pets, days: v }) : setLocalDays(v) }

  const { totalGallons, drinkingGallons } = computeWaterTargets(people, pets, days, heat, active)
  const containers55 = Math.ceil(totalGallons / 55)
  const containers5 = Math.ceil(totalGallons / 5)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {controlled ? (
          <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-subtle)' }}>
            Using this cache's household: {people} people{pets > 0 ? `, ${pets} pets` : ''}, {days}-day target. Edit it in the household field above.
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><label style={labelStyle}>People</label><input type="number" min={1} max={20} value={people} onChange={e => setPeople(+e.target.value || 1)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Pets</label><input type="number" min={0} max={10} value={pets} onChange={e => setPets(+e.target.value || 0)} style={inputStyle} /></div>
            </div>
            <div><label style={labelStyle}>Duration (days)</label><input type="number" min={1} max={365} value={days} onChange={e => setDays(+e.target.value || 1)} style={inputStyle} /></div>
          </>
        )}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {[{ label: 'Hot climate / summer', value: heat, set: setHeat }, { label: 'High activity / labor', value: active, set: setActive }].map(({ label, value, set }) => (
            <label key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-muted)' }}>
              <input type="checkbox" checked={value} onChange={e => set(e.target.checked)} style={{ accentColor: 'var(--color-accent)', width: '14px', height: '14px' }} />{label}
            </label>
          ))}
        </div>
        <div style={{ padding: '12px 14px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '12px', color: '#93C5FD', lineHeight: 1.6 }}>
          FEMA baseline: 1 gallon per person per day. Hot or active conditions can triple needs.
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Results</div>
        {resultRow('Total water needed', `${totalGallons} gal`, true)}
        {resultRow('Drinking / cooking', `${drinkingGallons} gal`)}
        {resultRow('Sanitation / hygiene', `${totalGallons - drinkingGallons} gal`)}
        <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Container options</div>
        {resultRow('55-gallon drums', `${containers55} drum${containers55 !== 1 ? 's' : ''}`)}
        {resultRow('5-gallon jugs', `${containers5} jug${containers5 !== 1 ? 's' : ''}`)}
        {resultRow('1-gallon jugs', `${totalGallons} jugs`)}
      </div>
    </div>
  )
}

// ─── Caloric Needs Calculator ──────────────────────────────────────────────────

function CaloricCalculator({ household }: { household?: Household } = {}) {
  const isMobile = useIsMobile()
  const controlled = !!household
  const [localAdults, setLocalAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [elderly, setElderly] = useState(0)
  const [activity, setActivity] = useState<ActivityLevel>('moderate')

  // Controlled by a cache's household: that only tracks a total person count,
  // not an age breakdown, so it's counted as adults at whatever activity
  // level is picked here.
  const adults = household?.people ?? localAdults
  const effectiveChildren = controlled ? 0 : children
  const effectiveElderly = controlled ? 0 : elderly

  const { adultCals, childCals, elderlyCals, dailyTotal } = computeCalorieTargets(adults, effectiveChildren, effectiveElderly, activity)
  const cal72h = dailyTotal * 3
  const cal2wk = dailyTotal * 14
  const cal30d = dailyTotal * 30
  const lbsRice30 = Math.round(cal30d / 1650)
  const lbsBeans30 = Math.round(cal30d / 1500 * 0.3)
  const lbsOats30 = Math.round(cal30d / 1700 * 0.2)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {controlled ? (
          <div style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '12px', color: 'var(--color-subtle)' }}>
            Using this cache's household: {adults} people, counted as adults. Edit the count in the household field above.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
            <div><label style={labelStyle}>Adults</label><input type="number" min={0} max={20} value={localAdults} onChange={e => setLocalAdults(+e.target.value || 0)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Children</label><input type="number" min={0} max={20} value={children} onChange={e => setChildren(+e.target.value || 0)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Elderly (65+)</label><input type="number" min={0} max={20} value={elderly} onChange={e => setElderly(+e.target.value || 0)} style={inputStyle} /></div>
          </div>
        )}
        <div>
          <label style={labelStyle}>Activity level during emergency</label>
          <select value={activity} onChange={e => setActivity(e.target.value as typeof activity)} style={inputStyle}>
            <option value="sedentary">Sedentary (sheltering in place)</option>
            <option value="light">Light (minimal movement)</option>
            <option value="moderate">Moderate (evacuating, setting up camp)</option>
            <option value="heavy">Heavy (physical labor, rescue work)</option>
          </select>
        </div>
        <div style={{ padding: '12px 14px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '12px', color: '#93C5FD', lineHeight: 1.6 }}>
          Stress and cold increase caloric needs. Round up rather than down.
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Daily needs</div>
        {resultRow('Per adult', `${adultCals.toLocaleString()} cal`)}
        {children > 0 && resultRow('Per child', `${childCals.toLocaleString()} cal`)}
        {elderly > 0 && resultRow('Per elderly adult', `${elderlyCals.toLocaleString()} cal`)}
        {resultRow('Household total / day', `${dailyTotal.toLocaleString()} cal`, true)}
        <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Storage targets</div>
        {resultRow('72-hour kit', `${cal72h.toLocaleString()} cal`)}
        {resultRow('2-week supply', `${cal2wk.toLocaleString()} cal`)}
        {resultRow('30-day supply', `${cal30d.toLocaleString()} cal`)}
        <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>30-day food estimate</div>
        {resultRow('White rice (lbs)', `~${lbsRice30} lbs`)}
        {resultRow('Dried beans (lbs)', `~${lbsBeans30} lbs`)}
        {resultRow('Oats (lbs)', `~${lbsOats30} lbs`)}
      </div>
    </div>
  )
}

// ─── Inventory Manager ────────────────────────────────────────────────────────

type KitType = 'edc' | 'bob' | 'ghb' | 'inch' | 'vehicle' | 'home_cache' | 'ifak' | 'trauma' | 'med_kit' | 'comms' | 'power_cache' | 'custom'

const KIT_META: Record<KitType, { label: string; color: string; short: string }> = {
  edc:         { label: 'Everyday Carry',  color: '#3B82F6', short: 'EDC' },
  bob:         { label: 'Bug Out Bag',     color: '#F59E0B', short: 'BOB' },
  ghb:         { label: 'Get Home Bag',    color: '#EAB308', short: 'GHB' },
  inch:        { label: 'INCH Bag',        color: '#EF4444', short: 'INCH' },
  vehicle:     { label: 'Vehicle Cache',   color: '#6B7280', short: 'VEH' },
  home_cache:  { label: 'Home Cache',      color: '#22C55E', short: 'HOME' },
  ifak:        { label: 'IFAK',            color: '#F87171', short: 'IFAK' },
  trauma:      { label: 'Trauma Kit',      color: '#DC2626', short: 'TRAUMA' },
  med_kit:     { label: 'Med Kit',         color: '#EC4899', short: 'MED' },
  comms:       { label: 'Comms Kit',       color: '#8B5CF6', short: 'COMMS' },
  power_cache: { label: 'Power Cache',     color: '#FBBF24', short: 'PWR' },
  custom:      { label: 'Custom Kit',      color: '#94A3B8', short: 'CUSTOM' },
}

interface Kit {
  id: string; name: string; type: KitType; purpose?: string
  location_label?: string; weight_limit_g?: number; budget_cents?: number; notes?: string
  item_count?: number; total_weight_g?: number; total_cost_cents?: number
  // Who this specific cache is sized for. Deliberately per-kit, not a single
  // site-wide setting: a GHB is usually sized for one person getting home,
  // a Home Cache for the whole household, and those numbers shouldn't fight
  // each other.
  household_people: number; household_pets: number; household_days: number
}
interface KitItem {
  id: string; kit_id: string; template_id?: string | null; name: string; category: string
  qty: number; par: number; unit: string; weight_g?: number | null; cost_cents?: number | null
  expiry?: string | null; note?: string | null; storage_location?: string | null
}
interface Household { people: number; pets: number; days: number }
interface CatalogItem {
  id: string; name: string; category: string; unit: string; defaultPar: number
  tags: KitType[]; suggest?: (h: Household) => number
}

const ITEM_CATALOG: CatalogItem[] = [
  // Water
  { id: 'w_bottle',    name: 'Water bottle (32oz+)',              category: 'Water',        unit: 'units',    defaultPar: 1,  tags: ['edc','ghb','bob'],                                             suggest: h => h.people },
  { id: 'w_water3',    name: '3L drinking water',                 category: 'Water',        unit: 'liters',   defaultPar: 3,  tags: ['bob','ghb'],                                                   suggest: h => h.people * 3 },
  { id: 'w_stored',    name: 'Stored water',                      category: 'Water',        unit: 'gallons',  defaultPar: 14, tags: ['home_cache','inch'],                                            suggest: h => h.people * h.days },
  { id: 'w_filter_s',  name: 'Water filter (LifeStraw / straw)',  category: 'Water',        unit: 'units',    defaultPar: 1,  tags: ['edc','bob','ghb','inch','vehicle'],                             suggest: h => h.people },
  { id: 'w_filter_g',  name: 'Water filter (gravity/pump)',       category: 'Water',        unit: 'units',    defaultPar: 1,  tags: ['home_cache','inch','bob'] },
  { id: 'w_tabs',      name: 'Water purification tablets',        category: 'Water',        unit: 'packs',    defaultPar: 2,  tags: ['edc','bob','ghb','inch','vehicle','home_cache'] },
  { id: 'w_bleach',    name: 'Unscented bleach',                  category: 'Water',        unit: 'bottles',  defaultPar: 2,  tags: ['home_cache','inch'] },
  // Food
  { id: 'f_bars',      name: 'Emergency food bars (3-day)',       category: 'Food',         unit: 'bars',     defaultPar: 6,  tags: ['bob','ghb','vehicle'],                                         suggest: h => h.people * 6 },
  { id: 'f_snacks',    name: 'High-calorie snacks / trail mix',   category: 'Food',         unit: 'lbs',      defaultPar: 2,  tags: ['bob','ghb','vehicle'],                                         suggest: h => Math.ceil(h.people * 1.5) },
  { id: 'f_fd',        name: 'Freeze-dried meals',                category: 'Food',         unit: 'meals',    defaultPar: 30, tags: ['bob','home_cache','inch'],                                      suggest: h => h.people * h.days },
  { id: 'f_canned',    name: 'Canned goods (assorted)',           category: 'Food',         unit: 'cans',     defaultPar: 50, tags: ['home_cache','inch'],                                            suggest: h => h.people * h.days * 2 },
  { id: 'f_rice',      name: 'White rice',                        category: 'Food',         unit: 'lbs',      defaultPar: 20, tags: ['home_cache','inch'],                                            suggest: h => Math.round(h.people * h.days * 0.5) },
  { id: 'f_beans',     name: 'Dried beans / lentils',             category: 'Food',         unit: 'lbs',      defaultPar: 10, tags: ['home_cache','inch'],                                            suggest: h => Math.round(h.people * h.days * 0.25) },
  { id: 'f_oats',      name: 'Rolled oats',                       category: 'Food',         unit: 'lbs',      defaultPar: 10, tags: ['home_cache','inch'],                                            suggest: h => Math.round(h.people * h.days * 0.2) },
  { id: 'f_vitamins',  name: 'Multivitamins',                     category: 'Food',         unit: 'bottles',  defaultPar: 2,  tags: ['bob','home_cache','inch'],                                      suggest: h => h.people },
  { id: 'f_opener',    name: 'Manual can opener',                 category: 'Food',         unit: 'units',    defaultPar: 2,  tags: ['bob','home_cache','vehicle'] },
  { id: 'f_stove',     name: 'Camp stove',                        category: 'Food',         unit: 'units',    defaultPar: 1,  tags: ['bob','home_cache','inch','vehicle'] },
  { id: 'f_fuel',      name: 'Fuel canisters / propane',          category: 'Food',         unit: 'canisters',defaultPar: 4,  tags: ['bob','home_cache','vehicle'],                                   suggest: h => Math.ceil(h.people * h.days / 10) },
  { id: 'f_utensils',  name: 'Camp eating utensils',              category: 'Food',         unit: 'sets',     defaultPar: 1,  tags: ['bob','home_cache','inch'],                                      suggest: h => h.people },
  // Shelter & Clothing
  { id: 'sh_mylar',    name: 'Emergency mylar blanket',           category: 'Shelter',      unit: 'units',    defaultPar: 1,  tags: ['edc','bob','ghb','vehicle'],                                   suggest: h => h.people },
  { id: 'sh_tent',     name: 'Tent (sized for household)',        category: 'Shelter',      unit: 'units',    defaultPar: 1,  tags: ['bob','inch'] },
  { id: 'sh_tarp',     name: 'Heavy-duty tarp',                   category: 'Shelter',      unit: 'units',    defaultPar: 2,  tags: ['bob','home_cache','inch','vehicle'] },
  { id: 'sh_plastic',  name: 'Heavy-duty plastic sheeting',       category: 'Shelter',      unit: 'rolls',    defaultPar: 1,  tags: ['home_cache','inch'] },
  { id: 'sh_sleeping', name: 'Sleeping bag (season-appropriate)', category: 'Bedding',      unit: 'units',    defaultPar: 1,  tags: ['bob','inch','home_cache','vehicle'],                            suggest: h => h.people },
  { id: 'sh_pad',      name: 'Sleeping pad',                      category: 'Bedding',      unit: 'units',    defaultPar: 1,  tags: ['bob','inch'],                                                   suggest: h => h.people },
  { id: 'sh_blanket',  name: 'Wool / fleece blanket',             category: 'Bedding',      unit: 'units',    defaultPar: 2,  tags: ['home_cache','vehicle'],                                         suggest: h => h.people * 2 },
  { id: 'sh_poncho',   name: 'Rain poncho',                       category: 'Clothing',     unit: 'units',    defaultPar: 1,  tags: ['edc','bob','ghb','vehicle'],                                   suggest: h => h.people },
  { id: 'sh_rain_j',   name: 'Waterproof rain jacket',            category: 'Clothing',     unit: 'units',    defaultPar: 1,  tags: ['bob','inch','home_cache'],                                      suggest: h => h.people },
  { id: 'sh_boots',    name: 'Waterproof work boots',             category: 'Clothing',     unit: 'pairs',    defaultPar: 1,  tags: ['bob','inch'],                                                   suggest: h => h.people },
  { id: 'sh_layers',   name: 'Cold weather base layers',          category: 'Clothing',     unit: 'sets',     defaultPar: 2,  tags: ['bob','inch','home_cache','vehicle'],                            suggest: h => h.people * 2 },
  { id: 'sh_gloves_w', name: 'Winter gloves',                     category: 'Clothing',     unit: 'pairs',    defaultPar: 1,  tags: ['home_cache','bob','vehicle'],                                   suggest: h => h.people },
  { id: 'sh_hat',      name: 'Warm hat / balaclava',              category: 'Clothing',     unit: 'units',    defaultPar: 1,  tags: ['home_cache','bob','vehicle'],                                   suggest: h => h.people },
  // Medical - General
  { id: 'm_fak',       name: 'Basic first aid kit',               category: 'Medical',      unit: 'kits',     defaultPar: 1,  tags: ['edc','ghb','bob','vehicle','home_cache'] },
  { id: 'm_gauze',     name: 'Gauze pads (assorted)',             category: 'Wound Care',   unit: 'packs',    defaultPar: 5,  tags: ['bob','med_kit','home_cache','ifak','trauma','vehicle'] },
  { id: 'm_bandages',  name: 'Adhesive bandages (assorted)',      category: 'Wound Care',   unit: 'boxes',    defaultPar: 3,  tags: ['edc','bob','ghb','med_kit','home_cache','vehicle'] },
  { id: 'm_wrap',      name: 'Elastic bandage wrap',              category: 'Wound Care',   unit: 'rolls',    defaultPar: 4,  tags: ['bob','med_kit','home_cache','ifak','trauma'] },
  { id: 'm_tape',      name: 'Medical tape',                      category: 'Wound Care',   unit: 'rolls',    defaultPar: 3,  tags: ['bob','med_kit','ifak','trauma','home_cache','vehicle'] },
  { id: 'm_tourniquet',name: 'Tourniquet (CAT or SOFTT-W)',       category: 'Wound Care',   unit: 'units',    defaultPar: 2,  tags: ['edc','bob','ghb','ifak','trauma','med_kit','home_cache'],      suggest: h => Math.max(2, h.people) },
  { id: 'm_pressure',  name: 'Pressure dressing (Israeli)',       category: 'Wound Care',   unit: 'units',    defaultPar: 2,  tags: ['bob','ifak','trauma','med_kit'] },
  { id: 'm_antiseptic',name: 'Antiseptic wipes / solution',       category: 'Wound Care',   unit: 'packs',    defaultPar: 3,  tags: ['edc','bob','ghb','med_kit','ifak','home_cache','vehicle'] },
  { id: 'm_ibuprofen', name: 'Ibuprofen / Advil',                 category: 'Medications',  unit: 'bottles',  defaultPar: 2,  tags: ['bob','med_kit','home_cache','vehicle'],                         suggest: h => h.people },
  { id: 'm_tylenol',   name: 'Acetaminophen / Tylenol',           category: 'Medications',  unit: 'bottles',  defaultPar: 2,  tags: ['bob','med_kit','home_cache','vehicle'],                         suggest: h => h.people },
  { id: 'm_antihist',  name: 'Antihistamine (Benadryl)',          category: 'Medications',  unit: 'boxes',    defaultPar: 2,  tags: ['bob','med_kit','home_cache'] },
  { id: 'm_antidiarr', name: 'Antidiarrheal (Imodium)',           category: 'Medications',  unit: 'packs',    defaultPar: 2,  tags: ['bob','med_kit','home_cache'] },
  { id: 'm_antacid',   name: 'Antacid (Tums / Pepto)',            category: 'Medications',  unit: 'bottles',  defaultPar: 2,  tags: ['bob','med_kit','home_cache'] },
  { id: 'm_rx',        name: 'Prescription medications (30d+)',   category: 'Medications',  unit: 'supply',   defaultPar: 1,  tags: ['edc','bob','med_kit','home_cache'],                             suggest: h => h.people },
  { id: 'm_epi',       name: 'EpiPen (if prescribed)',            category: 'Medications',  unit: 'units',    defaultPar: 0,  tags: ['edc','bob','ghb','ifak'] },
  { id: 'm_gloves',    name: 'Nitrile gloves',                    category: 'Equipment',    unit: 'boxes',    defaultPar: 2,  tags: ['bob','med_kit','ifak','trauma','home_cache','vehicle'] },
  { id: 'm_cpr',       name: 'CPR face shield / mask',            category: 'Equipment',    unit: 'units',    defaultPar: 2,  tags: ['bob','med_kit','ifak','trauma','home_cache'] },
  { id: 'm_scissors',  name: 'EMT shears / medical scissors',     category: 'Equipment',    unit: 'units',    defaultPar: 1,  tags: ['bob','med_kit','ifak','trauma'] },
  { id: 'm_thermom',   name: 'Thermometer',                       category: 'Equipment',    unit: 'units',    defaultPar: 1,  tags: ['bob','med_kit','home_cache'] },
  { id: 'm_manual',    name: 'First aid reference manual / card', category: 'Equipment',    unit: 'units',    defaultPar: 1,  tags: ['bob','med_kit','ifak','trauma','home_cache'] },
  // IFAK / Trauma
  { id: 'if_hemo',     name: 'Hemostatic gauze (QuikClot/Celox)', category: 'Wound Care',   unit: 'packs',    defaultPar: 2,  tags: ['ifak','trauma','med_kit'] },
  { id: 'if_chest',    name: 'Occlusive chest seals (pair)',      category: 'Wound Care',   unit: 'pairs',    defaultPar: 2,  tags: ['ifak','trauma'] },
  { id: 'if_npa',      name: 'Nasopharyngeal airway (NPA)',       category: 'Airway',       unit: 'units',    defaultPar: 1,  tags: ['ifak','trauma'] },
  { id: 'if_npa_lube', name: 'NPA lubricant',                     category: 'Airway',       unit: 'tubes',    defaultPar: 1,  tags: ['ifak','trauma'] },
  { id: 'if_marker',   name: 'Permanent marker (tourniquet time)',category: 'Equipment',    unit: 'units',    defaultPar: 1,  tags: ['ifak','trauma'] },
  { id: 'if_triangle', name: 'Triangular bandage / sling',        category: 'Wound Care',   unit: 'units',    defaultPar: 2,  tags: ['ifak','trauma','med_kit'] },
  { id: 'if_splint',   name: 'SAM splint',                        category: 'Trauma',       unit: 'units',    defaultPar: 2,  tags: ['trauma','med_kit'] },
  { id: 'if_burn',     name: 'Burn dressing (Water-Jel)',         category: 'Wound Care',   unit: 'units',    defaultPar: 2,  tags: ['trauma','med_kit'] },
  { id: 'if_eye',      name: 'Eye shield',                        category: 'Trauma',       unit: 'units',    defaultPar: 2,  tags: ['trauma'] },
  { id: 'if_penlight', name: 'Medical penlight',                  category: 'Equipment',    unit: 'units',    defaultPar: 1,  tags: ['trauma','med_kit'] },
  { id: 'if_cric',     name: 'Needle decompression (14g angio)', category: 'Airway',       unit: 'units',    defaultPar: 2,  tags: ['trauma'] },
  // Tools & Equipment
  { id: 't_multi',     name: 'Multi-tool',                        category: 'Tools',        unit: 'units',    defaultPar: 1,  tags: ['edc','bob','ghb','vehicle','home_cache','inch'] },
  { id: 't_knife',     name: 'Fixed blade knife',                 category: 'Tools',        unit: 'units',    defaultPar: 1,  tags: ['bob','inch','home_cache','vehicle'] },
  { id: 't_pocket',    name: 'Pocket knife',                      category: 'Tools',        unit: 'units',    defaultPar: 1,  tags: ['edc','ghb'] },
  { id: 't_axe',       name: 'Hatchet / axe',                     category: 'Tools',        unit: 'units',    defaultPar: 1,  tags: ['bob','inch','home_cache'] },
  { id: 't_saw',       name: 'Folding saw',                       category: 'Tools',        unit: 'units',    defaultPar: 1,  tags: ['bob','inch'] },
  { id: 't_shovel',    name: 'Folding / entrenching shovel',      category: 'Tools',        unit: 'units',    defaultPar: 1,  tags: ['bob','inch','vehicle'] },
  { id: 't_crowbar',   name: 'Pry bar / crowbar',                 category: 'Tools',        unit: 'units',    defaultPar: 1,  tags: ['home_cache','vehicle'] },
  { id: 't_tape',      name: 'Duct tape',                         category: 'Supplies',     unit: 'rolls',    defaultPar: 3,  tags: ['bob','ghb','home_cache','vehicle','inch'] },
  { id: 't_cord',      name: 'Paracord (100 ft)',                 category: 'Supplies',     unit: 'rolls',    defaultPar: 2,  tags: ['bob','inch','home_cache'] },
  { id: 't_cord_s',    name: 'Paracord (50 ft)',                  category: 'Supplies',     unit: 'rolls',    defaultPar: 1,  tags: ['edc','ghb','bob'] },
  { id: 't_tarp',      name: 'Heavy tarp',                        category: 'Supplies',     unit: 'units',    defaultPar: 2,  tags: ['bob','home_cache','inch','vehicle'] },
  { id: 't_zip',       name: 'Zip ties (assorted)',               category: 'Supplies',     unit: 'packs',    defaultPar: 2,  tags: ['bob','home_cache','vehicle'] },
  { id: 't_wgloves',   name: 'Heavy work gloves',                 category: 'Safety',       unit: 'pairs',    defaultPar: 2,  tags: ['bob','home_cache','vehicle'],                                  suggest: h => h.people },
  { id: 't_goggles',   name: 'Safety goggles',                    category: 'Safety',       unit: 'units',    defaultPar: 1,  tags: ['bob','home_cache','vehicle'],                                  suggest: h => h.people },
  { id: 't_n95',       name: 'N95 respirators',                   category: 'Safety',       unit: 'units',    defaultPar: 20, tags: ['bob','ghb','home_cache','vehicle'],                             suggest: h => h.people * 10 },
  { id: 't_n95_s',     name: 'N95 masks (pocket, 2-3)',           category: 'Safety',       unit: 'units',    defaultPar: 3,  tags: ['edc','ghb'],                                                   suggest: h => h.people * 2 },
  // Communications
  { id: 'c_noaa',      name: 'NOAA hand-crank weather radio',     category: 'Comms',        unit: 'units',    defaultPar: 1,  tags: ['bob','home_cache','vehicle','comms'] },
  { id: 'c_walkie',    name: 'GMRS / FRS walkie talkies',         category: 'Comms',        unit: 'pairs',    defaultPar: 1,  tags: ['bob','home_cache','comms'] },
  { id: 'c_ham',       name: 'Ham radio HT (Baofeng UV-5R)',      category: 'Comms',        unit: 'units',    defaultPar: 0,  tags: ['bob','comms','inch'] },
  { id: 'c_satellite', name: 'Satellite communicator (inReach)',  category: 'Comms',        unit: 'units',    defaultPar: 0,  tags: ['bob','inch','comms'] },
  { id: 'c_whistle',   name: 'Signal whistle',                    category: 'Comms',        unit: 'units',    defaultPar: 2,  tags: ['edc','bob','ghb','vehicle'],                                   suggest: h => h.people },
  { id: 'c_mirror',    name: 'Signal mirror',                     category: 'Comms',        unit: 'units',    defaultPar: 1,  tags: ['bob','inch','comms'] },
  { id: 'c_flares',    name: 'Signal flares',                     category: 'Comms',        unit: 'units',    defaultPar: 4,  tags: ['bob','vehicle','comms'] },
  { id: 'c_bank',      name: 'Battery bank (20,000 mAh+)',        category: 'Comms',        unit: 'units',    defaultPar: 2,  tags: ['bob','ghb','comms'],                                           suggest: h => h.people },
  { id: 'c_bank_s',    name: 'Battery bank (5,000 mAh, pocket)', category: 'Comms',        unit: 'units',    defaultPar: 1,  tags: ['edc','ghb'],                                                   suggest: h => h.people },
  { id: 'c_solar',     name: 'Solar panel charger',               category: 'Comms',        unit: 'units',    defaultPar: 1,  tags: ['bob','inch','comms','power_cache'] },
  { id: 'c_cables',    name: 'USB charging cables (multi-type)', category: 'Comms',        unit: 'sets',     defaultPar: 2,  tags: ['edc','bob','ghb','comms','vehicle'] },
  { id: 'c_aa',        name: 'AA batteries',                      category: 'Comms',        unit: 'packs',    defaultPar: 4,  tags: ['bob','home_cache','comms','power_cache'] },
  { id: 'c_aaa',       name: 'AAA batteries',                     category: 'Comms',        unit: 'packs',    defaultPar: 4,  tags: ['bob','home_cache','comms','power_cache'] },
  { id: 'c_contacts',  name: 'Printed emergency contact list',   category: 'Comms',        unit: 'copies',   defaultPar: 2,  tags: ['edc','bob','ghb','comms','home_cache','vehicle'] },
  { id: 'c_plan',      name: 'Written emergency comm plan',       category: 'Comms',        unit: 'copies',   defaultPar: 2,  tags: ['bob','comms','home_cache'] },
  // Power & Lighting
  { id: 'p_headlamp',  name: 'Headlamp',                          category: 'Lighting',     unit: 'units',    defaultPar: 2,  tags: ['edc','bob','ghb','home_cache','vehicle','power_cache'],        suggest: h => h.people },
  { id: 'p_flash',     name: 'Flashlight (heavy duty)',           category: 'Lighting',     unit: 'units',    defaultPar: 2,  tags: ['bob','home_cache','vehicle','power_cache'] },
  { id: 'p_lantern',   name: 'LED lantern',                       category: 'Lighting',     unit: 'units',    defaultPar: 2,  tags: ['bob','home_cache','power_cache'] },
  { id: 'p_candles',   name: 'Candles',                           category: 'Lighting',     unit: 'units',    defaultPar: 20, tags: ['home_cache'] },
  { id: 'p_lighter',   name: 'Lighter',                           category: 'Fire',         unit: 'units',    defaultPar: 3,  tags: ['edc','bob','ghb','home_cache','vehicle'] },
  { id: 'p_matches',   name: 'Waterproof matches',                category: 'Fire',         unit: 'boxes',    defaultPar: 3,  tags: ['bob','ghb','home_cache'] },
  { id: 'p_ferro',     name: 'Ferro rod / fire starter',          category: 'Fire',         unit: 'units',    defaultPar: 2,  tags: ['bob','inch','home_cache'] },
  { id: 'p_station',   name: 'Portable power station (1000Wh+)', category: 'Power',        unit: 'units',    defaultPar: 0,  tags: ['home_cache','power_cache'] },
  { id: 'p_solar_a',   name: 'Solar panel array (100W+)',         category: 'Power',        unit: 'units',    defaultPar: 0,  tags: ['home_cache','power_cache'] },
  { id: 'p_generator', name: 'Generator (gas or dual-fuel)',      category: 'Power',        unit: 'units',    defaultPar: 0,  tags: ['home_cache','power_cache'] },
  { id: 'p_gas',       name: 'Gas cans (Sta-Bil treated)',        category: 'Power',        unit: 'gallons',  defaultPar: 0,  tags: ['home_cache','vehicle','power_cache'] },
  { id: 'p_ext',       name: 'Heavy-duty extension cord',         category: 'Power',        unit: 'units',    defaultPar: 1,  tags: ['home_cache','power_cache'] },
  // Documents
  { id: 'd_passport',  name: 'Passports',                         category: 'Documents',    unit: 'units',    defaultPar: 1,  tags: ['bob','ghb','inch'],                                            suggest: h => h.people },
  { id: 'd_id',        name: "Driver's license / gov ID copies",  category: 'Documents',    unit: 'copies',   defaultPar: 2,  tags: ['edc','bob','ghb','home_cache'],                                suggest: h => h.people * 2 },
  { id: 'd_birth',     name: 'Birth certificates',                category: 'Documents',    unit: 'units',    defaultPar: 1,  tags: ['bob','inch','home_cache'],                                      suggest: h => h.people },
  { id: 'd_insurance', name: 'Insurance documents',               category: 'Documents',    unit: 'sets',     defaultPar: 1,  tags: ['bob','home_cache'] },
  { id: 'd_cash',      name: 'Cash (small bills)',                category: 'Documents',    unit: 'dollars',  defaultPar: 200,tags: ['edc','bob','ghb','vehicle','home_cache'] },
  { id: 'd_usb',       name: 'USB drive with digital doc copies', category: 'Documents',    unit: 'units',    defaultPar: 2,  tags: ['bob','home_cache','inch'] },
  { id: 'd_maps',      name: 'Paper maps (local + regional)',     category: 'Documents',    unit: 'sets',     defaultPar: 1,  tags: ['bob','ghb','vehicle','home_cache'] },
  { id: 'd_evac',      name: 'Evacuation plan + rally points',    category: 'Documents',    unit: 'copies',   defaultPar: 2,  tags: ['bob','home_cache'] },
  { id: 'd_medical',   name: 'Medical records / vaccination history',category:'Documents',  unit: 'copies',   defaultPar: 1,  tags: ['bob','inch','home_cache'],                                      suggest: h => h.people },
  // Hygiene & Sanitation
  { id: 'hy_sanitizer',name: 'Hand sanitizer',                   category: 'Hygiene',      unit: 'bottles',  defaultPar: 4,  tags: ['edc','bob','ghb','home_cache','vehicle'],                       suggest: h => h.people * 2 },
  { id: 'hy_wipes',    name: 'Wet wipes',                         category: 'Hygiene',      unit: 'packs',    defaultPar: 2,  tags: ['edc','bob','ghb','home_cache','vehicle'] },
  { id: 'hy_soap',     name: 'Soap (bar or liquid)',              category: 'Hygiene',      unit: 'units',    defaultPar: 6,  tags: ['bob','home_cache'],                                             suggest: h => h.people * 2 },
  { id: 'hy_toilet',   name: 'Emergency toilet / sanitation bucket',category:'Sanitation',  unit: 'units',    defaultPar: 1,  tags: ['home_cache'] },
  { id: 'hy_bags',     name: 'Waste bags (for emergency toilet)', category: 'Sanitation',   unit: 'boxes',    defaultPar: 2,  tags: ['home_cache'] },
  // Vehicle-specific
  { id: 'v_jumper',    name: 'Jumper cables',                     category: 'Vehicle',      unit: 'sets',     defaultPar: 1,  tags: ['vehicle'] },
  { id: 'v_tire',      name: 'Tire repair kit',                   category: 'Vehicle',      unit: 'kits',     defaultPar: 1,  tags: ['vehicle'] },
  { id: 'v_triangles', name: 'Reflective triangles / road flares',category: 'Vehicle',      unit: 'sets',     defaultPar: 1,  tags: ['vehicle'] },
  { id: 'v_tow',       name: 'Tow strap',                         category: 'Vehicle',      unit: 'units',    defaultPar: 1,  tags: ['vehicle'] },
  { id: 'v_extinguisher',name:'Fire extinguisher',                category: 'Vehicle',      unit: 'units',    defaultPar: 1,  tags: ['vehicle','home_cache'] },
  { id: 'v_scraper',   name: 'Ice scraper / snow shovel',         category: 'Vehicle',      unit: 'units',    defaultPar: 1,  tags: ['vehicle'] },
  { id: 'v_tools',     name: 'Basic car tools (wrench, pliers)',  category: 'Vehicle',      unit: 'sets',     defaultPar: 1,  tags: ['vehicle'] },
  { id: 'v_gas_can',   name: 'Jerry can (extra fuel)',            category: 'Vehicle',      unit: 'gallons',  defaultPar: 5,  tags: ['vehicle'] },
  { id: 'v_warmers',   name: 'Hand / body warmers',               category: 'Vehicle',      unit: 'packs',    defaultPar: 10, tags: ['vehicle'] },
  // EDC-specific
  { id: 'e_pen',       name: 'Pen + small notepad',               category: 'EDC',          unit: 'units',    defaultPar: 1,  tags: ['edc'] },
  { id: 'e_keylight',  name: 'Key ring flashlight',               category: 'EDC',          unit: 'units',    defaultPar: 1,  tags: ['edc'] },
  { id: 'e_watch',     name: 'Analog watch (no battery)',         category: 'EDC',          unit: 'units',    defaultPar: 1,  tags: ['edc'] },
  // Pets
  { id: 'pe_food',     name: 'Pet food (7-day supply)',           category: 'Pets',         unit: 'lbs',      defaultPar: 0,  tags: ['bob','ghb','home_cache','vehicle'],                             suggest: h => h.pets > 0 ? h.pets * 7 : 0 },
  { id: 'pe_water',    name: 'Pet water (daily supply)',          category: 'Pets',         unit: 'gallons',  defaultPar: 0,  tags: ['bob','home_cache'],                                             suggest: h => h.pets > 0 ? h.pets * h.days : 0 },
  { id: 'pe_carrier',  name: 'Pet carrier / crate',               category: 'Pets',         unit: 'units',    defaultPar: 0,  tags: ['bob','vehicle'],                                                suggest: h => h.pets },
  { id: 'pe_leash',    name: 'Leash + collar + ID tag',           category: 'Pets',         unit: 'sets',     defaultPar: 0,  tags: ['edc','bob','ghb','vehicle'],                                   suggest: h => h.pets },
  { id: 'pe_records',  name: 'Vet records / vaccination proof',   category: 'Pets',         unit: 'copies',   defaultPar: 0,  tags: ['bob','home_cache'],                                             suggest: h => h.pets },
]

const SC = { ok: '#22C55E', low: '#F59E0B', out: '#EF4444' }

function invStatus(qty: number, par: number): 'ok' | 'low' | 'out' {
  if (qty === 0) return 'out'
  if (par > 0 && qty < par) return 'low'
  return 'ok'
}

function kitReadiness(items: KitItem[]): number {
  const withPar = items.filter(i => i.par > 0)
  if (withPar.length === 0) return items.length > 0 ? 100 : 0
  const ok = withPar.filter(i => i.qty >= i.par).length
  return Math.round((ok / withPar.length) * 100)
}

function fmtWeight(g: number): string {
  return g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`
}

// Not the household for any particular kit (that's per-kit now, on the kit
// itself), just what to seed a brand-new kit's household with, so you're
// not re-typing "2 people, 14 days" every time you create one.
function loadDefaultHousehold(): Household {
  try { const v = localStorage.getItem('fenris_household'); return v ? JSON.parse(v) : { people: 2, pets: 0, days: 14 } } catch { return { people: 2, pets: 0, days: 14 } }
}
function saveDefaultHousehold(h: Household): void {
  try { localStorage.setItem('fenris_household', JSON.stringify(h)) } catch {}
}
function loadLocalKits(): Kit[] {
  try { const v = localStorage.getItem('fenris_kits'); return v ? JSON.parse(v) : [] } catch { return [] }
}
function saveLocalKits(kits: Kit[]): void {
  try { localStorage.setItem('fenris_kits', JSON.stringify(kits)) } catch {}
}
function loadLocalItems(kitId: string): KitItem[] {
  try { const v = localStorage.getItem(`fenris_kit_items_${kitId}`); return v ? JSON.parse(v) : [] } catch { return [] }
}
function saveLocalItems(kitId: string, items: KitItem[]): void {
  try { localStorage.setItem(`fenris_kit_items_${kitId}`, JSON.stringify(items)) } catch {}
}
function removeLocalItems(kitId: string): void {
  try { localStorage.removeItem(`fenris_kit_items_${kitId}`) } catch {}
}

// Per-kit-type context: water and food targets for the caches that are
// meant to sustain a household, plus the documents checklist for the one
// kit type people actually keep documents in, plus the generator
// calculator for the one kit type it applies to. Everything reads the
// same household numbers Inventory Manager already tracks.
const SUSTAINMENT_TYPES: KitType[] = ['home_cache', 'bob', 'ghb', 'inch']

function KitTargetsPanel({ h }: { h: Household }) {
  const { totalGallons } = computeWaterTargets(h.people, h.pets, h.days, false, false)
  const { dailyTotal } = computeCalorieTargets(h.people, 0, 0, 'moderate')
  const totalCalories = dailyTotal * h.days
  return (
    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', padding: '14px 16px', borderRadius: '8px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)', marginBottom: '20px' }}>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: '#93C5FD' }}>{totalGallons} gal</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Water target</div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700, color: '#93C5FD' }}>{totalCalories.toLocaleString()} cal</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>Food target</div>
      </div>
      <div style={{ marginLeft: 'auto', alignSelf: 'center', fontFamily: 'var(--font-body)', fontSize: '11px', color: 'var(--color-subtle)', maxWidth: '260px' }}>
        For {h.people} people{h.pets > 0 ? `, ${h.pets} pets` : ''} over {h.days} days. Estimate at moderate activity, no heat adjustment. Adjust household size above.
      </div>
    </div>
  )
}

function CollapsiblePanel({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ marginBottom: '20px' }}>
      <button onClick={() => setOpen(v => !v)} style={{
        display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left',
        padding: '10px 14px', borderRadius: '8px', cursor: 'pointer',
        border: '1px solid var(--color-border)', background: open ? 'var(--color-bg)' : 'transparent',
        color: 'var(--color-text)', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600,
      }}>
        <span style={{ color: 'var(--color-accent)', fontSize: '11px' }}>{open ? '▾' : '▸'}</span>
        {label}
      </button>
      {open && (
        <div style={{ padding: '18px', border: '1px solid var(--color-border)', borderTop: 'none', borderRadius: '0 0 8px 8px' }}>
          {children}
        </div>
      )}
    </div>
  )
}

function InventoryManager({ typeFilter }: { typeFilter?: KitType | null } = {}) {
  const isMobile = useIsMobile()
  const { user } = useAuth()

  const [kits, setKits] = useState<Kit[]>([])
  const [activeKitId, setActiveKitId] = useState<string | null>(null)
  const [kitItemsMap, setKitItemsMap] = useState<Record<string, KitItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [creatingKit, setCreatingKit] = useState(false)
  const [showNewKit, setShowNewKit] = useState(false)
  const [newKitForm, setNewKitForm] = useState({ name: '', type: 'bob' as KitType, location_label: '' })
  const [filterCat, setFilterCat] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalogSearch, setCatalogSearch] = useState('')
  const [catalogCat, setCatalogCat] = useState('')
  const [catalogKitOnly, setCatalogKitOnly] = useState(true)
  const [addedInCatalog, setAddedInCatalog] = useState<Set<string>>(new Set())
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandBuf, setExpandBuf] = useState<Partial<KitItem & { cost_str: string; weight_str: string }>>({})
  const [showCustom, setShowCustom] = useState(false)
  const [customForm, setCustomForm] = useState({ name: '', category: '', qty: '0', par: '0', unit: '', note: '', storage_location: '', expiry: '' })
  const [showHousehold, setShowHousehold] = useState(false)
  const [confirmDeleteKit, setConfirmDeleteKit] = useState<string | null>(null)
  const [suggestDone, setSuggestDone] = useState(false)

  const activeKit = kits.find(k => k.id === activeKitId) ?? null
  const visibleKits = typeFilter ? kits.filter(k => k.type === typeFilter) : kits
  const items = activeKitId ? (kitItemsMap[activeKitId] ?? []) : []
  const today = new Date().toISOString().slice(0, 10)

  // Jumping between cache tabs: auto-open the one kit of that type if
  // there's exactly one, otherwise fall back to the (filtered) list, and
  // don't leave a kit from a different type showing under this tab.
  useEffect(() => {
    if (!typeFilter) return
    const matching = kits.filter(k => k.type === typeFilter)
    if (matching.length === 1) {
      setActiveKitId(matching[0].id)
    } else if (activeKitId && !matching.some(k => k.id === activeKitId)) {
      setActiveKitId(null)
    }
  }, [typeFilter, kits]) // eslint-disable-line react-hooks/exhaustive-deps
  const soonDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  // This cache's own household, not a site-wide one: a GHB and a Home
  // Cache can genuinely be sized for different numbers of people.
  const h: Household = activeKit
    ? { people: activeKit.household_people || 2, pets: activeKit.household_pets || 0, days: activeKit.household_days || 14 }
    : { people: 2, pets: 0, days: 14 }

  // Load kits on mount / user change
  useEffect(() => {
    async function load() {
      setLoading(true)
      if (user) {
        try {
          const res = await fetch('/api/inventory/kits', { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            const mapped = data.map((k: any) => ({ ...k, id: String(k.id) }))
            setKits(mapped)
            saveLocalKits(mapped)
            setLoading(false)
            return
          }
        } catch {}
      }
      setKits(loadLocalKits())
      setLoading(false)
    }
    load()
  }, [user])

  // Load items when opening a kit
  useEffect(() => {
    if (!activeKitId) return
    if (kitItemsMap[activeKitId] !== undefined) return
    async function loadItems() {
      if (user && !activeKitId!.startsWith('local_')) {
        try {
          const res = await fetch(`/api/inventory/kits/${activeKitId}/items`, { credentials: 'include' })
          if (res.ok) {
            const data = await res.json()
            const mapped = data.map((i: any) => ({ ...i, id: String(i.id), kit_id: String(i.kit_id), qty: Number(i.qty), par: Number(i.par) }))
            setKitItemsMap(prev => ({ ...prev, [activeKitId!]: mapped }))
            saveLocalItems(activeKitId!, mapped)
            return
          }
        } catch {}
      }
      setKitItemsMap(prev => ({ ...prev, [activeKitId!]: loadLocalItems(activeKitId!) }))
    }
    loadItems()
  }, [activeKitId, user])

  async function createKit() {
    if (!newKitForm.name.trim()) return
    setCreatingKit(true)
    const seedHousehold = loadDefaultHousehold()
    const payload = {
      name: newKitForm.name.trim(), type: newKitForm.type, location_label: newKitForm.location_label.trim() || undefined,
      household_people: seedHousehold.people, household_pets: seedHousehold.pets, household_days: seedHousehold.days,
    }
    if (user) {
      try {
        const res = await fetch('/api/inventory/kits', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          const real = await res.json()
          const newKit: Kit = { ...payload, id: String(real.id), item_count: 0 }
          setKits(prev => { const next = [...prev, newKit]; saveLocalKits(next); return next })
          setKitItemsMap(prev => ({ ...prev, [String(real.id)]: [] }))
          setShowNewKit(false)
          setNewKitForm({ name: '', type: 'bob', location_label: '' })
          setCreatingKit(false)
          setActiveKitId(String(real.id))
          return
        }
      } catch {}
    }
    const tempId = `local_${Date.now()}`
    const newKit: Kit = { ...payload, id: tempId, item_count: 0 }
    setKits(prev => { const next = [...prev, newKit]; saveLocalKits(next); return next })
    setKitItemsMap(prev => ({ ...prev, [tempId]: [] }))
    setShowNewKit(false)
    setNewKitForm({ name: '', type: 'bob', location_label: '' })
    setCreatingKit(false)
    setActiveKitId(tempId)
  }

  async function deleteKit(kitId: string) {
    const nextKits = kits.filter(k => k.id !== kitId)
    setKits(nextKits)
    saveLocalKits(nextKits)
    setKitItemsMap(prev => { const n = { ...prev }; delete n[kitId]; return n })
    removeLocalItems(kitId)
    if (activeKitId === kitId) setActiveKitId(null)
    setConfirmDeleteKit(null)
    if (user && !kitId.startsWith('local_')) {
      try { await fetch(`/api/inventory/kits/${kitId}`, { method: 'DELETE', credentials: 'include' }) } catch {}
    }
  }

  async function updateKit(kitId: string, changes: Partial<Kit>) {
    setKits(prev => { const next = prev.map(k => k.id === kitId ? { ...k, ...changes } : k); saveLocalKits(next); return next })
    if (user && !kitId.startsWith('local_')) {
      try {
        await fetch(`/api/inventory/kits/${kitId}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        })
      } catch {}
    }
  }

  // Household edits fire on every keystroke for a responsive target display,
  // but only get persisted (and remembered as the default for the next new
  // kit) after a short pause, same debounce pattern as the dashboard layout.
  // Pending changes accumulate per kit rather than just keeping the latest
  // call's delta, so editing people then pets within the same pause doesn't
  // drop the first field from what actually gets saved.
  const householdSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const pendingHouseholdChanges = useRef<Record<string, Partial<Pick<Kit, 'household_people' | 'household_pets' | 'household_days'>>>>({})
  function updateKitHousehold(kitId: string, changes: Partial<Pick<Kit, 'household_people' | 'household_pets' | 'household_days'>>) {
    setKits(prev => prev.map(k => k.id === kitId ? { ...k, ...changes } : k))
    pendingHouseholdChanges.current[kitId] = { ...pendingHouseholdChanges.current[kitId], ...changes }
    if (householdSaveTimers.current[kitId]) clearTimeout(householdSaveTimers.current[kitId])
    householdSaveTimers.current[kitId] = setTimeout(() => {
      const toSave = pendingHouseholdChanges.current[kitId]
      delete pendingHouseholdChanges.current[kitId]
      if (!toSave) return
      updateKit(kitId, toSave)
      setKits(prev => {
        const kit = prev.find(k => k.id === kitId)
        if (kit) saveDefaultHousehold({ people: kit.household_people, pets: kit.household_pets, days: kit.household_days })
        return prev
      })
    }, 500)
  }

  async function addItem(item: Omit<KitItem, 'id' | 'kit_id'>) {
    if (!activeKitId) return
    const tempId = `item_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const newItem: KitItem = { ...item, id: tempId, kit_id: activeKitId }
    setKitItemsMap(prev => ({ ...prev, [activeKitId]: [...(prev[activeKitId] ?? []), newItem] }))
    setKits(prev => prev.map(k => k.id === activeKitId ? { ...k, item_count: (k.item_count ?? 0) + 1 } : k))
    if (user && !activeKitId.startsWith('local_')) {
      try {
        const res = await fetch(`/api/inventory/kits/${activeKitId}/items`, {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        })
        if (res.ok) {
          const real = await res.json()
          const realItem: KitItem = { ...newItem, id: String(real.id), qty: Number(real.qty), par: Number(real.par) }
          setKitItemsMap(prev => ({
            ...prev,
            [activeKitId]: (prev[activeKitId] ?? []).map(i => i.id === tempId ? realItem : i),
          }))
          const latest = (kitItemsMap[activeKitId] ?? []).map(i => i.id === tempId ? realItem : i)
          saveLocalItems(activeKitId, latest)
          return
        }
      } catch {}
    }
    const latest = [...(kitItemsMap[activeKitId] ?? []), newItem]
    saveLocalItems(activeKitId, latest)
  }

  async function updateItem(itemId: string, changes: Partial<KitItem>) {
    if (!activeKitId) return
    const updated = (kitItemsMap[activeKitId] ?? []).map(i => i.id === itemId ? { ...i, ...changes } : i)
    setKitItemsMap(prev => ({ ...prev, [activeKitId]: updated }))
    saveLocalItems(activeKitId, updated)
    if (user && !itemId.startsWith('item_') && !activeKitId.startsWith('local_')) {
      try {
        await fetch(`/api/inventory/items/${itemId}`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(changes),
        })
      } catch {}
    }
  }

  async function removeItem(itemId: string) {
    if (!activeKitId) return
    const updated = (kitItemsMap[activeKitId] ?? []).filter(i => i.id !== itemId)
    setKitItemsMap(prev => ({ ...prev, [activeKitId]: updated }))
    setKits(prev => prev.map(k => k.id === activeKitId ? { ...k, item_count: Math.max(0, (k.item_count ?? 1) - 1) } : k))
    saveLocalItems(activeKitId, updated)
    if (user && !itemId.startsWith('item_') && !activeKitId.startsWith('local_')) {
      try { await fetch(`/api/inventory/items/${itemId}`, { method: 'DELETE', credentials: 'include' }) } catch {}
    }
  }

  async function addFromCatalog(catalogId: string) {
    const tmpl = ITEM_CATALOG.find(c => c.id === catalogId)
    if (!tmpl) return
    const par = tmpl.suggest ? tmpl.suggest(h) : tmpl.defaultPar
    await addItem({ template_id: catalogId, name: tmpl.name, category: tmpl.category, qty: 0, par, unit: tmpl.unit })
    setAddedInCatalog(prev => new Set([...prev, catalogId]))
  }

  async function suggestBuild() {
    if (!activeKit) return
    const existingTemplateIds = new Set(items.map(i => i.template_id).filter(Boolean))
    const suggested = ITEM_CATALOG.filter(c => c.tags.includes(activeKit.type) && !existingTemplateIds.has(c.id))
    let added = 0
    for (const tmpl of suggested) {
      const par = tmpl.suggest ? tmpl.suggest(h) : tmpl.defaultPar
      if (par === 0) continue
      await addItem({ template_id: tmpl.id, name: tmpl.name, category: tmpl.category, qty: 0, par, unit: tmpl.unit })
      added++
    }
    if (added > 0) { setSuggestDone(true); setTimeout(() => setSuggestDone(false), 2500) }
  }

  function adjustQty(itemId: string, delta: number) {
    const item = items.find(i => i.id === itemId)
    if (!item) return
    updateItem(itemId, { qty: Math.max(0, Number(item.qty) + delta) })
  }

  function openExpand(item: KitItem) {
    setExpandedId(expandedId === item.id ? null : item.id)
    setExpandBuf({
      ...item,
      cost_str: item.cost_cents ? String(item.cost_cents / 100) : '',
      weight_str: item.weight_g ? String(item.weight_g) : '',
    })
  }

  function saveExpand(itemId: string) {
    const costCents = expandBuf.cost_str ? Math.round(parseFloat(expandBuf.cost_str as string) * 100) || null : null
    const weightG = expandBuf.weight_str ? parseInt(expandBuf.weight_str as string) || null : null
    updateItem(itemId, {
      note: expandBuf.note ?? null,
      storage_location: expandBuf.storage_location ?? null,
      expiry: expandBuf.expiry ?? null,
      cost_cents: costCents,
      weight_g: weightG,
    })
    setExpandedId(null)
  }

  function addCustomItem() {
    if (!customForm.name.trim()) return
    const qty = parseFloat(customForm.qty) || 0
    const par = parseFloat(customForm.par) || 0
    addItem({
      template_id: null, name: customForm.name.trim(), category: customForm.category || 'Other',
      qty, par, unit: customForm.unit || 'units',
      note: customForm.note.trim() || null, storage_location: customForm.storage_location.trim() || null,
      expiry: customForm.expiry || null,
    })
    setCustomForm({ name: '', category: '', qty: '0', par: '0', unit: '', note: '', storage_location: '', expiry: '' })
    setShowCustom(false)
  }

  // Derived for kit detail view
  const cats = Array.from(new Set(items.map(i => i.category))).sort()
  const displayed = filterCat ? items.filter(i => i.category === filterCat) : items
  const sortedItems = [...displayed].sort((a, b) => {
    // Grouped by pillar first (Water, Food, Medical, Power & Lighting...) so a
    // cache's medical or power items show up as their own section without
    // needing a separate IFAK or Power Cache kit to hold them.
    const pd = PILLAR_ORDER.indexOf(pillarFor(a.category)) - PILLAR_ORDER.indexOf(pillarFor(b.category))
    if (pd !== 0) return pd
    const cd = a.category.localeCompare(b.category)
    if (cd !== 0) return cd
    return a.name.localeCompare(b.name)
  })
  const readiness = kitReadiness(items)
  const outCount = items.filter(i => invStatus(i.qty, i.par) === 'out').length
  const lowCount = items.filter(i => invStatus(i.qty, i.par) === 'low').length
  const totalWeightG = items.reduce((s, i) => s + (i.weight_g ?? 0) * i.qty, 0)
  const totalCostCents = items.reduce((s, i) => s + (i.cost_cents ?? 0) * i.qty, 0)
  const existingTemplateIds = new Set(items.map(i => i.template_id).filter(Boolean))

  // Catalog filtering
  const catalogResults = ITEM_CATALOG.filter(c => {
    if (catalogKitOnly && activeKit && !c.tags.includes(activeKit.type)) return false
    if (catalogCat && c.category !== catalogCat) return false
    if (catalogSearch) {
      const q = catalogSearch.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false
    }
    return true
  })
  const catalogCategories = Array.from(new Set(
    (catalogKitOnly && activeKit ? ITEM_CATALOG.filter(c => c.tags.includes(activeKit.type)) : ITEM_CATALOG).map(c => c.category)
  )).sort()

  const readinessColor = readiness === 100 ? '#22C55E' : readiness >= 70 ? '#F59E0B' : '#EF4444'

  if (loading) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>
        Loading inventory...
      </div>
    )
  }

  // ── Kit Detail View ─────────────────────────────────────────────────────────
  if (activeKit) {
    const meta = KIT_META[activeKit.type]
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <button onClick={() => { setActiveKitId(null); setFilterCat(''); setShowCatalog(false); setAddedInCatalog(new Set()) }}
            style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-muted)', padding: '4px 10px', fontSize: '12px', fontFamily: 'var(--font-display)', cursor: 'pointer' }}>
            Kits
          </button>
          <span style={{ color: 'var(--color-subtle)', fontSize: '12px' }}>/</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '3px', background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}40` }}>
            {meta.short}
          </span>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>{activeKit.name}</h3>
          {activeKit.location_label && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{activeKit.location_label}</span>
          )}
          <button onClick={() => setConfirmDeleteKit(activeKit.id)}
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-display)', padding: '4px 8px' }}>
            Delete kit
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '80px', height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${readiness}%`, background: readinessColor, borderRadius: '2px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: readinessColor }}>{readiness}% ready</span>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{items.length} items</span>
          {outCount > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '3px', padding: '1px 7px' }}>{outCount} out</span>}
          {lowCount > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '3px', padding: '1px 7px' }}>{lowCount} low</span>}
          {totalWeightG > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{fmtWeight(totalWeightG)}</span>}
          {totalCostCents > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>${(totalCostCents / 100).toFixed(2)}</span>}
        </div>

        {/* Context: water/food targets, documents, generator, whichever apply to this cache type */}
        {SUSTAINMENT_TYPES.includes(activeKit.type) && (
          <>
            <KitTargetsPanel h={h} />
            <CollapsiblePanel label="Full water storage calculator">
              <WaterCalculator household={h} onHouseholdChange={next => updateKitHousehold(activeKit.id, { household_people: next.people, household_pets: next.pets, household_days: next.days })} />
            </CollapsiblePanel>
            <CollapsiblePanel label="Full caloric needs calculator">
              <CaloricCalculator household={h} />
            </CollapsiblePanel>
          </>
        )}
        {activeKit.type === 'home_cache' && (
          <CollapsiblePanel label="Important documents checklist">
            <DocumentChecklist />
          </CollapsiblePanel>
        )}
        {(activeKit.type === 'home_cache' || activeKit.type === 'power_cache') && (
          <CollapsiblePanel label="Generator and fuel calculator">
            <GeneratorCalculator />
          </CollapsiblePanel>
        )}

        {/* Action bar */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px', alignItems: 'center' }}>
          <button onClick={() => { setShowCatalog(v => !v); setCatalogSearch(''); setCatalogCat(''); setAddedInCatalog(new Set()) }}
            style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: 'none', background: showCatalog ? 'var(--color-border)' : 'var(--color-accent)', color: showCatalog ? 'var(--color-muted)' : '#0A0A0A' }}>
            {showCatalog ? 'Close catalog' : '+ Add from catalog'}
          </button>
          <button onClick={suggestBuild}
            style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)', cursor: 'pointer', border: '1px solid var(--color-border)', background: suggestDone ? 'rgba(34,197,94,0.1)' : 'transparent', color: suggestDone ? 'var(--color-accent)' : 'var(--color-muted)' }}>
            {suggestDone ? 'Filled!' : 'Suggest build'}
          </button>
          <button onClick={() => setShowCustom(v => !v)}
            style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)', cursor: 'pointer', border: '1px solid var(--color-border)', background: showCustom ? 'rgba(59,130,246,0.1)' : 'transparent', color: showCustom ? '#3B82F6' : 'var(--color-muted)' }}>
            {showCustom ? 'Cancel' : '+ Custom item'}
          </button>
          <button onClick={() => { setShowHousehold(v => !v) }}
            style={{ marginLeft: 'auto', padding: '6px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-subtle)' }}>
            {h.people}p {h.pets > 0 ? `+${h.pets}pet` : ''} {h.days}d
          </button>
        </div>

        {/* Household editor (collapsible), this cache's own, not shared with any other */}
        {showHousehold && (
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
              Who {activeKit.name} is sized for
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
              <div><label style={labelStyle}>People</label><input type="number" min={1} max={20} value={h.people} onChange={e => updateKitHousehold(activeKit.id, { household_people: +e.target.value || 1 })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Pets</label><input type="number" min={0} max={20} value={h.pets} onChange={e => updateKitHousehold(activeKit.id, { household_pets: +e.target.value || 0 })} style={inputStyle} /></div>
              <div><label style={labelStyle}>Target days</label><input type="number" min={1} max={365} value={h.days} onChange={e => updateKitHousehold(activeKit.id, { household_days: +e.target.value || 14 })} style={inputStyle} /></div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button onClick={() => setShowHousehold(false)} style={{ width: '100%', padding: '9px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Done</button>
              </div>
            </div>
          </div>
        )}

        {/* Catalog panel */}
        {showCatalog && (
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              <input
                value={catalogSearch} onChange={e => setCatalogSearch(e.target.value)}
                placeholder="Search catalog..." autoFocus
                style={{ ...inputStyle, width: 'auto', flex: 1, minWidth: '140px' }}
              />
              <select value={catalogCat} onChange={e => setCatalogCat(e.target.value)} style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }}>
                <option value="">All categories</option>
                {catalogCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--color-muted)', cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={catalogKitOnly} onChange={e => setCatalogKitOnly(e.target.checked)} style={{ accentColor: meta.color, width: '13px', height: '13px' }} />
                {meta.short} only
              </label>
            </div>
            <div style={{ borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--color-border)' }}>
            <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)' }}>
              {catalogResults.length === 0 && (
                <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)', background: 'var(--color-surface)' }}>No items match</div>
              )}
              {catalogResults.map(c => {
                const alreadyIn = existingTemplateIds.has(c.id)
                const justAdded = addedInCatalog.has(c.id)
                const suggested = c.suggest ? c.suggest(h) : c.defaultPar
                return (
                  <div key={c.id}
                    onClick={() => { if (!alreadyIn && !justAdded) addFromCatalog(c.id) }}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-surface)', cursor: alreadyIn || justAdded ? 'default' : 'pointer', opacity: alreadyIn ? 0.4 : 1 }}
                    onMouseEnter={e => { if (!alreadyIn && !justAdded) e.currentTarget.style.background = 'var(--color-bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)' }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: alreadyIn ? 'var(--color-subtle)' : justAdded ? 'var(--color-accent)' : 'var(--color-muted)', flexShrink: 0 }}>
                      {alreadyIn ? 'added' : justAdded ? '+ added' : '+'}
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text)', flex: 1 }}>{c.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '3px', padding: '0 5px', flexShrink: 0 }}>{c.category}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', flexShrink: 0 }}>{suggested} {c.unit}</span>
                  </div>
                )
              })}
            </div>
            </div>
            <div style={{ marginTop: '10px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)' }}>
              {catalogResults.length} items &nbsp;·&nbsp; click to add &nbsp;·&nbsp; {addedInCatalog.size > 0 ? `${addedInCatalog.size} added this session` : ''}
            </div>
          </div>
        )}

        {/* Custom item form */}
        {showCustom && (
          <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
              <div><label style={labelStyle}>Item name</label><input value={customForm.name} onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Water filter" style={inputStyle} onKeyDown={e => e.key === 'Enter' && addCustomItem()} /></div>
              <div><label style={labelStyle}>Category</label><input value={customForm.category} onChange={e => setCustomForm(f => ({ ...f, category: e.target.value }))} placeholder="Medical..." style={inputStyle} /></div>
              <div><label style={labelStyle}>Qty on hand</label><input type="number" min={0} value={customForm.qty} onChange={e => setCustomForm(f => ({ ...f, qty: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Unit</label><input value={customForm.unit} onChange={e => setCustomForm(f => ({ ...f, unit: e.target.value }))} placeholder="gallons, lbs..." style={inputStyle} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div><label style={labelStyle}>Par level (target)</label><input type="number" min={0} value={customForm.par} onChange={e => setCustomForm(f => ({ ...f, par: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Expiry (optional)</label><input type="date" value={customForm.expiry} onChange={e => setCustomForm(f => ({ ...f, expiry: e.target.value }))} style={inputStyle} /></div>
              <div><label style={labelStyle}>Note / location</label><input value={customForm.note} onChange={e => setCustomForm(f => ({ ...f, note: e.target.value }))} placeholder="Shelf B, blue bin..." style={inputStyle} /></div>
            </div>
            <button onClick={addCustomItem} style={{ padding: '7px 20px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--color-accent)', color: '#0A0A0A' }}>
              Add item
            </button>
          </div>
        )}

        {/* Category filter chips */}
        {cats.length > 1 && (
          <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {(['', ...cats]).map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '4px 12px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)', cursor: 'pointer', fontWeight: filterCat === cat ? 600 : 400, border: `1px solid ${filterCat === cat ? 'var(--color-accent)' : 'var(--color-border)'}`, background: filterCat === cat ? 'rgba(34,197,94,0.1)' : 'transparent', color: filterCat === cat ? 'var(--color-accent)' : 'var(--color-muted)' }}>
                {cat || 'All'}
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 24px', border: '1px dashed var(--color-border)', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>Kit is empty</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.6 }}>
              Click "Add from catalog" to search items, or "Suggest build" to fill from the {meta.label} template.
            </div>
          </div>
        )}

        {/* Item list */}
        {sortedItems.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
            {sortedItems.map((item, idx) => {
              const status = invStatus(item.qty, item.par)
              const color = SC[status]
              const expired = item.expiry && item.expiry < today
              const expiring = item.expiry && !expired && item.expiry <= soonDate
              const isExpanded = expandedId === item.id
              const pillar = pillarFor(item.category)
              const showPillarHeader = idx === 0 || pillarFor(sortedItems[idx - 1].category) !== pillar
              return (
                <div key={item.id}>
                  {showPillarHeader && (
                    <div style={{ background: 'var(--color-bg)', padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {pillar}
                    </div>
                  )}
                  <div
                    onClick={() => openExpand(item)}
                    style={{ background: 'var(--color-surface)', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: isMobile ? 'wrap' : 'nowrap', cursor: 'pointer' }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = 'var(--color-bg)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-surface)' }}
                  >
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                        {item.name}
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '3px', padding: '0 4px' }}>{item.category}</span>
                        {expired  && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '3px', padding: '0 4px' }}>EXPIRED</span>}
                        {expiring && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '3px', padding: '0 4px' }}>exp soon</span>}
                        {(item.note || item.storage_location) && !isExpanded && (
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{item.storage_location || item.note}</span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => adjustQty(item.id, -1)} style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>-</button>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color, minWidth: '28px', textAlign: 'center' }}>{Number(item.qty)}</span>
                      <button onClick={() => adjustQty(item.id, 1)} style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: '1' }}>+</button>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', marginLeft: '2px' }}>/ {Number(item.par)} {item.unit}</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>{status.toUpperCase()}</span>
                    <button onClick={e => { e.stopPropagation(); removeItem(item.id) }} style={{ background: 'transparent', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '0 2px', flexShrink: 0 }}>x</button>
                  </div>
                  {isExpanded && (
                    <div style={{ background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', padding: '12px 14px', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px' }}
                      onClick={e => e.stopPropagation()}>
                      <div><label style={labelStyle}>Expiry date</label><input type="date" value={expandBuf.expiry ?? ''} onChange={e => setExpandBuf(b => ({ ...b, expiry: e.target.value || null }))} style={inputStyle} /></div>
                      <div><label style={labelStyle}>Storage location</label><input value={expandBuf.storage_location ?? ''} onChange={e => setExpandBuf(b => ({ ...b, storage_location: e.target.value }))} placeholder="Shelf B, blue bin..." style={inputStyle} /></div>
                      <div><label style={labelStyle}>Weight (grams)</label><input type="number" min={0} value={(expandBuf as any).weight_str ?? ''} onChange={e => setExpandBuf(b => ({ ...b, weight_str: e.target.value }))} placeholder="e.g. 454" style={inputStyle} /></div>
                      <div><label style={labelStyle}>Cost ($)</label><input type="number" min={0} step="0.01" value={(expandBuf as any).cost_str ?? ''} onChange={e => setExpandBuf(b => ({ ...b, cost_str: e.target.value }))} placeholder="e.g. 24.99" style={inputStyle} /></div>
                      <div style={{ gridColumn: isMobile ? '1/-1' : '1/3' }}><label style={labelStyle}>Note</label><input value={expandBuf.note ?? ''} onChange={e => setExpandBuf(b => ({ ...b, note: e.target.value }))} placeholder="Brand, details, condition..." style={inputStyle} /></div>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', gridColumn: isMobile ? '1/-1' : 'auto' }}>
                        <button onClick={() => saveExpand(item.id)} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
                        <button onClick={() => setExpandedId(null)} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontFamily: 'var(--font-display)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {!user && (
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textAlign: 'center', padding: '8px', borderTop: '1px solid var(--color-border)', marginTop: '8px' }}>
            Sign in to sync across devices
          </div>
        )}

        {/* Delete kit confirm */}
        {confirmDeleteKit && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '28px', maxWidth: '360px', width: '100%' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '10px' }}>Delete this kit?</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                All items in "{activeKit.name}" will be permanently removed. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => deleteKit(confirmDeleteKit)} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: 'none', background: '#EF4444', color: '#fff', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
                <button onClick={() => setConfirmDeleteKit(null)} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontFamily: 'var(--font-display)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── Kit Cards View ──────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>{typeFilter ? KIT_META[typeFilter].label : 'Your Kits'}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{visibleKits.length} kit{visibleKits.length !== 1 ? 's' : ''} &nbsp;·&nbsp; {user ? 'synced' : 'local only'}</div>
        </div>
        <button onClick={() => { setNewKitForm(f => ({ ...f, type: typeFilter ?? f.type })); setShowNewKit(v => !v) }} style={{ padding: '7px 16px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: 'none', background: showNewKit ? 'var(--color-border)' : 'var(--color-accent)', color: showNewKit ? 'var(--color-muted)' : '#0A0A0A' }}>
          {showNewKit ? 'Cancel' : '+ New kit'}
        </button>
      </div>

      {/* New kit form */}
      {showNewKit && (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '11px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>New {typeFilter ? KIT_META[typeFilter].label : 'Kit'}</div>
          <div style={{ marginBottom: '14px' }}>
            <label style={labelStyle}>Kit name</label>
            <input value={newKitForm.name} onChange={e => setNewKitForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Primary BOB, IFAK - Car, Home Cache" style={inputStyle} onKeyDown={e => e.key === 'Enter' && createKit()} autoFocus />
          </div>
          {!typeFilter && (
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Type</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(Object.entries(KIT_META) as [KitType, typeof KIT_META[KitType]][]).map(([type, meta]) => (
                  <button key={type} type="button" onClick={() => setNewKitForm(f => ({ ...f, type }))} style={{ padding: '5px 12px', borderRadius: '4px', fontSize: '11px', fontFamily: 'var(--font-display)', cursor: 'pointer', fontWeight: newKitForm.type === type ? 700 : 400, border: `1px solid ${newKitForm.type === type ? meta.color : 'var(--color-border)'}`, background: newKitForm.type === type ? `${meta.color}18` : 'transparent', color: newKitForm.type === type ? meta.color : 'var(--color-muted)' }}>
                    {meta.short}
                  </button>
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-subtle)', marginTop: '6px' }}>{KIT_META[newKitForm.type].label}</div>
            </div>
          )}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Location label (optional)</label>
            <input value={newKitForm.location_label} onChange={e => setNewKitForm(f => ({ ...f, location_label: e.target.value }))} placeholder="e.g. Master closet, Truck, Hall closet" style={inputStyle} />
          </div>
          <button onClick={createKit} disabled={!newKitForm.name.trim() || creatingKit} style={{ padding: '8px 22px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: newKitForm.name.trim() && !creatingKit ? 'pointer' : 'default', border: 'none', background: newKitForm.name.trim() && !creatingKit ? 'var(--color-accent)' : 'var(--color-border)', color: newKitForm.name.trim() && !creatingKit ? '#0A0A0A' : 'var(--color-muted)', opacity: creatingKit ? 0.7 : 1 }}>
            {creatingKit ? 'Creating...' : 'Create kit'}
          </button>
        </div>
      )}

      {/* Empty state */}
      {visibleKits.length === 0 && !showNewKit && (
        <div style={{ textAlign: 'center', padding: '48px 24px', border: '1px dashed var(--color-border)', borderRadius: '8px', marginBottom: '24px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
            {typeFilter ? `No ${KIT_META[typeFilter].label} kit yet` : 'No kits yet'}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.6, marginBottom: '20px' }}>
            {typeFilter
              ? <>Create one and it tracks its own items, readiness, weight, and cost.</>
              : <>Create named kits for your EDC, Bug Out Bag, Home Cache, and more.<br />Each kit tracks its own items, readiness, weight, and cost.</>}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {(typeFilter ? [typeFilter] : (['bob', 'edc', 'home_cache', 'vehicle', 'ghb'] as KitType[])).map(type => (
              <button key={type} onClick={() => { setNewKitForm({ name: KIT_META[type].label, type, location_label: '' }); setShowNewKit(true) }}
                style={{ padding: '6px 14px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)', cursor: 'pointer', border: `1px solid ${KIT_META[type].color}50`, background: `${KIT_META[type].color}12`, color: KIT_META[type].color }}>
                + {KIT_META[type].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kit cards grid */}
      {visibleKits.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {visibleKits.map(kit => {
            const meta = KIT_META[kit.type] ?? KIT_META.custom
            const kitItems = kitItemsMap[kit.id]
            const r = kitItems ? kitReadiness(kitItems) : null
            const rColor = r === null ? 'var(--color-subtle)' : r === 100 ? '#22C55E' : r >= 70 ? '#F59E0B' : '#EF4444'
            const itemsOut = kitItems ? kitItems.filter(i => invStatus(i.qty, i.par) === 'out').length : 0
            const itemsLow = kitItems ? kitItems.filter(i => invStatus(i.qty, i.par) === 'low').length : 0
            return (
              <button key={kit.id} onClick={() => setActiveKitId(kit.id)}
                style={{ textAlign: 'left', background: 'var(--color-surface)', border: `1px solid var(--color-border)`, borderRadius: '8px', padding: '16px', cursor: 'pointer', outline: 'none', display: 'flex', flexDirection: 'column', gap: '10px' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = meta.color }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '3px', background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30`, flexShrink: 0 }}>
                    {meta.short}
                  </span>
                  {(itemsOut > 0 || itemsLow > 0) && (
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: itemsOut > 0 ? '#EF4444' : '#F59E0B', flexShrink: 0, marginLeft: 'auto' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '2px' }}>{kit.name}</div>
                  {kit.location_label && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>{kit.location_label}</div>
                  )}
                </div>
                <div>
                  {r !== null && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <div style={{ flex: 1, height: '3px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${r}%`, background: rColor, borderRadius: '2px' }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: rColor, flexShrink: 0 }}>{r}%</span>
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span>{kit.item_count ?? (kitItems?.length ?? 0)} items</span>
                    {kit.total_weight_g && kit.total_weight_g > 0 && <span>{fmtWeight(kit.total_weight_g)}</span>}
                    {kit.total_cost_cents && kit.total_cost_cents > 0 && <span>${(kit.total_cost_cents / 100).toFixed(0)}</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {!user && kits.length > 0 && (
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textAlign: 'center', padding: '8px', borderTop: '1px solid var(--color-border)' }}>
          Sign in to sync your kits across devices
        </div>
      )}

      {/* Delete kit confirm (from card view) */}
      {confirmDeleteKit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '28px', maxWidth: '360px', width: '100%' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '15px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '10px' }}>Delete this kit?</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', marginBottom: '20px', lineHeight: 1.6 }}>
              All items will be permanently removed.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => deleteKit(confirmDeleteKit)} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: 'none', background: '#EF4444', color: '#fff', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setConfirmDeleteKit(null)} style={{ flex: 1, padding: '9px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontFamily: 'var(--font-display)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Prep Score ─────────────────────────────────────────────────────────────
// Reads what's already tracked in Inventory Manager (same kits/items, same
// server sync + local-guest fallback) and turns it into one readiness number
// plus a per-pillar breakdown. No new backend, no re-entering data. The
// point is tying data that already exists in the platform together instead
// of asking for it twice.

const PILLAR_ORDER = [
  'Water', 'Food', 'Medical', 'Shelter & Clothing',
  'Power & Lighting', 'Communications', 'Documents & Finance', 'Tools & Supplies',
] as const

const PILLAR_CATEGORY_MAP: Record<string, typeof PILLAR_ORDER[number]> = {
  Water: 'Water',
  Food: 'Food',
  Medical: 'Medical', 'Wound Care': 'Medical', Trauma: 'Medical', Airway: 'Medical', Medications: 'Medical',
  Shelter: 'Shelter & Clothing', Bedding: 'Shelter & Clothing', Clothing: 'Shelter & Clothing',
  Power: 'Power & Lighting', Lighting: 'Power & Lighting', Fire: 'Power & Lighting',
  Comms: 'Communications',
  Documents: 'Documents & Finance',
}

function pillarFor(category: string): typeof PILLAR_ORDER[number] {
  return PILLAR_CATEGORY_MAP[category] ?? 'Tools & Supplies'
}

function scoreTier(score: number): { label: string; color: string } {
  if (score >= 75) return { label: 'Squared Away', color: '#22C55E' }
  if (score >= 50) return { label: 'Prepared',      color: '#3B82F6' }
  if (score >= 25) return { label: 'Building',      color: '#F59E0B' }
  return { label: 'Just Starting', color: '#EF4444' }
}

function PrepScore({ onOpenInventory }: { onOpenInventory: () => void }) {
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const [items, setItems] = useState<KitItem[]>([])
  const [kitCount, setKitCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      let kits: Kit[] = []
      if (user) {
        try {
          const res = await fetch('/api/inventory/kits', { credentials: 'include' })
          if (res.ok) kits = (await res.json()).map((k: any) => ({ ...k, id: String(k.id) }))
        } catch {}
      }
      if (kits.length === 0) kits = loadLocalKits()
      setKitCount(kits.length)

      const perKit = await Promise.all(kits.map(async (k) => {
        if (user && !k.id.startsWith('local_')) {
          try {
            const res = await fetch(`/api/inventory/kits/${k.id}/items`, { credentials: 'include' })
            if (res.ok) {
              return (await res.json()).map((i: any) => ({ ...i, id: String(i.id), kit_id: String(i.kit_id), qty: Number(i.qty), par: Number(i.par) })) as KitItem[]
            }
          } catch {}
        }
        return loadLocalItems(k.id)
      }))
      setItems(perKit.flat())
      setLoading(false)
    }
    load()
  }, [user])

  const today = new Date().toISOString().slice(0, 10)
  const expiredCount = items.filter(i => i.expiry && i.expiry < today).length

  const pillarStats = PILLAR_ORDER.map(pillar => {
    const pillarItems = items.filter(i => pillarFor(i.category) === pillar)
    const effective = pillarItems.map(i => (i.expiry && i.expiry < today ? 0 : i.qty))
    const ok = pillarItems.filter((i, idx) => (i.par > 0 ? effective[idx] >= i.par : effective[idx] > 0)).length
    const pct = pillarItems.length > 0 ? Math.round((ok / pillarItems.length) * 100) : 0
    return { pillar, pct, tracked: pillarItems.length, ok }
  })

  const overallScore = Math.round(pillarStats.reduce((sum, p) => sum + p.pct, 0) / PILLAR_ORDER.length)
  const tier = scoreTier(overallScore)
  const totalTracked = items.length
  const weakPillars = pillarStats.filter(p => p.pct < 50).sort((a, b) => a.pct - b.pct)

  if (loading) {
    return <div style={{ color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', fontSize: '13px', padding: '20px 0' }}>Loading...</div>
  }

  if (totalTracked === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
          Nothing tracked yet
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'var(--color-muted)', marginBottom: '20px', maxWidth: '420px', margin: '0 auto 20px' }}>
          Prep Score reads directly from Inventory Manager. Build a kit there and this fills in on its own.
        </div>
        <button onClick={onOpenInventory} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
          Open Inventory Manager
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
        <div style={{
          width: '96px', height: '96px', borderRadius: '50%', flexShrink: 0,
          border: `4px solid ${tier.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', background: `${tier.color}0d`,
        }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', fontWeight: 700, color: tier.color, lineHeight: 1 }}>{overallScore}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>/ 100</span>
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: tier.color, marginBottom: '4px' }}>{tier.label}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-subtle)' }}>
            {kitCount} kit{kitCount !== 1 ? 's' : ''} &middot; {totalTracked} item{totalTracked !== 1 ? 's' : ''} tracked
            {expiredCount > 0 && <> &middot; <span style={{ color: 'var(--color-danger)' }}>{expiredCount} expired</span></>}
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-subtle)', marginTop: '4px' }}>
            Each item is checked against its own par target. Every cache is sized separately in Inventory Manager.
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px' }}>
          By category
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px 24px' }}>
          {pillarStats.map(p => {
            const color = p.pct >= 75 ? '#22C55E' : p.pct >= 50 ? '#3B82F6' : p.pct >= 25 ? '#F59E0B' : p.tracked === 0 ? 'var(--color-subtle)' : '#EF4444'
            return (
              <div key={p.pillar}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontFamily: 'var(--font-body)', color: 'var(--color-muted)', marginBottom: '4px' }}>
                  <span>{p.pillar}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color }}>
                    {p.tracked === 0 ? 'not started' : `${p.pct}%`}
                  </span>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.tracked === 0 ? 0 : p.pct}%`, background: color, borderRadius: '3px' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {weakPillars.length > 0 && (
        <div style={{ padding: '14px 16px', borderRadius: '6px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>
            Biggest gaps
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.7, marginBottom: '10px' }}>
            {weakPillars.slice(0, 3).map(p => (
              <div key={p.pillar}>
                {p.pillar}: {p.tracked === 0 ? 'nothing tracked yet' : `${p.ok} of ${p.tracked} items at target`}
              </div>
            ))}
          </div>
          <button onClick={onOpenInventory} style={{ padding: '7px 14px', borderRadius: '5px', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)', color: 'var(--color-danger)', fontFamily: 'var(--font-mono)', fontSize: '12px', cursor: 'pointer' }}>
            Fix in Inventory Manager
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Generator / Fuel Runtime Calculator ───────────────────────────────────────

const APPLIANCE_LOADS: { label: string; watts: number }[] = [
  { label: 'Refrigerator / freezer',   watts: 700 },
  { label: 'Chest freezer',             watts: 350 },
  { label: 'Sump pump',                 watts: 800 },
  { label: 'Well pump',                 watts: 1000 },
  { label: 'Furnace blower fan',        watts: 600 },
  { label: 'Window AC unit',            watts: 1200 },
  { label: 'Space heater',              watts: 1500 },
  { label: 'CPAP machine',              watts: 60 },
  { label: 'Lights (several)',          watts: 200 },
  { label: 'Phone / laptop charging',   watts: 50 },
  { label: 'Wifi router + modem',       watts: 30 },
  { label: 'TV',                        watts: 150 },
]

function GeneratorCalculator() {
  const isMobile = useIsMobile()
  const [genWatts, setGenWatts] = useState(5000)
  const [tankGal, setTankGal] = useState(5)
  const [days, setDays] = useState(3)
  const [hoursPerDay, setHoursPerDay] = useState(12)
  const [checked, setChecked] = useState<Set<string>>(new Set(['Refrigerator / freezer', 'Lights (several)', 'Phone / laptop charging']))

  function toggle(label: string) {
    setChecked(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n })
  }

  const load = APPLIANCE_LOADS.filter(a => checked.has(a.label)).reduce((sum, a) => sum + a.watts, 0)
  const overCapacity = load > genWatts
  const loadFraction = genWatts > 0 ? Math.min(load / genWatts, 1) : 0
  // Rough rule of thumb: a gas generator burns roughly 0.75 gal/hr per 10kW of
  // rated output at 50% load, scaling with actual load fraction. Real
  // consumption varies a lot by generator and fuel type. This is a planning
  // estimate, not a spec.
  const gph = Math.max(0.15, (genWatts / 10000) * 0.75 * Math.max(loadFraction, 0.3))
  const runtimePerTank = tankGal / gph
  const fuelPerDay = hoursPerDay * gph
  const totalFuelNeeded = fuelPerDay * days
  const tanksNeeded = Math.ceil(totalFuelNeeded / tankGal)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>Generator rated watts</label><input type="number" min={500} step={500} value={genWatts} onChange={e => setGenWatts(+e.target.value || 0)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Fuel tank (gal)</label><input type="number" min={0.5} step={0.5} value={tankGal} onChange={e => setTankGal(+e.target.value || 0)} style={inputStyle} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>Days to plan for</label><input type="number" min={1} max={60} value={days} onChange={e => setDays(+e.target.value || 1)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Hours run per day</label><input type="number" min={1} max={24} value={hoursPerDay} onChange={e => setHoursPerDay(+e.target.value || 1)} style={inputStyle} /></div>
        </div>
        <div>
          <label style={labelStyle}>What you'll run on it</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {APPLIANCE_LOADS.map(a => (
              <label key={a.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-muted)', padding: '2px 0' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="checkbox" checked={checked.has(a.label)} onChange={() => toggle(a.label)} style={{ accentColor: 'var(--color-accent)', width: '14px', height: '14px' }} />
                  {a.label}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{a.watts}W</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Load</div>
        {resultRow('Running load', `${load.toLocaleString()} W`, !overCapacity)}
        {resultRow('Generator capacity', `${genWatts.toLocaleString()} W`)}
        {overCapacity && (
          <div style={{ marginTop: '10px', padding: '12px 14px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', fontSize: '12px', color: 'var(--color-danger)', lineHeight: 1.6 }}>
            This load exceeds the generator's rated output. Drop something from the list or run appliances in shifts instead of all at once.
          </div>
        )}
        <div style={{ marginTop: '16px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Fuel</div>
        {resultRow('Estimated burn rate', `~${gph.toFixed(2)} gal/hr`)}
        {resultRow('Runtime per full tank', `~${runtimePerTank.toFixed(1)} hrs`)}
        {resultRow('Fuel per day', `~${fuelPerDay.toFixed(1)} gal`)}
        {resultRow(`Fuel for ${days} day${days !== 1 ? 's' : ''}`, `~${totalFuelNeeded.toFixed(1)} gal`, true)}
        {resultRow('Tanks to have on hand', `${tanksNeeded} tank${tanksNeeded !== 1 ? 's' : ''}`)}
        <div style={{ marginTop: '16px', padding: '12px 14px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '12px', color: '#93C5FD', lineHeight: 1.6 }}>
          Rule-of-thumb estimate, not a spec. Check your generator's actual fuel consumption curve if you have it, and store fuel legally and safely. Most home storage limits apply per container and per property.
        </div>
      </div>
    </div>
  )
}

// ─── Important Documents Checklist ─────────────────────────────────────────────

interface DocGroup { group: string; items: string[] }

const DOC_GROUPS: DocGroup[] = [
  { group: 'Identity', items: ['Driver\'s license / state ID', 'Passport', 'Birth certificates', 'Social Security cards', 'Marriage / divorce certificates'] },
  { group: 'Financial', items: ['Bank account info', 'Insurance policies (home/auto/life)', 'Tax returns (last 2 years)', 'List of credit cards + issuer numbers'] },
  { group: 'Medical', items: ['Immunization records', 'List of medications + dosages', 'Medical history / conditions', 'Health insurance cards'] },
  { group: 'Property & Legal', items: ['Property deed / lease', 'Vehicle titles + registration', 'Will / power of attorney', 'Household inventory (photos of belongings)'] },
]

interface DocState { physical: boolean; digital: boolean }

function loadDocChecklist(): Record<string, DocState> {
  try { return JSON.parse(localStorage.getItem('fenris_doc_checklist') ?? '{}') } catch { return {} }
}

function DocumentChecklist() {
  const [state, setState] = useState<Record<string, DocState>>(loadDocChecklist)

  useEffect(() => {
    try { localStorage.setItem('fenris_doc_checklist', JSON.stringify(state)) } catch {}
  }, [state])

  function toggle(item: string, field: keyof DocState) {
    setState(prev => {
      const current: DocState = prev[item] ?? { physical: false, digital: false }
      return { ...prev, [item]: { ...current, [field]: !current[field] } }
    })
  }

  const allItems = DOC_GROUPS.flatMap(g => g.items)
  const doneCount = allItems.filter(i => state[i]?.physical || state[i]?.digital).length

  function asText() {
    const lines = ['IMPORTANT DOCUMENTS CHECKLIST', '']
    for (const g of DOC_GROUPS) {
      lines.push(g.group.toUpperCase() + ':')
      for (const item of g.items) {
        const s = state[item]
        const status = s?.physical && s?.digital ? '[physical + digital]' : s?.physical ? '[physical copy]' : s?.digital ? '[digital copy]' : '[ ]'
        lines.push(`  ${status} ${item}`)
      }
      lines.push('')
    }
    return lines.join('\n')
  }

  const [copied, setCopied] = useState(false)
  function copyList() {
    navigator.clipboard.writeText(asText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ padding: '12px 14px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '12px', color: '#93C5FD', lineHeight: 1.6 }}>
        Track what you have a physical copy of (in a go-bag or fireproof box) versus a digital copy of (encrypted drive, cloud folder). Saved to this browser only, nothing is uploaded.
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-muted)' }}>
        {doneCount} of {allItems.length} documents accounted for
      </div>

      {DOC_GROUPS.map(g => (
        <div key={g.group}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>{g.group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '6px', overflow: 'hidden' }}>
            {g.items.map(item => {
              const s = state[item]
              return (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '9px 12px', background: 'var(--color-surface)' }}>
                  <span style={{ fontSize: '13px', color: 'var(--color-text)', flex: 1 }}>{item}</span>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px', color: s?.physical ? 'var(--color-accent)' : 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
                    <input type="checkbox" checked={!!s?.physical} onChange={() => toggle(item, 'physical')} style={{ accentColor: 'var(--color-accent)', width: '13px', height: '13px' }} />
                    Physical
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px', color: s?.digital ? 'var(--color-accent)' : 'var(--color-subtle)', fontFamily: 'var(--font-mono)' }}>
                    <input type="checkbox" checked={!!s?.digital} onChange={() => toggle(item, 'digital')} style={{ accentColor: 'var(--color-accent)', width: '13px', height: '13px' }} />
                    Digital
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={copyList} style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: copied ? 'rgba(34,197,94,0.1)' : 'transparent', color: copied ? 'var(--color-accent)' : 'var(--color-muted)', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>
          {copied ? 'Copied!' : 'Copy checklist as text'}
        </button>
        <button onClick={() => window.print()} style={{ padding: '9px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer' }}>
          Print
        </button>
      </div>
    </div>
  )
}

// ─── Inventory Hub ──────────────────────────────────────────────────────────
// The tabs are the caches themselves (EDC, BOB, Home Cache, and so on), not
// separate tools. Open a cache and it already knows how much water and food
// it should hold, and Home Cache and Power Cache carry the documents
// checklist and the generator calculator right there, because that's where
// those actually belong. Overview and All Kits are the only two tabs that
// aren't a single cache type.

type HubTab = 'overview' | 'all' | KitType

// IFAK, Trauma, Med Kit, Comms, and Power Cache are not tabs of their own.
// A cache's medical or power items already get their own section inside
// that cache (grouped by pillar), so a dedicated kit type for them would
// just be the same items with an extra layer of navigation on top. They're
// still valid kit types under "All Kits" for anyone who genuinely wants a
// standalone one (a belt IFAK separate from the BOB it rides in, say).
const KIT_TYPE_ORDER: KitType[] = ['edc', 'bob', 'ghb', 'inch', 'vehicle', 'home_cache', 'custom']

function InventoryHub() {
  const [tab, setTab] = useState<HubTab>('overview')

  const tabs: { key: HubTab; label: string; color?: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'all', label: 'All Kits' },
    ...KIT_TYPE_ORDER.map(type => ({ key: type as HubTab, label: KIT_META[type].short, color: KIT_META[type].color })),
  ]

  return (
    <div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '24px', borderBottom: '1px solid var(--color-border)', paddingBottom: '14px' }}>
        {tabs.map(t => {
          const active = tab === t.key
          const color = t.color ?? 'var(--color-accent)'
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              title={t.color ? KIT_META[t.key as KitType].label : undefined}
              style={{
                padding: '6px 14px', borderRadius: '5px', fontSize: '13px', fontFamily: 'var(--font-display)',
                fontWeight: active ? 600 : 400, cursor: 'pointer',
                border: `1px solid ${active ? color : 'var(--color-border)'}`,
                background: active ? `${color}18` : 'transparent',
                color: active ? color : 'var(--color-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>
      {tab === 'overview' && <PrepScore onOpenInventory={() => setTab('all')} />}
      {tab === 'all' && <InventoryManager />}
      {tab !== 'overview' && tab !== 'all' && <InventoryManager typeFilter={tab as KitType} />}
    </div>
  )
}

// ─── Tool registry ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    id: 'inventory',
    name: 'Inventory Manager',
    desc: 'One tab per cache: EDC, BOB, GHB, INCH, Vehicle, Home Cache. Each one already knows your water and food targets, groups medical and power items into their own sections, and Home Cache adds the documents checklist and generator calculator.',
    component: <InventoryHub />,
  },
  {
    id: 'garden',
    name: 'Garden & Crops',
    desc: 'Beds, planted crops, harvest logs, and seed inventory, for anyone who grows some of their own food. Tracks rotation history per bed and flags replanting the same family too soon.',
    component: <GardenManager />,
  },
]

const TOOL_LINKS = [
  {
    id: 'frequencies',
    name: 'Emergency Frequency Database',
    desc: 'Police, fire, EMS, ham radio, NOAA weather, and GMRS frequencies by county. Community-maintained reference.',
    link: '/frequencies',
  },
]

export default function Tools() {
  const [selected, setSelected] = useState<string | null>(null)
  const active = TOOLS.find(t => t.id === selected)
  const isMobile = useIsMobile()

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: isMobile ? '24px 16px' : '32px 24px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>Tools</h1>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px', color: 'var(--color-muted)', lineHeight: 1.6 }}>Practical calculators and planning tools for serious preparedness.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px', marginBottom: selected ? '32px' : '0' }}>
        {TOOLS.map(tool => (
          <button
            key={tool.id}
            onClick={() => setSelected(selected === tool.id ? null : tool.id)}
            style={{
              textAlign: 'left', background: 'var(--color-surface)', cursor: 'pointer',
              border: `1px solid ${selected === tool.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: '8px', padding: '20px', outline: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-accent)' }}
            onMouseLeave={e => { if (selected !== tool.id) e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>{tool.name}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5 }}>{tool.desc}</div>
          </button>
        ))}
        {TOOL_LINKS.map(tool => (
          <Link
            key={tool.id}
            to={tool.link}
            style={{
              textDecoration: 'none', textAlign: 'left', background: 'var(--color-surface)',
              border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', display: 'block',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--color-accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--color-border)')}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>{tool.name}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5 }}>{tool.desc}</div>
          </Link>
        ))}
      </div>

      {active && (
        <div style={{ border: '1px solid var(--color-accent)', borderRadius: '8px', padding: '28px', background: 'var(--color-surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 700, color: 'var(--color-text)' }}>{active.name}</h2>
            <button onClick={() => setSelected(null)} style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'var(--color-muted)', padding: '4px 10px', fontSize: '12px', fontFamily: 'var(--font-display)', cursor: 'pointer' }}>Close</button>
          </div>
          {active.component}
        </div>
      )}
    </div>
  )
}
