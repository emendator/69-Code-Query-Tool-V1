import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { ColumnConfigItem } from '../types'
import { fetchColumnConfigs, updateColumnConfigs } from '../api'

interface ViewConfig {
    columns: ColumnConfigItem[]
    visibleColumns: ColumnConfigItem[]
}

interface ConfigContextValue {
    data: ViewConfig
    query: ViewConfig
    loading: boolean
    refresh: () => Promise<void>
    save: (viewType: string, cols: ColumnConfigItem[]) => Promise<void>
}

const emptyView: ViewConfig = { columns: [], visibleColumns: [] }

const ConfigContext = createContext<ConfigContextValue>({
    data: emptyView,
    query: emptyView,
    loading: false,
    refresh: async () => { },
    save: async () => { },
})

export function ConfigProvider({ children }: { children: ReactNode }) {
    const [dataColumns, setDataColumns] = useState<ColumnConfigItem[]>([])
    const [queryColumns, setQueryColumns] = useState<ColumnConfigItem[]>([])
    const [loading, setLoading] = useState(false)

    const refresh = useCallback(async () => {
        setLoading(true)
        try {
            const [data, query] = await Promise.all([
                fetchColumnConfigs('data'),
                fetchColumnConfigs('query'),
            ])
            setDataColumns(data)
            setQueryColumns(query)
        } catch {
            // ignore
        } finally {
            setLoading(false)
        }
    }, [])

    const save = useCallback(async (viewType: string, cols: ColumnConfigItem[]) => {
        const withViewType = cols.map((c) => ({ ...c, view_type: viewType }))
        await updateColumnConfigs(withViewType)
        if (viewType === 'data') {
            setDataColumns(cols)
        } else {
            setQueryColumns(cols)
        }
    }, [])

    useEffect(() => {
        refresh()
    }, [refresh])

    const data: ViewConfig = {
        columns: dataColumns,
        visibleColumns: dataColumns.filter((c) => c.visible).sort((a, b) => a.sort_order - b.sort_order),
    }
    const query: ViewConfig = {
        columns: queryColumns,
        visibleColumns: queryColumns.filter((c) => c.visible).sort((a, b) => a.sort_order - b.sort_order),
    }

    return (
        <ConfigContext.Provider value={{ data, query, loading, refresh, save }}>
            {children}
        </ConfigContext.Provider>
    )
}

export function useConfig() {
    return useContext(ConfigContext)
}
