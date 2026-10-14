import { useState } from 'react'
import {
    Drawer,
    Button,
    Checkbox,
    Space,
    message,
    Typography,
    Divider,
} from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import type { ColumnConfigItem } from '../types'
import * as XLSX from 'xlsx'

const { Text } = Typography

interface Props {
    open: boolean
    onClose: () => void
    data: Record<string, any>[]
    filename?: string
    columns: ColumnConfigItem[]
}

export default function ExportDrawer({ open, onClose, data, filename, columns }: Props) {
    const sortedColumns = [...columns].sort((a, b) => a.sort_order - b.sort_order)
    const [selectedFields, setSelectedFields] = useState<string[]>(
        columns.filter((c) => c.visible).map((c) => c.field),
    )

    const handleExport = () => {
        if (data.length === 0) {
            message.warning('没有可导出的数据')
            return
        }
        if (selectedFields.length === 0) {
            message.warning('请至少选择一列')
            return
        }

        // Build column labels map
        const labelMap = Object.fromEntries(columns.map((c) => [c.field, c.label]))

        const exportData = data.map((row) => {
            const obj: Record<string, any> = {}
            selectedFields.forEach((field) => {
                obj[labelMap[field] || field] = row[field] ?? ''
            })
            return obj
        })

        const ws = XLSX.utils.json_to_sheet(exportData)
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, '数据导出')
        XLSX.writeFile(wb, (filename || '导出数据') + '_' + Date.now() + '.xlsx')
        message.success('导出成功')
        onClose()
    }

    const allFields = sortedColumns.map((c) => c.field)
    const allSelected = allFields.length > 0 && allFields.every((f) => selectedFields.includes(f))

    return (
        <Drawer
            title={
                <div>
                    <span className="overline">Export · 导出</span>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: '#f2ede6' }}>
                        导出设置
                    </div>
                </div>
            }
            placement="right"
            onClose={onClose}
            open={open}
            width={340}
            footer={
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                        {selectedFields.length} / {sortedColumns.length} 列 · {data.length} 条
                    </Text>
                    <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>
                        导出 Excel
                    </Button>
                </div>
            }
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 10,
                }}
            >
                <Text type="secondary">选择要导出的列：</Text>
                <Space size={4}>
                    <Button
                        type="link"
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() =>
                            setSelectedFields(
                                allSelected ? [] : sortedColumns.map((c) => c.field),
                            )
                        }
                    >
                        {allSelected ? '全不选' : '全选'}
                    </Button>
                </Space>
            </div>
            <Divider style={{ margin: '0 0 14px' }} />
            <Checkbox.Group
                value={selectedFields}
                onChange={(vals) => setSelectedFields(vals as string[])}
                style={{ width: '100%' }}
            >
                <Space direction="vertical" style={{ width: '100%' }}>
                    {sortedColumns.map((col) => (
                        <Checkbox key={col.field} value={col.field} style={{ width: '100%', padding: '5px 8px', borderRadius: 8 }}>
                            {col.label}
                        </Checkbox>
                    ))}
                </Space>
            </Checkbox.Group>
        </Drawer>
    )
}

