import { useState, useMemo } from 'react'
import {
    Card,
    Input,
    Button,
    Table,
    Space,
    Typography,
    message,
    Skeleton,
} from 'antd'
import { SearchOutlined, DownloadOutlined, ClearOutlined, InboxOutlined } from '@ant-design/icons'
import Magnetic from '../components/motion/Magnetic'
import Tilt from '../components/motion/Tilt'
import CountUp from '../components/motion/CountUp'
import type { ColumnType } from 'antd/es/table'
import { queryBatch, queryFuzzy } from '../api'
import { useConfig } from '../context/ConfigContext'
import type { BatchQueryItem, Product } from '../types'
import ExportDrawer from '../components/ExportDrawer'

const { TextArea } = Input
const { Text } = Typography

interface MergedRow {
    key: number
    code: string
    model: string
    name: string
    source: string
    remark: string
    created_at: string
    updated_at: string
    matchType: 'exact' | 'fuzzy' | 'notfound'
    searchCode?: string  // original input code for not-found items
}

export default function QueryPage() {
    const { query } = useConfig()
    const visibleColumns = query.visibleColumns
    const [rawInput, setRawInput] = useState('')
    const [allRows, setAllRows] = useState<MergedRow[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
    const [exportOpen, setExportOpen] = useState(false)

    const lineCount = useMemo(() => rawInput.split('\n').filter((s) => s.trim()).length, [rawInput])

    const handleQuery = async () => {
        const lines = rawInput.split('\n').map((s) => s.trim()).filter(Boolean)
        if (lines.length === 0) {
            message.warning('请输入 69 码或关键词')
            return
        }
        setLoading(true)
        try {
            // 1. Exact batch match for all lines
            const exactData = await queryBatch(lines)
            const exactMap = new Map<string, Product>()
            const satisfiedLines = new Set<string>()   // input lines that have results
            for (const item of exactData) {
                if (item.found && item.row) {
                    exactMap.set(item.code, item.row)
                    satisfiedLines.add(item.code)
                }
            }

            // 2. Fuzzy search per line — for each input line not yet satisfied
            const fuzzyMap = new Map<string, Product>()
            const dedupedLines = [...new Set(lines)]
            const fuzzyPromises = dedupedLines.map(async (line) => {
                const results = await queryFuzzy(line)
                if (results.length > 0) satisfiedLines.add(line)
                return results
            })
            const allFuzzyResults = await Promise.all(fuzzyPromises)
            for (const results of allFuzzyResults) {
                for (const p of results) {
                    if (!fuzzyMap.has(p.code)) fuzzyMap.set(p.code, p)
                }
            }

            // 3. Merge: exact → fuzzy → not found
            const rows: MergedRow[] = []
            const seenProductCodes = new Set<string>()

            // Exact matches first
            for (const [code, product] of exactMap) {
                rows.push({ ...product, key: rows.length, matchType: 'exact' })
                seenProductCodes.add(code)
            }

            // Fuzzy matches (only those not already in exact)
            for (const [code, product] of fuzzyMap) {
                if (!seenProductCodes.has(code)) {
                    rows.push({ ...product, key: rows.length, matchType: 'fuzzy' })
                    seenProductCodes.add(code)
                }
            }

            // Not-found: only input lines that had zero results at all
            for (const code of lines) {
                if (!satisfiedLines.has(code)) {
                    rows.push({
                        key: rows.length,
                        code: code,
                        model: '',
                        name: '',
                        source: '',
                        remark: '',
                        created_at: '',
                        updated_at: '',
                        matchType: 'notfound',
                        searchCode: code,
                    })
                }
            }

            setAllRows(rows)
            setSelectedRowKeys([])
        } catch (e: any) {
            message.error(e.message)
        } finally {
            setLoading(false)
        }
    }

    const handleClear = () => {
        setRawInput('')
        setAllRows([])
        setSelectedRowKeys([])
    }

    const handleExport = () => {
        if (allRows.length === 0) {
            message.warning('没有可导出的数据')
            return
        }
        setExportOpen(true)
    }

    const notFoundCount = allRows.filter((r) => r.matchType === 'notfound').length
    const exactCount = allRows.filter((r) => r.matchType === 'exact').length
    const fuzzyCount = allRows.filter((r) => r.matchType === 'fuzzy').length

    // ── Merged table columns ──
    const tableColumns: ColumnType<MergedRow>[] = [
        {
            title: '匹配',
            key: 'matchType',
            width: 116,
            fixed: 'left',
            render: (_: any, record: MergedRow) => {
                switch (record.matchType) {
                    case 'exact':
                        return <span className="tag-soft tag-exact">精确匹配</span>
                    case 'fuzzy':
                        return <span className="tag-soft tag-fuzzy">模糊匹配</span>
                    case 'notfound':
                        return <span className="tag-soft tag-miss">未找到</span>
                }
            },
        },
        ...visibleColumns
            .filter((c) => c.field !== 'id')
            .map((cfg) => ({
                title: cfg.label,
                dataIndex: cfg.field as keyof MergedRow,
                key: cfg.field,
                width: cfg.width,
                render: (val: any, record: MergedRow) => {
                    if (record.matchType === 'notfound') {
                        if (cfg.field === 'code') return <Text style={{ color: 'var(--text3)' }}>{record.searchCode}</Text>
                        return <span style={{ color: 'var(--text5)' }}>—</span>
                    }
                    if (cfg.field === 'code') {
                        return (
                            <Text
                                copyable
                                style={{ fontFamily: 'Consolas, Menlo, monospace', letterSpacing: '0.02em' }}
                            >
                                {val ?? ''}
                            </Text>
                        )
                    }
                    return val ?? ''
                },
            })),
    ]

    const rowSelection = {
        selectedRowKeys,
        onChange: (keys: React.Key[]) => setSelectedRowKeys(keys as number[]),
    }

    const exportData = useMemo(() => {
        const selected = selectedRowKeys.length > 0
            ? allRows.filter((_, i) => selectedRowKeys.includes(i))
            : allRows
        return selected.map((r) => ({
            '匹配方式': r.matchType === 'exact' ? '精确' : r.matchType === 'fuzzy' ? '模糊' : '未找到',
            code: r.code,
            model: r.model,
            name: r.name,
            source: r.source,
            remark: r.remark,
            created_at: r.created_at,
            updated_at: r.updated_at,
        }))
    }, [allRows, selectedRowKeys])

    const renderBody = () => {
        if (loading) {
            return (
                <Card>
                    <Skeleton
                        active
                        paragraph={{ rows: 5 }}
                        title={{ width: '32%' }}
                        style={{ padding: '12px 8px' }}
                    />
                    <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginTop: 10 }}>
                        正在查询…
                    </div>
                </Card>
            )
        }
        if (allRows.length === 0) {
            return (
                <div className="empty-craft">
                    <div className="empty-mark"><InboxOutlined /></div>
                    <div className="empty-title">暂无查询结果</div>
                    <div className="empty-desc">
                        在上方输入 69 码或关键词（每行一个），点击「查询」。
                        系统会自动执行精确匹配，并对未命中的条目进行模糊搜索。
                    </div>
                </div>
            )
        }
        return (
            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={allRows}
                    columns={tableColumns}
                    rowSelection={rowSelection}
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    size="small"
                />
            </Card>
        )
    }

    return (
        <div>
            {/* ── Page head ── */}
            <div className="page-head">
                <div className="page-head-main">
                    <span className="overline">Query · 01</span>
                    <h1 className="page-title font-serif">69 码查询</h1>
                    <p className="page-head-desc">
                        输入 69 码或关键词（每行一个），自动精确匹配 + 模糊搜索，结果合并展示。
                    </p>
                </div>
                <div className="page-head-side">
                    <span className="kbd">精确</span>
                    <span className="kbd">模糊</span>
                    <span className="kbd">合并</span>
                </div>
            </div>

            {/* ── Query input ── */}
            <Card>
                <div className="query-textarea">
                    <TextArea
                        rows={6}
                        placeholder={'6901234567890\n6909876543210\n测试商品\n…'}
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                    />
                </div>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        marginTop: 14,
                        flexWrap: 'wrap',
                    }}
                >
                    <Text type="secondary" style={{ fontSize: 12.5 }}>
                        {lineCount > 0 ? '已输入 ' + lineCount + ' 行' : '支持多行输入，每行一个 69 码或关键词'}
                    </Text>
                    <Space>
                        <Button icon={<ClearOutlined />} onClick={handleClear} disabled={!rawInput && allRows.length === 0}>
                            清空
                        </Button>
                        <Magnetic strength={0.3}>
                            <Button
                                type="primary"
                                icon={<SearchOutlined />}
                                onClick={handleQuery}
                                loading={loading}
                                style={{ minWidth: 120 }}
                                className="btn-jelly"
                            >
                                查询
                            </Button>
                        </Magnetic>
                    </Space>
                </div>
            </Card>

            {/* ── Result summary strip ── */}
            {allRows.length > 0 && (
                <div style={{ marginTop: 18 }}>
                    <div className="stat-strip">
                        <Tilt className="stat-tile" max={4}>
                            <span className="stat-label">结果总数</span>
                            <span className="stat-value"><CountUp value={allRows.length} /></span>
                        </Tilt>
                        <Tilt className="stat-tile tile-accent" max={4}>
                            <span className="stat-label">精确匹配</span>
                            <span className="stat-value"><CountUp value={exactCount} /></span>
                        </Tilt>
                        <Tilt className="stat-tile tile-accent" max={4}>
                            <span className="stat-label">模糊匹配</span>
                            <span className="stat-value"><CountUp value={fuzzyCount} /></span>
                        </Tilt>
                        <Tilt className="stat-tile tile-muted" max={4}>
                            <span className="stat-label">未找到</span>
                            <span className="stat-value"><CountUp value={notFoundCount} /></span>
                        </Tilt>
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginTop: 12,
                        }}
                    >
                        <Button icon={<DownloadOutlined />} onClick={handleExport}>
                            导出结果
                            {selectedRowKeys.length > 0 ? '（已选 ' + selectedRowKeys.length + ' 条）' : '（全部）'}
                        </Button>
                    </div>
                </div>
            )}

            {/* ── Results ── */}
            <div key={allRows.length > 0 ? 'has-results' : 'no-results'} className="rise-in" style={{ marginTop: 18 }}>
                {renderBody()}
            </div>

            {/* ── Export Drawer ── */}
            <ExportDrawer
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                columns={query.columns}
                data={exportData}
                filename="69码查询结果"
            />
        </div>
    )
}