import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
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
const resultRow = (label: string, value: string, accent = false) => (
  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
    <span style={{ fontSize: '13px', color: 'var(--color-muted)', fontFamily: 'var(--font-body)' }}>{label}</span>
    <span style={{ fontSize: '15px', fontWeight: 600, fontFamily: 'var(--font-mono)', color: accent ? 'var(--color-accent)' : 'var(--color-text)' }}>{value}</span>
  </div>
)

// ─── Water Storage Calculator ──────────────────────────────────────────────────

function WaterCalculator() {
  const isMobile = useIsMobile()
  const [people, setPeople] = useState(2)
  const [pets, setPets] = useState(0)
  const [days, setDays] = useState(14)
  const [heat, setHeat] = useState(false)
  const [active, setActive] = useState(false)

  const dailyPerPerson = (heat ? 1.5 : 1) * (active ? 1.5 : 1)
  const totalPeople = people + pets * 0.5
  const totalGallons = Math.ceil(totalPeople * days * dailyPerPerson)
  const drinkingGallons = Math.ceil(totalPeople * days * 0.5 * (heat ? 1.5 : 1) * (active ? 1.5 : 1))
  const containers55 = Math.ceil(totalGallons / 55)
  const containers5 = Math.ceil(totalGallons / 5)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>People</label><input type="number" min={1} max={20} value={people} onChange={e => setPeople(+e.target.value || 1)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Pets</label><input type="number" min={0} max={10} value={pets} onChange={e => setPets(+e.target.value || 0)} style={inputStyle} /></div>
        </div>
        <div><label style={labelStyle}>Duration (days)</label><input type="number" min={1} max={365} value={days} onChange={e => setDays(+e.target.value || 1)} style={inputStyle} /></div>
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

function CaloricCalculator() {
  const isMobile = useIsMobile()
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [elderly, setElderly] = useState(0)
  const [activity, setActivity] = useState<'sedentary' | 'light' | 'moderate' | 'heavy'>('moderate')

  const activityMap = { sedentary: 1800, light: 2200, moderate: 2600, heavy: 3200 }
  const adultCals = activityMap[activity]
  const childCals = Math.round(adultCals * 0.65)
  const elderlyCals = Math.round(adultCals * 0.85)
  const dailyTotal = adults * adultCals + children * childCals + elderly * elderlyCals
  const cal72h = dailyTotal * 3
  const cal2wk = dailyTotal * 14
  const cal30d = dailyTotal * 30
  const lbsRice30 = Math.round(cal30d / 1650)
  const lbsBeans30 = Math.round(cal30d / 1500 * 0.3)
  const lbsOats30 = Math.round(cal30d / 1700 * 0.2)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '32px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
          <div><label style={labelStyle}>Adults</label><input type="number" min={0} max={20} value={adults} onChange={e => setAdults(+e.target.value || 0)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Children</label><input type="number" min={0} max={20} value={children} onChange={e => setChildren(+e.target.value || 0)} style={inputStyle} /></div>
          <div><label style={labelStyle}>Elderly (65+)</label><input type="number" min={0} max={20} value={elderly} onChange={e => setElderly(+e.target.value || 0)} style={inputStyle} /></div>
        </div>
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

interface Household { people: number; pets: number; days: number }
interface InvItem {
  id: string; templateId: string | null; name: string; category: string
  qty: number; unit: string; par: number; expiry: string; note: string
}
interface Tmpl {
  id: string; name: string; category: string; unit: string; defaultPar: number
  suggest?: (h: Household) => number
}

const BOB_TEMPLATES: Record<string, { label: string; items: Tmpl[] }> = {
  '72hr': {
    label: '72-Hour',
    items: [
      { id: 'b72_water',    name: '3L drinking water',            category: 'Water',      unit: 'liters',  defaultPar: 3,   suggest: h => h.people * 3 },
      { id: 'b72_filter',   name: 'Water filter (LifeStraw)',      category: 'Water',      unit: 'units',   defaultPar: 1 },
      { id: 'b72_tabs',     name: 'Water purification tablets',    category: 'Water',      unit: 'packs',   defaultPar: 1 },
      { id: 'b72_bars',     name: 'Emergency food bars (3-day)',   category: 'Food',       unit: 'bars',    defaultPar: 6,   suggest: h => h.people * 6 },
      { id: 'b72_snacks',   name: 'High-calorie snacks',           category: 'Food',       unit: 'lbs',     defaultPar: 2,   suggest: h => Math.ceil(h.people * 1.5) },
      { id: 'b72_mylar',    name: 'Emergency mylar blanket',       category: 'Shelter',    unit: 'units',   defaultPar: 1,   suggest: h => h.people },
      { id: 'b72_poncho',   name: 'Compact rain poncho',           category: 'Shelter',    unit: 'units',   defaultPar: 1,   suggest: h => h.people },
      { id: 'b72_cord',     name: 'Paracord (50 ft)',              category: 'Shelter',    unit: 'rolls',   defaultPar: 1 },
      { id: 'b72_fak',      name: 'Basic first aid kit',           category: 'Medical',    unit: 'kits',    defaultPar: 1 },
      { id: 'b72_rx',       name: 'Prescription meds (3 days)',    category: 'Medical',    unit: 'supply',  defaultPar: 1,   suggest: h => h.people },
      { id: 'b72_radio',    name: 'Hand-crank emergency radio',    category: 'Comms',      unit: 'units',   defaultPar: 1 },
      { id: 'b72_whistle',  name: 'Whistle',                       category: 'Comms',      unit: 'units',   defaultPar: 1,   suggest: h => h.people },
      { id: 'b72_bank',     name: 'Phone battery bank',            category: 'Comms',      unit: 'units',   defaultPar: 1,   suggest: h => h.people },
      { id: 'b72_map',      name: 'Local area map (printed)',      category: 'Navigation', unit: 'units',   defaultPar: 1 },
      { id: 'b72_compass',  name: 'Compass',                       category: 'Navigation', unit: 'units',   defaultPar: 1 },
      { id: 'b72_headlamp', name: 'Headlamp + spare batteries',   category: 'Light',      unit: 'units',   defaultPar: 1,   suggest: h => h.people },
      { id: 'b72_glow',     name: 'Chemical glow sticks (3-pack)',category: 'Light',      unit: 'packs',   defaultPar: 2 },
      { id: 'b72_multi',    name: 'Multi-tool',                    category: 'Tools',      unit: 'units',   defaultPar: 1 },
      { id: 'b72_tape',     name: 'Duct tape (small roll)',        category: 'Tools',      unit: 'rolls',   defaultPar: 1 },
      { id: 'b72_fire',     name: 'Lighter + waterproof matches',  category: 'Tools',      unit: 'sets',    defaultPar: 1 },
      { id: 'b72_docs',     name: 'ID / insurance / contacts copy',category: 'Documents',  unit: 'sets',    defaultPar: 1 },
      { id: 'b72_cash',     name: 'Cash (small bills)',            category: 'Documents',  unit: 'dollars', defaultPar: 200 },
      { id: 'b72_n95',      name: 'N95 masks',                     category: 'Hygiene',    unit: 'units',   defaultPar: 5,   suggest: h => h.people * 5 },
      { id: 'b72_sanitizer',name: 'Hand sanitizer',                category: 'Hygiene',    unit: 'bottles', defaultPar: 2 },
      { id: 'b72_wipes',    name: 'Wet wipes',                     category: 'Hygiene',    unit: 'packs',   defaultPar: 2 },
    ],
  },
  winter: {
    label: 'Winter Storm',
    items: [
      { id: 'bw_water',    name: 'Water storage (4L+)',              category: 'Water',   unit: 'liters',  defaultPar: 4,  suggest: h => h.people * 4 },
      { id: 'bw_filter',   name: 'Water filter',                     category: 'Water',   unit: 'units',   defaultPar: 1 },
      { id: 'bw_food',     name: 'Shelf-stable food supply',         category: 'Food',    unit: 'days',    defaultPar: 10, suggest: h => Math.max(h.days, 10) },
      { id: 'bw_stove',    name: 'Camp stove + fuel canisters',      category: 'Food',    unit: 'sets',    defaultPar: 1 },
      { id: 'bw_sleeping', name: 'Sleeping bag (rated 0F or lower)', category: 'Shelter', unit: 'units',   defaultPar: 1,  suggest: h => h.people },
      { id: 'bw_blanket',  name: 'Wool/fleece blanket',              category: 'Shelter', unit: 'units',   defaultPar: 2,  suggest: h => h.people * 2 },
      { id: 'bw_warmers',  name: 'Hand warmers',                     category: 'Shelter', unit: 'pairs',   defaultPar: 20, suggest: h => h.people * 10 },
      { id: 'bw_heater',   name: 'Propane heater (indoor-safe)',     category: 'Power',   unit: 'units',   defaultPar: 1 },
      { id: 'bw_bank',     name: 'Battery bank (20,000 mAh+)',       category: 'Power',   unit: 'units',   defaultPar: 1 },
      { id: 'bw_lantern',  name: 'LED lanterns',                     category: 'Power',   unit: 'units',   defaultPar: 2 },
      { id: 'bw_fak',      name: 'First aid kit',                    category: 'Medical', unit: 'kits',    defaultPar: 1 },
      { id: 'bw_radio',    name: 'NOAA weather radio',               category: 'Comms',   unit: 'units',   defaultPar: 1 },
      { id: 'bw_batts',    name: 'Spare batteries (AA/AAA)',         category: 'Comms',   unit: 'packs',   defaultPar: 4 },
      { id: 'bw_scraper',  name: 'Ice scraper / snow shovel',        category: 'Tools',   unit: 'units',   defaultPar: 1 },
      { id: 'bw_jumper',   name: 'Jumper cables',                    category: 'Tools',   unit: 'sets',    defaultPar: 1 },
      { id: 'bw_sanit',    name: 'Sanitation supplies',              category: 'Hygiene', unit: 'sets',    defaultPar: 1 },
    ],
  },
  wildfire: {
    label: 'Wildfire',
    items: [
      { id: 'bwf_water',  name: '4L water (hydration + N95)',      category: 'Water',       unit: 'liters',  defaultPar: 4,  suggest: h => h.people * 4 },
      { id: 'bwf_filter', name: 'Water filter',                    category: 'Water',       unit: 'units',   defaultPar: 1 },
      { id: 'bwf_food',   name: '3-day ready-to-eat supply',       category: 'Food',        unit: 'days',    defaultPar: 3,  suggest: h => h.people * 3 },
      { id: 'bwf_tent',   name: 'Emergency tent (quick setup)',    category: 'Shelter',     unit: 'units',   defaultPar: 1 },
      { id: 'bwf_mylar',  name: 'Mylar emergency blanket',         category: 'Shelter',     unit: 'units',   defaultPar: 1,  suggest: h => h.people },
      { id: 'bwf_fak',    name: 'First aid kit + burn dressings',  category: 'Medical',     unit: 'kits',    defaultPar: 1 },
      { id: 'bwf_radio',  name: 'NOAA weather radio',              category: 'Comms',       unit: 'units',   defaultPar: 1 },
      { id: 'bwf_phone',  name: 'Phone + charger + battery bank',  category: 'Comms',       unit: 'sets',    defaultPar: 1 },
      { id: 'bwf_n95',    name: 'N95 masks (10+)',                 category: 'Respiratory', unit: 'units',   defaultPar: 10, suggest: h => h.people * 10 },
      { id: 'bwf_goggles',name: 'Goggles (smoke eye protection)',  category: 'Respiratory', unit: 'units',   defaultPar: 1,  suggest: h => h.people },
      { id: 'bwf_routes', name: 'Printed evacuation routes',       category: 'Navigation',  unit: 'copies',  defaultPar: 2 },
      { id: 'bwf_map',    name: 'Physical map of region',          category: 'Navigation',  unit: 'units',   defaultPar: 1 },
      { id: 'bwf_light',  name: 'Headlamp + batteries',            category: 'Light',       unit: 'units',   defaultPar: 1,  suggest: h => h.people },
      { id: 'bwf_docs',   name: 'ID, insurance, passports',        category: 'Documents',   unit: 'sets',    defaultPar: 1 },
      { id: 'bwf_cash',   name: 'Cash ($300)',                     category: 'Documents',   unit: 'dollars', defaultPar: 300 },
      { id: 'bwf_hygiene',name: 'Wet wipes + sanitizer',           category: 'Hygiene',     unit: 'packs',   defaultPar: 2 },
      { id: 'bwf_pets',   name: 'Pet supplies (food, leash, vet)', category: 'Pets',        unit: 'sets',    defaultPar: 0,  suggest: h => h.pets > 0 ? 1 : 0 },
    ],
  },
}

const SECTION_TEMPLATES: Record<string, Tmpl[]> = {
  food_water: [
    { id: 'fw_water',    name: 'Stored water',                  category: 'Water',      unit: 'gallons',  defaultPar: 14,  suggest: h => h.people * h.days },
    { id: 'fw_filter',   name: 'Water filter (gravity or pump)',category: 'Water',      unit: 'units',    defaultPar: 1 },
    { id: 'fw_tabs',     name: 'Water purification tablets',    category: 'Water',      unit: 'packs',    defaultPar: 5 },
    { id: 'fw_bleach',   name: 'Unscented bleach',              category: 'Water',      unit: 'bottles',  defaultPar: 2 },
    { id: 'fw_fd',       name: 'Freeze-dried meals',            category: 'Food',       unit: 'meals',    defaultPar: 30,  suggest: h => h.people * h.days },
    { id: 'fw_canned',   name: 'Canned goods (assorted)',       category: 'Food',       unit: 'cans',     defaultPar: 50,  suggest: h => h.people * h.days * 2 },
    { id: 'fw_rice',     name: 'White rice',                    category: 'Food',       unit: 'lbs',      defaultPar: 20,  suggest: h => Math.round(h.people * h.days * 0.5) },
    { id: 'fw_beans',    name: 'Dried beans/lentils',           category: 'Food',       unit: 'lbs',      defaultPar: 10,  suggest: h => Math.round(h.people * h.days * 0.25) },
    { id: 'fw_oats',     name: 'Rolled oats',                   category: 'Food',       unit: 'lbs',      defaultPar: 10,  suggest: h => Math.round(h.people * h.days * 0.2) },
    { id: 'fw_bars',     name: 'Emergency food bars',           category: 'Food',       unit: 'bars',     defaultPar: 12,  suggest: h => h.people * 6 },
    { id: 'fw_salt',     name: 'Salt, sugar, baking staples',   category: 'Food',       unit: 'sets',     defaultPar: 1 },
    { id: 'fw_vitamins', name: 'Multivitamins',                 category: 'Food',       unit: 'bottles',  defaultPar: 2,   suggest: h => h.people },
    { id: 'fw_opener',   name: 'Manual can opener',             category: 'Equipment',  unit: 'units',    defaultPar: 2 },
    { id: 'fw_stove',    name: 'Camp stove',                    category: 'Equipment',  unit: 'units',    defaultPar: 1 },
    { id: 'fw_fuel',     name: 'Fuel canisters / propane',      category: 'Equipment',  unit: 'canisters',defaultPar: 6,   suggest: h => Math.ceil(h.people * h.days / 10) },
    { id: 'fw_utensils', name: 'Eating utensils (camp set)',    category: 'Equipment',  unit: 'sets',     defaultPar: 1,   suggest: h => h.people },
  ],
  medical: [
    { id: 'm_gauze',     name: 'Gauze pads (various sizes)',    category: 'Wound Care', unit: 'packs',   defaultPar: 5 },
    { id: 'm_bandages',  name: 'Adhesive bandages (assorted)',  category: 'Wound Care', unit: 'boxes',   defaultPar: 3 },
    { id: 'm_wrap',      name: 'Elastic bandage wrap',          category: 'Wound Care', unit: 'rolls',   defaultPar: 4 },
    { id: 'm_tape',      name: 'Medical tape',                  category: 'Wound Care', unit: 'rolls',   defaultPar: 3 },
    { id: 'm_tourniquet',name: 'Tourniquet (CAT or similar)',   category: 'Wound Care', unit: 'units',   defaultPar: 2,   suggest: h => h.people },
    { id: 'm_pressure',  name: 'Pressure dressing (Israeli)',   category: 'Wound Care', unit: 'units',   defaultPar: 2 },
    { id: 'm_antiseptic',name: 'Antiseptic wipes/solution',     category: 'Wound Care', unit: 'packs',   defaultPar: 3 },
    { id: 'm_ibuprofen', name: 'Ibuprofen / Advil',             category: 'Medications',unit: 'bottles', defaultPar: 2,   suggest: h => h.people },
    { id: 'm_tylenol',   name: 'Acetaminophen / Tylenol',       category: 'Medications',unit: 'bottles', defaultPar: 2,   suggest: h => h.people },
    { id: 'm_antihist',  name: 'Antihistamine (Benadryl)',      category: 'Medications',unit: 'boxes',   defaultPar: 2 },
    { id: 'm_antidiarr', name: 'Antidiarrheal (Imodium)',       category: 'Medications',unit: 'packs',   defaultPar: 2 },
    { id: 'm_antacid',   name: 'Antacid (Tums, Pepto)',         category: 'Medications',unit: 'bottles', defaultPar: 2 },
    { id: 'm_rx',        name: 'Prescription medications (30d+)',category:'Medications',unit: 'supply',  defaultPar: 1,   suggest: h => h.people },
    { id: 'm_gloves',    name: 'Nitrile gloves',                category: 'Equipment',  unit: 'boxes',   defaultPar: 2 },
    { id: 'm_cpr',       name: 'CPR face shield / mask',        category: 'Equipment',  unit: 'units',   defaultPar: 2 },
    { id: 'm_scissors',  name: 'Medical scissors / shears',     category: 'Equipment',  unit: 'units',   defaultPar: 1 },
    { id: 'm_thermom',   name: 'Thermometer',                   category: 'Equipment',  unit: 'units',   defaultPar: 1 },
    { id: 'm_manual',    name: 'First aid manual',              category: 'Reference',  unit: 'units',   defaultPar: 1 },
    { id: 'm_epi',       name: 'EpiPen (if prescribed)',        category: 'Medications',unit: 'units',   defaultPar: 0 },
  ],
  tools: [
    { id: 't_multi',    name: 'Multi-tool',                    category: 'Hand Tools', unit: 'units',  defaultPar: 1 },
    { id: 't_knife',    name: 'Fixed blade knife',             category: 'Hand Tools', unit: 'units',  defaultPar: 1 },
    { id: 't_axe',      name: 'Hatchet / axe',                category: 'Hand Tools', unit: 'units',  defaultPar: 1 },
    { id: 't_saw',      name: 'Folding saw',                   category: 'Hand Tools', unit: 'units',  defaultPar: 1 },
    { id: 't_shovel',   name: 'Folding/entrenching shovel',    category: 'Hand Tools', unit: 'units',  defaultPar: 1 },
    { id: 't_crowbar',  name: 'Pry bar / crowbar',             category: 'Hand Tools', unit: 'units',  defaultPar: 1 },
    { id: 't_hammer',   name: 'Hammer',                        category: 'Hand Tools', unit: 'units',  defaultPar: 1 },
    { id: 't_tape',     name: 'Duct tape (full roll)',         category: 'Supplies',   unit: 'rolls',  defaultPar: 3 },
    { id: 't_cord',     name: 'Paracord (100 ft)',             category: 'Supplies',   unit: 'rolls',  defaultPar: 2 },
    { id: 't_plastic',  name: 'Heavy-duty plastic sheeting',   category: 'Supplies',   unit: 'rolls',  defaultPar: 1 },
    { id: 't_tarp',     name: 'Heavy tarp',                    category: 'Supplies',   unit: 'units',  defaultPar: 2 },
    { id: 't_zip',      name: 'Zip ties (assorted)',           category: 'Supplies',   unit: 'packs',  defaultPar: 2 },
    { id: 't_rope',     name: 'Utility rope',                  category: 'Supplies',   unit: 'rolls',  defaultPar: 1 },
    { id: 't_gloves',   name: 'Heavy work gloves',             category: 'Safety',     unit: 'pairs',  defaultPar: 2,  suggest: h => h.people },
    { id: 't_goggles',  name: 'Safety goggles',                category: 'Safety',     unit: 'units',  defaultPar: 1,  suggest: h => h.people },
    { id: 't_n95',      name: 'N95 respirators',               category: 'Safety',     unit: 'units',  defaultPar: 20, suggest: h => h.people * 10 },
    { id: 't_drill',    name: 'Cordless drill + bits',         category: 'Power Tools',unit: 'units',  defaultPar: 0 },
    { id: 't_chainsaw', name: 'Chainsaw (gas or battery)',     category: 'Power Tools',unit: 'units',  defaultPar: 0 },
  ],
  comms: [
    { id: 'c_noaa',      name: 'NOAA hand-crank emergency radio',     category: 'Receive',   unit: 'units', defaultPar: 1 },
    { id: 'c_walkie',    name: 'GMRS/FRS walkie talkies',             category: 'Two-Way',   unit: 'pairs', defaultPar: 1 },
    { id: 'c_ham',       name: 'Ham radio HT (e.g. Baofeng UV-5R)',   category: 'Two-Way',   unit: 'units', defaultPar: 0 },
    { id: 'c_satellite', name: 'Satellite communicator (inReach)',     category: 'Emergency', unit: 'units', defaultPar: 0 },
    { id: 'c_whistle',   name: 'Signal whistle',                      category: 'Emergency', unit: 'units', defaultPar: 2, suggest: h => h.people },
    { id: 'c_mirror',    name: 'Signal mirror',                       category: 'Emergency', unit: 'units', defaultPar: 1 },
    { id: 'c_flares',    name: 'Signal flares',                       category: 'Emergency', unit: 'units', defaultPar: 4 },
    { id: 'c_bank',      name: 'Battery bank (20,000 mAh+)',          category: 'Power',     unit: 'units', defaultPar: 2, suggest: h => h.people },
    { id: 'c_solar',     name: 'Solar panel charger',                 category: 'Power',     unit: 'units', defaultPar: 1 },
    { id: 'c_cables',    name: 'USB charging cables (multi-type)',    category: 'Power',     unit: 'sets',  defaultPar: 2 },
    { id: 'c_aa',        name: 'AA batteries',                        category: 'Power',     unit: 'packs', defaultPar: 4 },
    { id: 'c_aaa',       name: 'AAA batteries',                       category: 'Power',     unit: 'packs', defaultPar: 4 },
    { id: 'c_contacts',  name: 'Printed emergency contact list',      category: 'Reference', unit: 'copies',defaultPar: 2 },
    { id: 'c_plan',      name: 'Written emergency communication plan',category: 'Reference', unit: 'copies',defaultPar: 2 },
  ],
  power: [
    { id: 'p_headlamp',  name: 'Headlamp',                            category: 'Lighting',        unit: 'units',   defaultPar: 2,  suggest: h => h.people },
    { id: 'p_flashlight',name: 'Flashlight (heavy duty)',             category: 'Lighting',        unit: 'units',   defaultPar: 2 },
    { id: 'p_lantern',   name: 'LED lantern',                         category: 'Lighting',        unit: 'units',   defaultPar: 2 },
    { id: 'p_candles',   name: 'Candles',                             category: 'Lighting',        unit: 'units',   defaultPar: 20 },
    { id: 'p_lighter',   name: 'Lighters',                            category: 'Fire Starting',   unit: 'units',   defaultPar: 5 },
    { id: 'p_matches',   name: 'Waterproof matches',                  category: 'Fire Starting',   unit: 'boxes',   defaultPar: 3 },
    { id: 'p_ferro',     name: 'Ferro rod / fire starter',            category: 'Fire Starting',   unit: 'units',   defaultPar: 2 },
    { id: 'p_generator', name: 'Generator (gas or dual-fuel)',        category: 'Generator',       unit: 'units',   defaultPar: 0 },
    { id: 'p_gas',       name: 'Gas cans (Sta-Bil treated)',          category: 'Generator',       unit: 'gallons', defaultPar: 0 },
    { id: 'p_station',   name: 'Portable power station (1000Wh+)',   category: 'Solar/Battery',   unit: 'units',   defaultPar: 0 },
    { id: 'p_solar',     name: 'Solar panel array (100W+)',           category: 'Solar/Battery',   unit: 'units',   defaultPar: 0 },
    { id: 'p_aa',        name: 'AA batteries',                        category: 'Batteries',       unit: 'packs',   defaultPar: 6 },
    { id: 'p_aaa',       name: 'AAA batteries',                       category: 'Batteries',       unit: 'packs',   defaultPar: 4 },
    { id: 'p_d',         name: 'D batteries',                         category: 'Batteries',       unit: 'packs',   defaultPar: 2 },
    { id: 'p_ext',       name: 'Heavy-duty extension cord',           category: 'Equipment',       unit: 'units',   defaultPar: 1 },
  ],
  documents: [
    { id: 'd_passport',  name: 'Passports',                           category: 'Identity',        unit: 'units',  defaultPar: 1,  suggest: h => h.people },
    { id: 'd_id',        name: 'Driver\'s license / gov ID copies',  category: 'Identity',        unit: 'copies', defaultPar: 2,  suggest: h => h.people * 2 },
    { id: 'd_birth',     name: 'Birth certificates',                  category: 'Identity',        unit: 'units',  defaultPar: 1,  suggest: h => h.people },
    { id: 'd_ss',        name: 'Social security cards / copies',     category: 'Identity',        unit: 'copies', defaultPar: 1,  suggest: h => h.people },
    { id: 'd_insurance', name: 'Insurance documents (home/health/auto)',category: 'Financial',     unit: 'sets',   defaultPar: 1 },
    { id: 'd_cash',      name: 'Cash (small bills, $20s and under)', category: 'Financial',       unit: 'dollars',defaultPar: 500 },
    { id: 'd_coins',     name: 'Coins (quarters)',                    category: 'Financial',       unit: 'dollars',defaultPar: 20 },
    { id: 'd_usb',       name: 'USB drive with digital doc copies',  category: 'Digital',         unit: 'units',  defaultPar: 2 },
    { id: 'd_contacts',  name: 'Printed emergency contact list',     category: 'Reference',       unit: 'copies', defaultPar: 3 },
    { id: 'd_evac',      name: 'Evacuation plan + rally points',     category: 'Reference',       unit: 'copies', defaultPar: 2 },
    { id: 'd_maps',      name: 'Paper maps (local + regional)',      category: 'Reference',       unit: 'sets',   defaultPar: 1 },
    { id: 'd_medical',   name: 'Medical records / vaccination history',category:'Medical',        unit: 'copies', defaultPar: 1,  suggest: h => h.people },
    { id: 'd_rx',        name: 'Prescription info + pharmacy contacts',category:'Medical',        unit: 'copies', defaultPar: 1,  suggest: h => h.people },
    { id: 'd_property',  name: 'Property deeds / lease agreement',  category: 'Legal',           unit: 'copies', defaultPar: 1 },
    { id: 'd_will',      name: 'Will / power of attorney',          category: 'Legal',           unit: 'copies', defaultPar: 1 },
  ],
  shelter: [
    { id: 'sh_sleeping', name: 'Sleeping bag (season-appropriate)',  category: 'Bedding',       unit: 'units', defaultPar: 1,  suggest: h => h.people },
    { id: 'sh_pad',      name: 'Sleeping pad / insulating mat',      category: 'Bedding',       unit: 'units', defaultPar: 1,  suggest: h => h.people },
    { id: 'sh_blanket',  name: 'Wool/fleece blanket',                category: 'Bedding',       unit: 'units', defaultPar: 2,  suggest: h => h.people * 2 },
    { id: 'sh_mylar',    name: 'Emergency mylar blankets',           category: 'Bedding',       unit: 'units', defaultPar: 4,  suggest: h => h.people * 2 },
    { id: 'sh_tent',     name: 'Tent (sized for household)',         category: 'Shelter',       unit: 'units', defaultPar: 1 },
    { id: 'sh_tarp',     name: 'Heavy-duty tarp',                    category: 'Shelter',       unit: 'units', defaultPar: 2 },
    { id: 'sh_plastic',  name: 'Heavy-duty plastic sheeting',        category: 'Shelter',       unit: 'rolls', defaultPar: 1 },
    { id: 'sh_rain_j',   name: 'Waterproof rain jacket',             category: 'Clothing',      unit: 'units', defaultPar: 1,  suggest: h => h.people },
    { id: 'sh_rain_p',   name: 'Waterproof rain pants',              category: 'Clothing',      unit: 'units', defaultPar: 1,  suggest: h => h.people },
    { id: 'sh_boots',    name: 'Waterproof work boots',              category: 'Clothing',      unit: 'pairs', defaultPar: 1,  suggest: h => h.people },
    { id: 'sh_socks',    name: 'Wool socks (multiple pairs)',        category: 'Clothing',      unit: 'pairs', defaultPar: 3,  suggest: h => h.people * 3 },
    { id: 'sh_layers',   name: 'Cold weather base layers',           category: 'Clothing',      unit: 'sets',  defaultPar: 2,  suggest: h => h.people * 2 },
    { id: 'sh_gloves',   name: 'Winter gloves',                      category: 'Clothing',      unit: 'pairs', defaultPar: 1,  suggest: h => h.people },
    { id: 'sh_hat',      name: 'Warm hat / balaclava',               category: 'Clothing',      unit: 'units', defaultPar: 1,  suggest: h => h.people },
    { id: 'sh_poncho',   name: 'Emergency rain poncho',              category: 'Clothing',      unit: 'units', defaultPar: 2,  suggest: h => h.people * 2 },
    { id: 'sh_toilet',   name: 'Emergency toilet / sanitation bucket',category:'Sanitation',    unit: 'units', defaultPar: 1 },
    { id: 'sh_bags',     name: 'Waste bags (for emergency toilet)',  category: 'Sanitation',    unit: 'boxes', defaultPar: 2 },
    { id: 'sh_sanitizer',name: 'Hand sanitizer',                     category: 'Sanitation',    unit: 'bottles',defaultPar: 6, suggest: h => h.people * 2 },
    { id: 'sh_soap',     name: 'Soap (bar or liquid)',               category: 'Sanitation',    unit: 'units', defaultPar: 6,  suggest: h => h.people * 2 },
  ],
}

const SECTIONS = [
  { id: 'bob',        label: 'Bug Out Bag',      bob: true  },
  { id: 'food_water', label: 'Food & Water',     bob: false },
  { id: 'medical',    label: 'Medical',          bob: false },
  { id: 'tools',      label: 'Tools & Equipment',bob: false },
  { id: 'comms',      label: 'Communications',   bob: false },
  { id: 'power',      label: 'Power & Lighting', bob: false },
  { id: 'documents',  label: 'Documents',        bob: false },
  { id: 'shelter',    label: 'Shelter & Clothing',bob: false },
] as const

const ALL_KEYS = [
  ...Object.keys(BOB_TEMPLATES).map(s => `bob_${s}`),
  ...SECTIONS.filter(s => !s.bob).map(s => s.id),
]

function invStatus(qty: number, par: number): 'ok' | 'low' | 'out' {
  if (qty === 0) return 'out'
  if (par > 0 && qty < par) return 'low'
  return 'ok'
}
const SC = { ok: '#22C55E', low: '#F59E0B', out: '#EF4444' }
const SL = { ok: 'OK', low: 'LOW', out: 'OUT' }

function loadHousehold(): Household {
  try { const v = localStorage.getItem('fenris_household'); return v ? JSON.parse(v) : { people: 2, pets: 0, days: 14 } } catch { return { people: 2, pets: 0, days: 14 } }
}
function loadItems(key: string): InvItem[] {
  try { const v = localStorage.getItem(`fenris_inv_${key}`); return v ? JSON.parse(v) : [] } catch { return [] }
}

function chipBtn(label: string, active: boolean, onClick: () => void, color?: string) {
  return (
    <button key={label} onClick={onClick} style={{
      padding: '5px 13px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)',
      cursor: 'pointer', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' as const,
      border: `1px solid ${active ? (color || 'var(--color-accent)') : 'var(--color-border)'}`,
      background: active ? `${color || 'var(--color-accent)'}18` : 'transparent',
      color: active ? (color || 'var(--color-accent)') : 'var(--color-muted)',
    }}>
      {label}
    </button>
  )
}

function InventoryManager() {
  const isMobile = useIsMobile()
  const [household, setHousehold] = useState<Household>(loadHousehold)
  const [showHousehold, setShowHousehold] = useState(false)
  const [section, setSection] = useState<string>('bob')
  const [bobScenario, setBobScenario] = useState<string>('72hr')
  const [allItems, setAllItems] = useState<Record<string, InvItem[]>>(() =>
    Object.fromEntries(ALL_KEYS.map(k => [k, loadItems(k)]))
  )
  const [showUntracked, setShowUntracked] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [filterCat, setFilterCat] = useState('')
  const [form, setForm] = useState({ name: '', category: '', qty: '0', unit: '', par: '0', expiry: '', note: '' })
  const [formErr, setFormErr] = useState<string | null>(null)
  const [suggestDone, setSuggestDone] = useState(false)

  useEffect(() => {
    for (const [k, v] of Object.entries(allItems)) {
      localStorage.setItem(`fenris_inv_${k}`, JSON.stringify(v))
    }
  }, [allItems])

  useEffect(() => {
    localStorage.setItem('fenris_household', JSON.stringify(household))
  }, [household])

  const sectionKey = section === 'bob' ? `bob_${bobScenario}` : section
  const templates: Tmpl[] = section === 'bob'
    ? (BOB_TEMPLATES[bobScenario]?.items ?? [])
    : (SECTION_TEMPLATES[section] ?? [])
  const items = allItems[sectionKey] ?? []
  const trackedIds = new Set(items.map(i => i.templateId).filter(Boolean))
  const untracked = templates.filter(t => !trackedIds.has(t.id))
  const displayed = filterCat ? items.filter(i => i.category === filterCat) : items
  const sortedItems = [...displayed].sort((a, b) => {
    const o = { out: 0, low: 1, ok: 2 }
    const d = o[invStatus(a.qty, a.par)] - o[invStatus(b.qty, b.par)]
    return d !== 0 ? d : a.name.localeCompare(b.name)
  })

  const h: Household = { people: household.people || 2, pets: household.pets || 0, days: household.days || 14 }
  const today = new Date().toISOString().slice(0, 10)
  const soonDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  const outCount = items.filter(i => invStatus(i.qty, i.par) === 'out').length
  const lowCount = items.filter(i => invStatus(i.qty, i.par) === 'low').length
  const okCount = items.filter(i => invStatus(i.qty, i.par) === 'ok').length
  const coverage = templates.length > 0
    ? Math.round((items.filter(i => i.templateId).length / templates.length) * 100)
    : (items.length > 0 ? 100 : 0)

  // Section status dots for tabs
  function sectionAlert(sId: string): string | null {
    const keys = sId === 'bob' ? Object.keys(BOB_TEMPLATES).map(s => `bob_${s}`) : [sId]
    for (const k of keys) {
      const its = allItems[k] ?? []
      if (its.some(i => invStatus(i.qty, i.par) === 'out')) return '#EF4444'
      if (its.some(i => invStatus(i.qty, i.par) === 'low')) return '#F59E0B'
    }
    return null
  }

  function addTemplate(tmpl: Tmpl) {
    const par = tmpl.suggest ? tmpl.suggest(h) : tmpl.defaultPar
    const newItem: InvItem = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      templateId: tmpl.id, name: tmpl.name, category: tmpl.category,
      qty: 0, unit: tmpl.unit, par, expiry: '', note: '',
    }
    setAllItems(prev => ({ ...prev, [sectionKey]: [...(prev[sectionKey] ?? []), newItem] }))
  }

  function applySuggest() {
    const newItems: InvItem[] = untracked.map(t => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      templateId: t.id, name: t.name, category: t.category,
      qty: 0, unit: t.unit,
      par: t.suggest ? t.suggest(h) : t.defaultPar,
      expiry: '', note: '',
    }))
    const updated = items.map(item => {
      if (!item.templateId) return item
      const tmpl = templates.find(t => t.id === item.templateId)
      if (!tmpl?.suggest) return item
      return { ...item, par: tmpl.suggest(h) }
    })
    setAllItems(prev => ({ ...prev, [sectionKey]: [...updated, ...newItems] }))
    setSuggestDone(true)
    setTimeout(() => setSuggestDone(false), 2000)
  }

  function adjustQty(id: string, delta: number) {
    setAllItems(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] ?? []).map(i =>
        i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i
      ),
    }))
  }

  function removeItem(id: string) {
    setAllItems(prev => ({
      ...prev,
      [sectionKey]: (prev[sectionKey] ?? []).filter(i => i.id !== id),
    }))
  }

  function addCustom() {
    if (!form.name.trim()) { setFormErr('Name required'); return }
    const qty = parseFloat(form.qty), par = parseFloat(form.par)
    if (isNaN(qty) || qty < 0) { setFormErr('Invalid quantity'); return }
    if (isNaN(par) || par < 0) { setFormErr('Invalid par level'); return }
    setAllItems(prev => ({
      ...prev,
      [sectionKey]: [...(prev[sectionKey] ?? []), {
        id: `${Date.now()}_custom`,
        templateId: null,
        name: form.name.trim(), category: form.category || 'Other',
        qty, unit: form.unit.trim() || 'units', par,
        expiry: form.expiry, note: form.note.trim(),
      }],
    }))
    setForm({ name: '', category: '', qty: '0', unit: '', par: '0', expiry: '', note: '' })
    setFormErr(null)
    setShowAdd(false)
  }

  const cats = Array.from(new Set(items.map(i => i.category))).sort()
  const formCats = Array.from(new Set(templates.map(t => t.category))).sort()

  // Group untracked by category
  const untrackedByCat: Record<string, Tmpl[]> = {}
  for (const t of untracked) {
    if (!untrackedByCat[t.category]) untrackedByCat[t.category] = []
    untrackedByCat[t.category].push(t)
  }

  return (
    <div>
      {/* Household data bar */}
      <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '20px', overflow: 'hidden' }}>
        <button
          onClick={() => setShowHousehold(v => !v)}
          style={{ width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Household
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-text)' }}>
              {h.people} {h.people === 1 ? 'person' : 'people'}{h.pets > 0 ? ` + ${h.pets} pet${h.pets !== 1 ? 's' : ''}` : ''} &nbsp;/&nbsp; {h.days}-day target
            </span>
            {!showHousehold && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)' }}>powers suggested builds</span>}
          </div>
          <span style={{ color: 'var(--color-subtle)', fontSize: '12px', flexShrink: 0 }}>{showHousehold ? 'close' : 'edit'}</span>
        </button>
        {showHousehold && (
          <div style={{ padding: '0 16px 16px', display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '12px' }}>
            <div>
              <label style={labelStyle}>People</label>
              <input type="number" min={1} max={20} value={household.people || ''} onChange={e => setHousehold(p => ({ ...p, people: +e.target.value || 1 }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Pets</label>
              <input type="number" min={0} max={20} value={household.pets ?? ''} onChange={e => setHousehold(p => ({ ...p, pets: +e.target.value || 0 }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Target days</label>
              <input type="number" min={1} max={365} value={household.days || ''} onChange={e => setHousehold(p => ({ ...p, days: +e.target.value || 14 }))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button onClick={() => setShowHousehold(false)} style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: 'none', background: 'var(--color-accent)', color: '#0A0A0A', fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '16px', scrollbarWidth: 'none' as const }}>
        {SECTIONS.map(s => {
          const alert = sectionAlert(s.id)
          const isActive = section === s.id
          return (
            <button key={s.id} onClick={() => { setSection(s.id); setFilterCat('') }} style={{
              padding: '6px 14px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)',
              cursor: 'pointer', fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap' as const, flexShrink: 0,
              border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border)'}`,
              background: isActive ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: isActive ? 'var(--color-accent)' : 'var(--color-muted)',
              position: 'relative' as const,
            }}>
              {s.label}
              {alert && !isActive && (
                <span style={{ position: 'absolute', top: '4px', right: '4px', width: '5px', height: '5px', borderRadius: '50%', background: alert }} />
              )}
            </button>
          )
        })}
      </div>

      {/* BOB scenario sub-tabs */}
      {section === 'bob' && (
        <div style={{ display: 'flex', gap: '6px', marginBottom: '20px', flexWrap: 'wrap' }}>
          {Object.entries(BOB_TEMPLATES).map(([key, val]) => {
            const sKey = `bob_${key}`
            const its = allItems[sKey] ?? []
            const hasOut = its.some(i => invStatus(i.qty, i.par) === 'out')
            const hasLow = its.some(i => invStatus(i.qty, i.par) === 'low')
            const isActive = bobScenario === key
            return (
              <button key={key} onClick={() => { setBobScenario(key); setFilterCat('') }} style={{
                padding: '5px 14px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)',
                cursor: 'pointer', fontWeight: isActive ? 600 : 400,
                border: `1px solid ${isActive ? '#F59E0B' : 'var(--color-border)'}`,
                background: isActive ? 'rgba(245,158,11,0.1)' : 'transparent',
                color: isActive ? '#F59E0B' : 'var(--color-muted)',
                display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                {val.label}
                {!isActive && (hasOut || hasLow) && (
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: hasOut ? '#EF4444' : '#F59E0B', flexShrink: 0 }} />
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {/* Coverage bar */}
        {templates.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '0 0 auto' }}>
            <div style={{ width: '80px', height: '4px', background: 'var(--color-border)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${coverage}%`, background: coverage === 100 ? 'var(--color-accent)' : coverage > 50 ? '#F59E0B' : '#EF4444', borderRadius: '2px', transition: 'width 0.3s' }} />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{coverage}% tracked</span>
          </div>
        )}
        {outCount > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '4px', padding: '2px 8px' }}>{outCount} out</span>}
        {lowCount > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '4px', padding: '2px 8px' }}>{lowCount} low</span>}
        {okCount > 0 && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: '4px', padding: '2px 8px' }}>{okCount} stocked</span>}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {untracked.length > 0 && (
            <button onClick={applySuggest} style={{
              padding: '5px 12px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)',
              cursor: 'pointer', border: '1px solid var(--color-border)',
              background: suggestDone ? 'rgba(34,197,94,0.1)' : 'transparent',
              color: suggestDone ? 'var(--color-accent)' : 'var(--color-muted)',
            }}>
              {suggestDone ? 'Applied' : `Suggest build (${untracked.length} items)`}
            </button>
          )}
          <button onClick={() => setShowAdd(v => !v)} style={{
            padding: '5px 14px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-display)',
            cursor: 'pointer', fontWeight: 600, border: 'none',
            background: showAdd ? 'var(--color-border)' : 'var(--color-accent)',
            color: showAdd ? 'var(--color-muted)' : '#0A0A0A',
          }}>
            {showAdd ? 'Cancel' : '+ Add custom'}
          </button>
        </div>
      </div>

      {/* Custom add form */}
      {showAdd && (
        <div style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {formErr && <div style={{ padding: '8px 12px', borderRadius: '4px', fontSize: '12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}>{formErr}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '2fr 1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Item name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Water filter" style={inputStyle} onKeyDown={e => e.key === 'Enter' && addCustom()} />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={inputStyle}>
                <option value="">Other</option>
                {formCats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Qty on hand</label>
              <input type="number" min={0} value={form.qty} onChange={e => setForm(f => ({ ...f, qty: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Unit</label>
              <input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="gallons, lbs..." style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={labelStyle}>Par level (target)</label>
              <input type="number" min={0} value={form.par} onChange={e => setForm(f => ({ ...f, par: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Expiry (optional)</label>
              <input type="date" value={form.expiry} onChange={e => setForm(f => ({ ...f, expiry: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Note (optional)</label>
              <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Location, brand..." style={inputStyle} />
            </div>
          </div>
          <button onClick={addCustom} style={{ alignSelf: 'flex-start', padding: '7px 20px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-display)', fontWeight: 600, cursor: 'pointer', border: 'none', background: 'var(--color-accent)', color: '#0A0A0A' }}>
            Add to inventory
          </button>
        </div>
      )}

      {/* Category filter chips */}
      {cats.length > 1 && (
        <div style={{ display: 'flex', gap: '5px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {(['', ...cats]).map(cat => chipBtn(cat || 'All', filterCat === cat, () => setFilterCat(cat)))}
        </div>
      )}

      {/* Tracked items */}
      {sortedItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: 'var(--color-border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '20px' }}>
          {sortedItems.map(item => {
            const status = invStatus(item.qty, item.par)
            const color = SC[status]
            const expired = item.expiry && item.expiry < today
            const expiring = item.expiry && !expired && item.expiry <= soonDate
            return (
              <div key={item.id} style={{ background: 'var(--color-surface)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {item.name}
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '3px', padding: '0 5px' }}>{item.category}</span>
                    {expired  && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#EF4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '3px', padding: '0 5px' }}>EXPIRED</span>}
                    {expiring && <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: '#F59E0B', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '3px', padding: '0 5px' }}>exp soon</span>}
                  </div>
                  {item.note && <div style={{ fontSize: '11px', color: 'var(--color-subtle)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>{item.note}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  <button onClick={() => adjustQty(item.id, -1)} style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color, minWidth: '28px', textAlign: 'center' }}>{item.qty}</span>
                  <button onClick={() => adjustQty(item.id, 1)} style={{ width: '22px', height: '22px', borderRadius: '3px', border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-muted)', cursor: 'pointer', fontSize: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)', marginLeft: '2px' }}>/ {item.par} {item.unit}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color, background: `${color}18`, border: `1px solid ${color}33`, borderRadius: '3px', padding: '2px 6px', flexShrink: 0 }}>{SL[status]}</span>
                <button onClick={() => removeItem(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--color-subtle)', cursor: 'pointer', fontSize: '16px', lineHeight: '1', padding: '0 2px', flexShrink: 0 }}>×</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Empty tracked state */}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px 24px', border: '1px dashed var(--color-border)', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>Nothing tracked yet</div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'var(--color-muted)', lineHeight: 1.6 }}>
            Check items below to start tracking, or click "Suggest build" to add the full suggested list at once.
          </div>
        </div>
      )}

      {/* Untracked templates checklist */}
      {untracked.length > 0 && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', overflow: 'hidden' }}>
          <button
            onClick={() => setShowUntracked(v => !v)}
            style={{ width: '100%', padding: '12px 16px', background: 'var(--color-bg)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <span style={{ fontFamily: 'var(--font-display)', fontSize: '12px', fontWeight: 600, color: 'var(--color-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Not yet tracked ({untracked.length} items)
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-subtle)' }}>{showUntracked ? 'hide' : 'show'}</span>
          </button>
          {showUntracked && (
            <div style={{ padding: '4px 0 12px' }}>
              {Object.entries(untrackedByCat).map(([cat, catItems]) => (
                <div key={cat}>
                  <div style={{ padding: '8px 16px 4px', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{cat}</div>
                  {catItems.map(tmpl => {
                    const suggested = tmpl.suggest ? tmpl.suggest(h) : tmpl.defaultPar
                    return (
                      <label key={tmpl.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px', cursor: 'pointer' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <input type="checkbox" checked={false} onChange={() => addTemplate(tmpl)}
                          style={{ accentColor: 'var(--color-accent)', width: '13px', height: '13px', flexShrink: 0, cursor: 'pointer' }} />
                        <span style={{ fontSize: '13px', color: 'var(--color-muted)', flex: 1, fontFamily: 'var(--font-body)' }}>{tmpl.name}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', flexShrink: 0 }}>
                          target: {suggested} {tmpl.unit}
                        </span>
                      </label>
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ marginTop: '12px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--color-subtle)', textAlign: 'right' }}>
          {items.length} item{items.length !== 1 ? 's' : ''} in this section &nbsp;·&nbsp; saved locally
        </div>
      )}
    </div>
  )
}

// ─── Tool registry ─────────────────────────────────────────────────────────────

const TOOLS = [
  {
    id: 'inventory',
    name: 'Inventory Manager',
    desc: 'Track your entire prep across 8 categories. Pre-filled checklists, par levels, expiry alerts, suggested builds from your household profile.',
    component: <InventoryManager />,
  },
  {
    id: 'water',
    name: 'Water Storage Calculator',
    desc: 'How much water you need stored for your household size, duration, climate, and activity level.',
    component: <WaterCalculator />,
  },
  {
    id: 'calories',
    name: 'Caloric Needs Calculator',
    desc: 'Daily caloric requirements by household composition and activity level. Includes 30-day storage estimates.',
    component: <CaloricCalculator />,
  },
]

const TOOL_LINKS = [
  {
    id: 'frequencies',
    name: 'Emergency Frequency Database',
    desc: 'Police, fire, EMS, ham radio, NOAA weather, and GMRS frequencies by county. Community-maintained reference.',
    link: '/frequencies',
  },
  {
    id: 'aar',
    name: 'After Action Reports',
    desc: 'Real emergencies documented by community members. What worked, what failed, what they wish they had.',
    link: '/aar',
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
            onClick={() => !tool.coming && setSelected(selected === tool.id ? null : tool.id)}
            style={{
              textAlign: 'left', background: 'var(--color-surface)', cursor: tool.coming ? 'default' : 'pointer',
              border: `1px solid ${selected === tool.id ? 'var(--color-accent)' : 'var(--color-border)'}`,
              borderRadius: '8px', padding: '20px', outline: 'none', opacity: tool.coming ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!tool.coming) e.currentTarget.style.borderColor = 'var(--color-accent)' }}
            onMouseLeave={e => { if (selected !== tool.id) e.currentTarget.style.borderColor = 'var(--color-border)' }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '6px' }}>{tool.name}</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'var(--color-muted)', lineHeight: 1.5, marginBottom: tool.coming ? '10px' : '0' }}>{tool.desc}</div>
            {tool.coming && <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coming soon</div>}
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

      {active && !active.coming && (
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
