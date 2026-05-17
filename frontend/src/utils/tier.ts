export interface Tier {
  title: string
  short: string
  color: string
}

export function getTier(reputation: number): Tier | null {
  if (reputation >= 2500) return { title: 'Sentinel',           short: 'Sentinel', color: '#F59E0B' }
  if (reputation >= 1001) return { title: 'Operator',           short: 'Operator', color: '#F97316' }
  if (reputation >= 501)  return { title: 'Trusted Contributor', short: 'Trusted',  color: '#3B82F6' }
  if (reputation >= 101)  return { title: 'Contributor',         short: 'Contrib',  color: '#94A3B8' }
  return null // Member -- no badge
}
