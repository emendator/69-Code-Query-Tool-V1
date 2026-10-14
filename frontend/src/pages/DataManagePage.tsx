import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
    Card,
    Table,
    Button,
    Space,
    Modal,
    Form,
    Input,
    Popconfirm,
    Tag,
    message,
    Typography,
    Alert,
    Tooltip,
    Checkbox,
    Divider,
} from 'antd'
import {
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    ImportOutlined,
    ExportOutlined,
    ScissorOutlined,
    ReloadOutlined,
    SearchOutlined,
    ExclamationCircleOutlined,
    FilterOutlined,
    DatabaseOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import {
    fetchDataList,
    createProduct,
    updateProduct,
    deleteProduct,
    batchDeleteProducts,
    getDuplicateCodes,
    deduplicate,
} from '../api'
import { useConfig } from '../context/ConfigContext'
import type { Product, ProductCreate, ProductUpdate } from '../types'
import ImportModal from '../components/ImportModal'
import ExportDrawer from '../components/ExportDrawer'
import Magnetic from '../components/motion/Magnetic'
import CountUp from '../components/motion/CountUp'

const { Text } = Typography

/* ── Column filter dropdown ───────────────────────────── */

interface ColumnFilterProps {
    values: string[]
    selected: string[]
    onChange: (vals: string[]) => void
}

function ColumnFilter({ values, selected, onChange }: ColumnFilterProps) {
    const [searchText, setSearchText] = useState('')
    const filtered = searchText
        ? values.filter((v) => v.toLowerCase().includes(searchText.toLowerCase()))
        : values

    const allSelected = filtered.length > 0 && filtered.every((v) => selected.includes(v))
    const indeterminate = filtered.some((v) => selected.includes(v)) && !allSelected

    return (
        <div style={{ padding: 8, minWidth: 180 }}>
            <Input
                size="small"
                placeholder="搜索..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ marginBottom: 8 }}
            />
            <div style={{ maxHeight: 200, overflow: 'auto' }}>
                <Checkbox
                    checked={allSelected}
                    indeterminate={indeterminate}
                    onChange={(e) => {
                        if (e.target.checked) {
                            const add = filtered.filter((v) => !selected.includes(v))
                            onChange([...selected, ...add])
                        } else {
                            const filteredSet = new Set(filtered)
                            onChange(selected.filter((v) => !filteredSet.has(v)))
                        }
                    }}
                    style={{ marginBottom: 4 }}
                >
                    全选
                </Checkbox>
                <Divider style={{ margin: '4px 0' }} />
                {filtered.map((v) => (
                    <div key={v} style={{ marginBottom: 2 }}>
                        <Checkbox
                            checked={selected.includes(v)}
                            onChange={(e) => {
                                if (e.target.checked) {
                                    onChange([...selected, v])
                                } else {
                                    onChange(selected.filter((s) => s !== v))
                                }
                            }}
                        >
                            <Text ellipsis style={{ maxWidth: 160 }} title={v}>
                                {v || '(空)'}
                            </Text>
                        </Checkbox>
                    </div>
                ))}
                {filtered.length === 0 && (
                    <Text type="secondary" style={{ fontSize: 12 }}>无匹配</Text>
                )}
            </div>
        </div>
    )
}

export default function DataManagePage() {
    const { data: dataConfig } = useConfig()
    const visibleColumns = dataConfig.visibleColumns
    const allColumns = dataConfig.columns

    // ── Data State ──
    const [data, setData] = useState<Product[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(50)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([])
    const [duplicateCodes, setDuplicateCodes] = useState<Set<string>>(new Set())
    const debounceRef = useRef<number | null>(null)

    // ── Column Filters ──
    const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
    // ── Modal State ──
    const [modalOpen, setModalOpen] = useState(false)
    const [editingProduct, setEditingProduct] = useState<Product | null>(null)
    const [form] = Form.useForm()
    const [saving, setSaving] = useState(false)

    // ── Import/Export ──
    const [importOpen, setImportOpen] = useState(false)
    const [exportOpen, setExportOpen] = useState(false)

    // ── Load Data ──
    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetchDataList(page, pageSize, search)
            setData(res.items)
            setTotal(res.total)
        } catch (e: any) {
            message.error(e.message)
        } finally {
            setLoading(false)
        }
    }, [page, pageSize, search])

    const loadDuplicates = useCallback(async () => {
        try {
            const codes = await getDuplicateCodes()
            setDuplicateCodes(new Set(codes))
        } catch {
            // ignore
        }
    }, [])

    useEffect(() => {
        loadData()
        loadDuplicates()
    }, [loadData, loadDuplicates])

    // ── Apply filters to data (client-side) ──
    const filteredData = useMemo(() => {
        let result = data
        for (const [field, selected] of Object.entries(columnFilters)) {
            if (selected.length === 0) continue
            result = result.filter((row) => {
                const val = String((row as any)[field] ?? '')
                return selected.includes(val)
            })
        }
        return result
    }, [data, columnFilters])

    // ── Search ──
    const handleSearch = (value: string) => {
        setSearch(value)
        setSearchInput(value)
        setPage(1)
    }

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value
        setSearchInput(val)
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = window.setTimeout(() => {
            setSearch(val)
            setPage(1)
        }, 300)
    }

    // ── CRUD ──
    const openAddModal = () => {
        setEditingProduct(null)
        form.resetFields()
        setModalOpen(true)
    }

    const openEditModal = (record: Product) => {
        setEditingProduct(record)
        form.setFieldsValue(record)
        setModalOpen(true)
    }

    const handleSave = async () => {
        try {
            const values = await form.validateFields()
            setSaving(true)
            if (editingProduct) {
                await updateProduct(editingProduct.id, values as ProductUpdate)
                message.success('更新成功')
            } else {
                await createProduct(values as ProductCreate)
                message.success('添加成功')
            }
            setModalOpen(false)
            loadData()
            loadDuplicates()
        } catch (e: any) {
            if (e.message) message.error(e.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: number) => {
        try {
            await deleteProduct(id)
            message.success('删除成功')
            loadData()
            loadDuplicates()
        } catch (e: any) {
            message.error(e.message)
        }
    }

    const handleBatchDelete = async () => {
        if (selectedRowKeys.length === 0) {
            message.warning('请先勾选要删除的记录')
            return
        }
        try {
            await batchDeleteProducts(selectedRowKeys)
            message.success('删除了 ' + selectedRowKeys.length + ' 条记录')
            setSelectedRowKeys([])
            loadData()
            loadDuplicates()
        } catch (e: any) {
            message.error(e.message)
        }
    }

    // ── Deduplication ──
    const handleDeduplicate = async () => {
        Modal.confirm({
            title: '一键去重',
            icon: <ExclamationCircleOutlined />,
            content: '将删除重复的69码记录，仅保留最早导入的一条。确定继续吗？',
            okText: '确定去重',
            cancelText: '取消',
            onOk: async () => {
                try {
                    const result = await deduplicate()
                    message.success('去重完成，删除了 ' + result.deleted_count + ' 条重复记录')
                    loadData()
                    loadDuplicates()
                } catch (e: any) {
                    message.error(e.message)
                }
            },
        })
    }

    // ── Export ──
    const [exportData, setExportData] = useState<Record<string, any>[]>([])
    const handleExportAll = async () => {
        try {
            if (search) {
                // If searching, fetch all matching records
                const res = await fetchDataList(1, total, search)
                setExportData(res.items)
            } else {
                // No search: fetch all records in one page
                const res = await fetchDataList(1, total, '')
                setExportData(res.items)
            }
            setExportOpen(true)
        } catch (e: any) {
            message.error(e.message)
        }
    }

    // ── Build unique values per column from current page for filters ──
    const columnValueMap = useMemo(() => {
        const map: Record<string, string[]> = {}
        for (const row of data) {
            for (const cfg of visibleColumns) {
                if (cfg.field === 'id') continue
                const val = String((row as any)[cfg.field] ?? '')
                if (!map[cfg.field]) map[cfg.field] = []
                if (!map[cfg.field].includes(val)) map[cfg.field].push(val)
            }
        }
        return map
    }, [data, visibleColumns])

    // ── Table Columns ──
    const tableColumns: ColumnsType<Product> = visibleColumns
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((cfg) => ({
            title: cfg.label,
            dataIndex: cfg.field,
            key: cfg.field,
            width: cfg.width,
            sorter: cfg.field === 'id' ? (a, b) => a.id - b.id : undefined,
            filteredValue: cfg.field === 'id' ? undefined : (columnFilters[cfg.field] || []),
            filterDropdown: cfg.field === 'id' ? undefined : ({ setSelectedKeys, confirm, clearFilters }: any) => (
                <ColumnFilter
                    values={columnValueMap[cfg.field] || []}
                    selected={columnFilters[cfg.field] || []}
                    onChange={(vals) => {
                        setColumnFilters((prev) => ({ ...prev, [cfg.field]: vals }))
                    }}
                />
            ),
            filterIcon: cfg.field === 'id' ? undefined : (filtered: boolean) => (
                <FilterOutlined style={{ color: (columnFilters[cfg.field]?.length ?? 0) > 0 ? 'var(--accent)' : undefined, fontSize: 12 }} />
            ),
            render: (val: any, record: Product, index: number) => {
                if (cfg.field === 'id') {
                    return (page - 1) * pageSize + index + 1
                }
                if (cfg.field === 'code') {
                    const isDup = duplicateCodes.has(val)
                    return (
                        <Text
                            copyable
                            style={{
                                color: isDup ? 'var(--err)' : undefined,
                                fontWeight: isDup ? 600 : undefined,
                                fontFamily: 'Consolas, Menlo, monospace',
                                letterSpacing: '0.02em',
                            }}
                        >
                            {val}
                            {isDup ? (
                                <Tooltip title="该69码存在重复">
                                    <ExclamationCircleOutlined style={{ marginLeft: 4, color: 'var(--err)' }} />
                                </Tooltip>
                            ) : null}
                        </Text>
                    )
                }
                if (cfg.field === 'source' && val) {
                    return <Tag>{val}</Tag>
                }
                return val ?? ''
            },
        }))

    // Add action column
    const actionColumn: ColumnsType<Product>[number] = {
        title: '操作',
        key: 'action',
        width: 150,
        fixed: 'right',
        render: (_: any, record: Product) => (
            <Space size="small">
                <Button
                    type="link"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => openEditModal(record)}
                    style={{ color: 'var(--info)' }}
                >
                    编辑
                </Button>
                <Popconfirm
                    title="确定删除这条记录？"
                    onConfirm={() => handleDelete(record.id)}
                    okText="确定"
                    cancelText="取消"
                >
                    <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                        删除
                    </Button>
                </Popconfirm>
            </Space>
        ),
    }

    const allTableColumns = [...tableColumns, actionColumn]

    const filteredCount = Object.keys(columnFilters).length > 0 ? filteredData.length : null

    return (
        <div>
            {/* ── Page head ── */}
            <div className="page-head">
                <div className="page-head-main">
                    <span className="overline">Data · 02</span>
                    <h1 className="page-title font-serif">数据管理</h1>
                    <p className="page-head-desc">
                        维护公司的 69 码商品库：新增、编辑、导入导出与一键去重。
                    </p>
                </div>
                <div className="page-head-side">
                    <span className="kbd">搜索</span>
                    <span className="kbd">筛选</span>
                    <span className="kbd">去重</span>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <Card className="card-glow">
                <div className="toolbar-row">
                    <div className="toolbar-left">
                        <Input
                            placeholder="搜索型号 / 品名 / 69码（自动模糊搜索）…"
                            allowClear
                            value={searchInput}
                            onChange={handleSearchChange}
                            onPressEnter={() => handleSearch(searchInput)}
                            style={{ width: 300 }}
                            prefix={<SearchOutlined />}
                            suffix={
                                searchInput ? (
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<SearchOutlined />}
                                        onClick={() => handleSearch(searchInput)}
                                    />
                                ) : null
                            }
                        />
                        <Tooltip title="刷新数据">
                            <Button icon={<ReloadOutlined />} onClick={loadData} />
                        </Tooltip>
                    </div>
                    <div className="toolbar-right">
                        {Object.keys(columnFilters).length > 0 && (
                            <Button size="small" onClick={() => setColumnFilters({})}>
                                清除筛选
                            </Button>
                        )}
                        <Magnetic strength={0.3}>
                            <Button type="primary" icon={<PlusOutlined />} onClick={openAddModal} className="btn-jelly">
                                新增
                            </Button>
                        </Magnetic>
                        <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>
                            导入
                        </Button>
                        <Button icon={<ExportOutlined />} onClick={handleExportAll}>
                            导出
                        </Button>
                        {duplicateCodes.size > 0 && (
                            <Popconfirm
                                title={'发现 ' + duplicateCodes.size + ' 组重复69码，一键去重？'}
                                onConfirm={handleDeduplicate}
                                okText="去重"
                                cancelText="取消"
                            >
                                <Button danger icon={<ScissorOutlined />}>
                                    去重 ({duplicateCodes.size})
                                </Button>
                            </Popconfirm>
                        )}
                        {selectedRowKeys.length > 0 && (
                            <Popconfirm
                                title={'确定删除选中的 ' + selectedRowKeys.length + ' 条记录？'}
                                onConfirm={handleBatchDelete}
                                okText="确定"
                                cancelText="取消"
                            >
                                <Button danger icon={<DeleteOutlined />}>
                                    批量删除 ({selectedRowKeys.length})
                                </Button>
                            </Popconfirm>
                        )}
                    </div>
                </div>
            </Card>

            {/* ── Duplicate Alert ── */}
            {duplicateCodes.size > 0 && (
                <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 16, borderRadius: 12 }}
                    message={
                        <span>
                            发现 <Text strong>{duplicateCodes.size}</Text> 组重复 69 码（表中已高亮显示），
                            建议使用「去重」功能清理
                        </span>
                    }
                    action={
                        <Button size="small" danger icon={<ScissorOutlined />} onClick={handleDeduplicate}>
                            一键去重
                        </Button>
                    }
                />
            )}

            {/* ── Stat chips ── */}
            <div
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    margin: '16px 0 12px',
                }}
            >
                <span className="chip">
                    <DatabaseOutlined style={{ color: '#d9a441' }} />
                    共 <CountUp value={total} /> 条记录
                </span>
                {filteredCount !== null && (
                    <span className="chip">筛选后 {filteredCount} 条</span>
                )}
                {selectedRowKeys.length > 0 && (
                    <span className="chip">已选 {selectedRowKeys.length} 条</span>
                )}
                <span style={{ flex: 1 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                    {pageSize} 条 / 页
                </Text>
            </div>

            {/* ── Data Table ── */}
            <Card styles={{ body: { padding: 0 } }}>
                <Table
                    dataSource={filteredData}
                    columns={allTableColumns}
                    rowKey="id"
                    loading={loading}
                    pagination={{
                        current: page,
                        pageSize,
                        total,
                        showSizeChanger: true,
                        pageSizeOptions: [50, 100, 200, 500, 1000],
                        showTotal: (t) =>
                            '共 ' + t + ' 条' +
                            (Object.keys(columnFilters).length > 0 ? '，已筛选 ' + filteredData.length + ' 条' : ''),
                        onChange: (p, ps) => {
                            setPage(p)
                            setPageSize(ps)
                        },
                    }}
                    rowSelection={{
                        selectedRowKeys,
                        onChange: (keys) => setSelectedRowKeys(keys as number[]),
                    }}
                    scroll={{ x: 'max-content', y: 'calc(100vh - 452px)' }}
                    size="small"
                />
            </Card>

            {/* ── Modals ── */}
            <Modal
                title={editingProduct ? '编辑记录' : '新增记录'}
                open={modalOpen}
                onOk={handleSave}
                onCancel={() => setModalOpen(false)}
                confirmLoading={saving}
                destroyOnHidden
                okText={editingProduct ? '保存修改' : '添加'}
                cancelText="取消"
            >
                <Form form={form} layout="vertical" preserve={false}>
                    <Form.Item name="code" label="69码" rules={[{ required: true, message: '请输入69码' }]}>
                        <Input placeholder="6901234567890" />
                    </Form.Item>
                    <Form.Item name="model" label="型号">
                        <Input placeholder="产品型号" />
                    </Form.Item>
                    <Form.Item name="name" label="品名">
                        <Input placeholder="产品名称" />
                    </Form.Item>
                    <Form.Item name="remark" label="备注">
                        <Input.TextArea rows={3} placeholder="备注信息" />
                    </Form.Item>
                </Form>
            </Modal>

            {/* ── Import / Export ── */}
            <ImportModal
                open={importOpen}
                onClose={() => setImportOpen(false)}
                onSuccess={() => {
                    loadData()
                    loadDuplicates()
                }}
            />
            <ExportDrawer
                open={exportOpen}
                onClose={() => setExportOpen(false)}
                columns={allColumns}
                data={exportData}
                filename="数据管理导出"
            />
        </div>
    )
}