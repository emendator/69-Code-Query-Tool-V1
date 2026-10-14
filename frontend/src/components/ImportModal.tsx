import { useState, useEffect } from 'react'
import {
    Modal,
    Upload,
    Button,
    Table,
    Select,
    Tag,
    Space,
    message,
    Typography,
    Divider,
    Alert,
    Checkbox,
    Steps,
} from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import type { UploadFile } from 'antd/es/upload'
import {
    uploadFileForImport,
    matchColumns,
    confirmImport,
} from '../api'
import type { ImportPreview, ColumnMatchResult, ImportResult } from '../types'

const { Text } = Typography
const { Dragger } = Upload

interface Props {
    open: boolean
    onClose: () => void
    onSuccess: () => void
}

const TARGET_FIELDS = [
    { value: 'model', label: '型号' },
    { value: 'name', label: '品名' },
    { value: 'code', label: '69码' },
]

export default function ImportModal({ open, onClose, onSuccess }: Props) {
    const [step, setStep] = useState<'upload' | 'mapping' | 'result'>('upload')
    const [fileList, setFileList] = useState<UploadFile[]>([])
    const [uploading, setUploading] = useState(false)

    const [preview, setPreview] = useState<ImportPreview | null>(null)
    const [matches, setMatches] = useState<ColumnMatchResult[]>([])
    const [unmatched, setUnmatched] = useState<string[]>([])
    const [editableMapping, setEditableMapping] = useState<Record<string, string>>({})
    const [addToSemantic, setAddToSemantic] = useState(false)

    const [importResult, setImportResult] = useState<ImportResult | null>(null)
    const [confirming, setConfirming] = useState(false)

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setStep('upload')
            setFileList([])
            setPreview(null)
            setMatches([])
            setUnmatched([])
            setEditableMapping({})
            setAddToSemantic(false)
            setImportResult(null)
            setUploading(false)
            setConfirming(false)
        }
    }, [open])

    const currentStep = step === 'upload' ? 0 : step === 'mapping' ? 1 : 2

    const handleUpload = async (file: File) => {
        setUploading(true)
        try {
            const data = await uploadFileForImport(file)
            setPreview(data)

            // Auto-match columns
            const matchResult = await matchColumns(data.columns)
            setMatches(matchResult)

            // Build editable mapping
            const mapping: Record<string, string> = { model: '', name: '', code: '' }
            matchResult.forEach((m) => {
                if (m.target_field && m.source_column) {
                    mapping[m.target_field] = m.source_column
                }
            })
            setEditableMapping(mapping)

            // Determine unmatched columns
            const matchedCols = new Set(matchResult.map((m) => m.source_column).filter(Boolean))
            setUnmatched(data.columns.filter((c) => !matchedCols.has(c)))

            setStep('mapping')
        } catch (e: any) {
            message.error(e.message)
        } finally {
            setUploading(false)
        }
        return false // Prevent default upload
    }

    const handleConfirm = async () => {
        if (!preview) return
        setConfirming(true)
        try {
            const result = await confirmImport(
                preview.filename,
                editableMapping,
                addToSemantic,
            )
            setImportResult(result)
            setStep('result')
            message.success('导入完成: 成功 ' + result.imported + ' 条, 跳过 ' + result.skipped + ' 条')
        } catch (e: any) {
            message.error(e.message)
        } finally {
            setConfirming(false)
        }
    }

    const handleDone = () => {
        onSuccess()
        onClose()
    }

    const confidenceColor = (c: string) => {
        switch (c) {
            case 'high':
                return 'green'
            case 'medium':
                return 'orange'
            case 'low':
                return 'red'
            default:
                return 'default'
        }
    }

    const confidenceText = (c: string) => {
        switch (c) {
            case 'high':
                return '高'
            case 'medium':
                return '中'
            case 'low':
                return '低'
            default:
                return c
        }
    }

    // ── Render: Upload Step ──
    const renderUpload = () => (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Dragger
                accept=".xlsx,.xls,.csv"
                multiple={false}
                showUploadList={false}
                beforeUpload={handleUpload}
            >
                <p className="ant-upload-drag-icon">
                    <InboxOutlined style={{ color: 'var(--accent)' }} />
                </p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">支持 .xlsx / .xls / .csv 格式，上传后自动预览并匹配列</p>
            </Dragger>
            <Alert
                type="info"
                showIcon
                message="导入前建议：先整理好表头（69码 / 型号 / 品名），列名越规范，自动匹配越准确。"
            />
        </Space>
    )

    // ── Render: Mapping Step ──
    const mappingColumns = [
        {
            title: '目标字段',
            dataIndex: 'target_field',
            key: 'target_field',
            width: 120,
            render: (field: string) => {
                const label = TARGET_FIELDS.find((f) => f.value === field)?.label || field
                return <Text strong>{label}</Text>
            },
        },
        {
            title: '匹配的源列',
            key: 'source_column',
            width: 260,
            render: (_: any, record: ColumnMatchResult) => (
                <Select
                    style={{ width: '100%' }}
                    value={editableMapping[record.target_field] || undefined}
                    onChange={(val) =>
                        setEditableMapping((prev) => ({ ...prev, [record.target_field]: val }))
                    }
                    allowClear
                    placeholder="选择列"
                >
                    {(preview?.columns || []).map((col) => (
                        <Select.Option key={col} value={col}>
                            {col}
                        </Select.Option>
                    ))}
                    <Select.Option value="">— 不导入 —</Select.Option>
                </Select>
            ),
        },
        {
            title: '置信度',
            dataIndex: 'confidence',
            key: 'confidence',
            width: 100,
            render: (c: string) => <Tag color={confidenceColor(c)}>{confidenceText(c)}</Tag>,
        },
    ]

    const renderMapping = () => {
        if (!preview) return null
        return (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                    type="info"
                    showIcon
                    message={'文件「' + preview.filename + '」共 ' + preview.total_rows + ' 行数据'}
                />

                <Divider orientation="left" style={{ fontSize: 13 }}>
                    列匹配配置
                </Divider>
                <Table
                    dataSource={matches}
                    columns={mappingColumns}
                    pagination={false}
                    rowKey="target_field"
                    size="small"
                />

                {unmatched.length > 0 && (
                    <>
                        <Divider orientation="left" style={{ fontSize: 13 }}>
                            未匹配的列（将被忽略）
                        </Divider>
                        <Space wrap>
                            {unmatched.map((col) => (
                                <Tag key={col}>{col}</Tag>
                            ))}
                        </Space>
                    </>
                )}

                <Divider orientation="left" style={{ fontSize: 13 }}>
                    数据预览（前5行）
                </Divider>
                <Table
                    dataSource={preview.preview_rows.map((r, i) => ({ ...r, key: i }))}
                    columns={preview.columns.map((col) => ({
                        title: col,
                        dataIndex: col,
                        key: col,
                        ellipsis: true,
                        width: 120,
                    }))}
                    pagination={false}
                    size="small"
                    scroll={{ x: 'max-content' }}
                />

                <Checkbox checked={addToSemantic} onChange={(e) => setAddToSemantic(e.target.checked)}>
                    将本次列匹配规则加入语义库（后续相同列名可自动匹配）
                </Checkbox>

                <Space>
                    <Button type="primary" onClick={handleConfirm} loading={confirming}>
                        确认导入
                    </Button>
                    <Button onClick={() => setStep('upload')}>重新上传</Button>
                </Space>
            </Space>
        )
    }

    // ── Render: Result Step ──
    const renderResult = () => {
        if (!importResult) return null
        const details = importResult.skip_details || []
        return (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
                <Alert
                    type="success"
                    showIcon
                    message="导入完成"
                    description={
                        '共 ' + importResult.total + ' 条数据，成功导入 ' + importResult.imported +
                        ' 条，跳过 ' + importResult.skipped + ' 条'
                    }
                />
                {details.length > 0 && (
                    <>
                        <Divider orientation="left" style={{ fontSize: 13 }}>
                            跳过原因
                        </Divider>
                        <Table
                            dataSource={details.map((d, i) => ({ ...d, key: i }))}
                            columns={[
                                { title: '69码', dataIndex: 'code', key: 'code', width: 200, render: (v: string) => v || '(空)' },
                                { title: '原因', dataIndex: 'reason', key: 'reason' },
                            ]}
                            pagination={false}
                            size="small"
                        />
                    </>
                )}
                <Button type="primary" onClick={handleDone}>
                    完成
                </Button>
            </Space>
        )
    }

    return (
        <Modal
            title={
                <div>
                    <span className="overline">Import · 导入</span>
                    <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: '#f2ede6' }}>
                        导入数据
                    </div>
                </div>
            }
            open={open}
            onCancel={onClose}
            footer={null}
            width={820}
            destroyOnHidden
        >
            <div style={{ marginBottom: 24, marginTop: 4 }}>
                <Steps
                    size="small"
                    current={currentStep}
                    items={[
                        { title: '上传文件', status: currentStep > 0 ? 'finish' : currentStep === 0 ? 'process' : 'wait' },
                        { title: '列映射', status: currentStep > 1 ? 'finish' : currentStep === 1 ? 'process' : 'wait' },
                        { title: '完成', status: currentStep > 2 ? 'finish' : currentStep === 2 ? 'process' : 'wait' },
                    ]}
                />
            </div>
            <div key={step} className="step-fade">
                {step === 'upload' && renderUpload()}
                {step === 'mapping' && renderMapping()}
                {step === 'result' && renderResult()}
            </div>
        </Modal>
    )
}