import { useState, useEffect } from 'react'
import {
    Card,
    Table,
    Button,
    InputNumber,
    Switch,
    Input,
    Space,
    message,
    Typography,
    Popconfirm,
    Tabs,
} from 'antd'
import { SaveOutlined, HolderOutlined, TableOutlined, SearchOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TabsProps } from 'antd'
import { useConfig } from '../context/ConfigContext'
import type { ColumnConfigItem } from '../types'
import Magnetic from '../components/motion/Magnetic'

const { Text } = Typography

type ViewType = 'data' | 'query'
const VIEW_LABELS: Record<ViewType, string> = { data: '数据管理表', query: '查询结果表' }

/* ── Config table for one view ──────────────────────── */

function ConfigTable({ viewType }: { viewType: ViewType }) {
    const { data, query, save } = useConfig()
    const sourceColumns = viewType === 'data' ? data.columns : query.columns
    const [localColumns, setLocalColumns] = useState<ColumnConfigItem[]>([])
    const [saving, setSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)
    const [dragIdx, setDragIdx] = useState<number | null>(null)

    useEffect(() => {
        setLocalColumns([...sourceColumns].sort((a, b) => a.sort_order - b.sort_order))
    }, [sourceColumns])

    const updateItem = (index: number, field: keyof ColumnConfigItem, value: any) => {
        const updated = [...localColumns]
        updated[index] = { ...updated[index], [field]: value }
        setLocalColumns(updated)
        setHasChanges(true)
    }

    const moveRow = (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return
        const updated = [...localColumns]
        const [moved] = updated.splice(fromIndex, 1)
        updated.splice(toIndex, 0, moved)
        updated.forEach((item, i) => { item.sort_order = i + 1 })
        setLocalColumns(updated)
        setHasChanges(true)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await save(viewType, localColumns)
            message.success(VIEW_LABELS[viewType] + '配置已保存')
            setHasChanges(false)
        } catch (e: any) {
            message.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    const tableColumns: ColumnsType<ColumnConfigItem> = [
        {
            title: '排序',
            key: 'drag',
            width: 72,
            render: (_: any, __: any, index: number) => (
                <span
                    style={{ cursor: 'grab', fontSize: 15, color: '#6e665a', display: 'inline-block', padding: '4px 8px' }}
                    draggable
                    onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(index))
                        e.dataTransfer.effectAllowed = 'move'
                        setDragIdx(index)
                        const tr = (e.target as HTMLElement).closest('tr')
                        if (tr) { tr.style.opacity = '0.4' }
                    }}
                    onDragEnd={(e) => {
                        setDragIdx(null)
                        const tr = (e.target as HTMLElement).closest('tr')
                        if (tr) { tr.style.opacity = '' }
                    }}
                    title="拖拽调整顺序"
                >
                    <HolderOutlined />
                </span>
            ),
        },
        {
            title: '字段',
            dataIndex: 'field',
            key: 'field',
            width: 130,
            render: (val: string) => (
                <Text
                    code
                    style={{
                        fontFamily: 'Consolas, Menlo, monospace',
                        background: 'var(--kbd-bg)',
                        border: '1px solid var(--kbd-bd)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        color: 'var(--gold)',
                    }}
                >
                    {val}
                </Text>
            ),
        },
        {
            title: '显示名称',
            dataIndex: 'label',
            key: 'label',
            width: 220,
            render: (val: string, _: any, index: number) => (
                <Input
                    value={val}
                    onChange={(e) => updateItem(index, 'label', e.target.value)}
                    size="small"
                />
            ),
        },
        {
            title: '宽度',
            dataIndex: 'width',
            key: 'width',
            width: 130,
            render: (val: number, _: any, index: number) => (
                <InputNumber
                    value={val}
                    min={40}
                    max={600}
                    onChange={(v) => updateItem(index, 'width', v ?? 120)}
                    size="small"
                    style={{ width: 110 }}
                />
            ),
        },
        {
            title: '显示',
            dataIndex: 'visible',
            key: 'visible',
            width: 90,
            render: (val: boolean, _: any, index: number) => (
                <Switch
                    checked={val}
                    onChange={(v) => updateItem(index, 'visible', v)}
                    size="small"
                />
            ),
        },
    ]

    const visibleCount = localColumns.filter((c) => c.visible).length

    return (
        <div>
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 16,
                    flexWrap: 'wrap',
                }}
            >
                <Text type="secondary" style={{ fontSize: 13 }}>
                    拖拽行首 <HolderOutlined style={{ color: '#6e665a' }} /> 调整顺序 · 修改名称 · 设置宽度 · 显示/隐藏。
                    当前显示 {visibleCount} / {localColumns.length} 列
                </Text>
                {hasChanges && (
                    <span className="dirty-dot">有未保存的修改</span>
                )}
            </div>

            <Table
                dataSource={localColumns}
                columns={tableColumns}
                rowKey="field"
                pagination={false}
                size="small"
                onRow={(_, index) => ({
                    onDragOver: (e: React.DragEvent) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                    },
                    onDrop: (e: React.DragEvent) => {
                        e.preventDefault()
                        const from = Number(e.dataTransfer.getData('text/plain'))
                        if (!isNaN(from) && index !== undefined) {
                            moveRow(from, index)
                        }
                    },
                    onDragEnter: (e: React.DragEvent) => {
                        e.currentTarget.classList.add('drag-over')
                    },
                    onDragLeave: (e: React.DragEvent) => {
                        e.currentTarget.classList.remove('drag-over')
                    },
                })}
            />

            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginTop: 20,
                    paddingTop: 18,
                    borderTop: '1px solid #2b2723',
                }}
            >
                <Text type="secondary" style={{ fontSize: 12 }}>
                    配置保存在云端，对当前公司内所有成员生效
                </Text>
                <Popconfirm
                    title={'确认保存「' + VIEW_LABELS[viewType] + '」配置？'}
                    onConfirm={handleSave}
                    okText="保存"
                    cancelText="取消"
                >
                    <Magnetic strength={0.3}>
                        <Button type="primary" icon={<SaveOutlined />} loading={saving} disabled={!hasChanges} className="btn-jelly">
                            保存配置
                        </Button>
                    </Magnetic>
                </Popconfirm>
            </div>
        </div>
    )
}

export default function ConfigPage() {
    const items: TabsProps['items'] = [
        {
            key: 'data',
            label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <TableOutlined style={{ color: '#8fbde8' }} />
                    数据管理表
                </span>
            ),
            children: <ConfigTable viewType="data" />,
        },
        {
            key: 'query',
            label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <SearchOutlined style={{ color: 'var(--gold)' }} />
                    查询结果表
                </span>
            ),
            children: <ConfigTable viewType="query" />,
        },
    ]

    return (
        <div>
            <div className="page-head">
                <div className="page-head-main">
                    <span className="overline">Columns · 03</span>
                    <h1 className="page-title font-serif">列配置</h1>
                    <p className="page-head-desc">
                        两套表格独立配置：调整列顺序、显示名称、宽度与可见性，保存后全局生效。
                    </p>
                </div>
                <div className="page-head-side">
                    <span className="kbd">拖拽</span>
                    <span className="kbd">排序</span>
                    <span className="kbd">保存</span>
                </div>
            </div>

            <Card>
                <Tabs defaultActiveKey="data" items={items} />
            </Card>
        </div>
    )
}