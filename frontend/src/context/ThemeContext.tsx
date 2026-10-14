import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { ThemeMode } from '../theme'

const THEME_KEY = '69code_theme'

interface ThemeContextValue {
    mode: ThemeMode
    toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
    mode: 'dark',
    toggle: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [mode, setMode] = useState<ThemeMode>(() => {
        const saved = localStorage.getItem(THEME_KEY)
        return saved === 'light' ? 'light' : 'dark'
    })

    useEffect(() => {
        document.documentElement.dataset.theme = mode
        localStorage.setItem(THEME_KEY, mode)
    }, [mode])

    const toggle = useCallback(() => {
        setMode((m) => (m === 'dark' ? 'light' : 'dark'))
    }, [])

    return (
        <ThemeContext.Provider value={{ mode, toggle }}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    return useContext(ThemeContext)
}
