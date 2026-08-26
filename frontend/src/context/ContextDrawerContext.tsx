import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface DrawerState {
  slug: string | null
  type?: string
}

interface ContextDrawerCtx {
  slug: string | null
  type?: string
  open: (slug: string, type?: string) => void
  close: () => void
}

const ContextDrawerContext = createContext<ContextDrawerCtx>({
  slug: null,
  open: () => {},
  close: () => {},
})

export function ContextDrawerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DrawerState>({ slug: null })

  const open = useCallback((slug: string, type?: string) => setState({ slug, type }), [])
  const close = useCallback(() => setState({ slug: null, type: undefined }), [])

  return (
    <ContextDrawerContext.Provider value={{ slug: state.slug, type: state.type, open, close }}>
      {children}
    </ContextDrawerContext.Provider>
  )
}

export function useContextDrawer() {
  return useContext(ContextDrawerContext)
}
