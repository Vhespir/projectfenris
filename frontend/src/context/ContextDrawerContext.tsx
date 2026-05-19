import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

interface DrawerState {
  slug: string | null
}

interface ContextDrawerCtx {
  slug: string | null
  open: (slug: string) => void
  close: () => void
}

const ContextDrawerContext = createContext<ContextDrawerCtx>({
  slug: null,
  open: () => {},
  close: () => {},
})

export function ContextDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState>({ slug: null })

  const open = useCallback((slug: string) => setState({ slug }), [])
  const close = useCallback(() => setState({ slug: null }), [])

  return (
    <ContextDrawerContext.Provider value={{ slug: state.slug, open, close }}>
      {children}
    </ContextDrawerContext.Provider>
  )
}

export function useContextDrawer() {
  return useContext(ContextDrawerContext)
}
