import React, { useCallback, useEffect, useState } from 'react'
import {
    Tabs,
    Table,
    Card,
    Button,
    Space,
    Tag,
    Input,
    Modal,
    Form,
    Radio,
    DatePicker,
    message,
    Popconfirm,
    Typography,
} from 'antd'
import {
    PlusOutlined,
    ReloadOutlined,
    SearchOutlined,
    GiftOutlined,
    TeamOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import dayjs, { type Dayjs } from 'dayjs'
import {
    fetchInvites,
    createInvite,
    revokeInvite,
    fetchUsers,
    extendUser,
    deleteUser,
} from '../api'
import { useAuth } from '../context/AuthContext'
import type { InviteCodeItem, UserInfo } from '../types'
import Magnetic from '../components/motion/Magnetic'

function fmt(dt: string | null | undefined): string {
    if (!dt) return '—'
    return dt.replace('T', ' ').slice(0, 19)
}

const roleLabel: Record<string, string> = {
    super_admin: '最高级管理员',
    admin: '管理员',
    user: '用户',
}

const roleColor: Record<string, string> = {
    super_admin: 'gold',
    admin: 'blue',
    user: 'green',
}

const statusLabel: Record<string, string> = {
    active: '正常',
    expired: '已过期',
    disabled: '已禁用',
}

const statusColor: Record<string, string> = {
    active: 'success',
    expired: 'error',
    disabled: 'default',
}

const inviteStatusLabel: Record<string, string> = {
    unused: '未使用',
    revoked: '已撤销',
}

const inviteStatusColor: Record<string, string> = {
    unused: 'processing',
    revoked: 'default',
}

export default function UserManagePage() {
    const { user } = useAuth()
    const isSuper = user?.role === 'super_admin'

    const [activeTab, setActiveTab] = useState('invites')

    /* ── 邀请码 ── */
    const [invites, setInvites] = useState<InviteCodeItem[]>([])
    const [invitesTotal, setInvitesTotal] = useState(0)
    const [invitesLoading, setInvitesLoading] = useState(false)
    const [invitePage, setInvitePage] = useState(1)
    const [inviteModalOpen, setInviteModalOpen] = useState(false)
    const [inviteForm] = Form.useForm()

    /* ── 账号 ── */
    const [users, setUsers] = useState<UserInfo[]>([])
    const [usersTotal, setUsersTotal] = useState(0)
    const [usersLoading, setUsersLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [extendTarget, setExtendTarget] = useState<UserInfo | null>(null)
    const [extendForm] = Form.useForm()

    const loadInvites = useCallback(async (p: number = 1) => {
        setInvitesLoading(true)
        try {
            const res = await fetchInvites(p, 20)
            setInvites(res.items)
            setInvitesTotal(res.total)
        } catch (e) {
            message.error(e instanceof Error ? e.message : '加载邀请码失败')
        } finally {
            setInvitesLoading(false)
        }
    }, [])

    const loadUsers = useCallback(
        async (p: number, keyword: string) => {
            setUsersLoading(true)
            try {
                const res = await fetchUsers({ page: p, page_size: 20, search: keyword })
                setUsers(res.items)
                setUsersTotal(res.total)
            } catch (e) {
                message.error(e instanceof Error ? e.message : '加载账号失败')
            } finally {
                setUsersLoading(false)
            }
        },
        [],
    )

    useEffect(() => {
        if (activeTab === 'invites') loadInvites(invitePage)
        else loadUsers(page, search)
    }, [activeTab, loadInvites, loadUsers, page, invitePage, search])

    const handleCreateInvite = async () => {
        try {
            const values = await inviteForm.validateFields()
            await createInvite({
                level: values.level,
                expires_at: values.expires_at ? values.expires_at.format('YYYY-MM-DDTHH:mm:ss') : null,
                account_expires_at: values.account_expires_at
                    ? values.account_expires_at.format('YYYY-MM-DDTHH:mm:ss')
                    : null,
            })
            message.success('邀请码已生成，请复制使用')
            setInviteModalOpen(false)
            inviteForm.resetFields()
            loadInvites()
        } catch (e) {
            if (e instanceof Error) message.error(e.message)
        }
    }

    const handleRevokeInvite = async (id: number) => {
        try {
            await revokeInvite(id)
            message.success('邀请码已撤销')
            loadInvites()
        } catch (e) {
            message.error(e instanceof Error ? e.message : '撤销失败')
        }
    }

    const handleExtend = async () => {
        if (!extendTarget) return
        try {
            const values = await extendForm.validateFields()
            await extendUser(extendTarget.id, values.expires_at.format('YYYY-MM-DDTHH:mm:ss'))
            message.success('账号有效期已更新')
            setExtendTarget(null)
            extendForm.resetFields()
            loadUsers(page, search)
        } catch (e) {
            if (e instanceof Error) message.error(e.message)
        }
    }

    const handleDeleteUser = async (target: UserInfo) => {
        const isAdminTarget = isSuper && target.role === 'admin'
        try {
            const res = await deleteUser(target.id)
            message.success(
                isAdminTarget && res.deleted_count > 1
                    ? '已清除账号，连带删除 ' + (res.deleted_count - 1) + ' 个关联用户账号'
                    : '账号已清除',
            )
            loadUsers(page, search)
        } catch (e) {
            message.error(e instanceof Error ? e.message : '清除失败')
        }
    }

    const inviteColumns: ColumnsType<InviteCodeItem> = [
        {
            title: '邀请码',
            dataIndex: 'code',
            render: (v: string) => (
                <Typography.Text
                    code
                    strong
                    style={{
                        fontFamily: 'Consolas, Menlo, monospace',
                        background: 'var(--kbd-bg)',
                        border: '1px solid var(--kbd-bd)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        color: 'var(--pt)',
                    }}
                >
                    {v}
                </Typography.Text>
            ),
        },
        {
            title: '级别',
            dataIndex: 'level',
            width: 110,
            render: (v: number) => (v === 1 ? <Tag color="gold">一级 · 管理员</Tag> : <Tag color="blue">二级 · 用户</Tag>),
        },
        {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (v: string) => <Tag color={inviteStatusColor[v]}>{inviteStatusLabel[v]}</Tag>,
        },
        { title: '分发人', dataIndex: 'issued_by_username', width: 110, render: (v: string | null) => v || '—' },
        { title: '邀请码有效期', dataIndex: 'expires_at', width: 160, render: fmt },
        { title: '账号默认有效期', dataIndex: 'account_expires_at', width: 160, render: fmt },
        { title: '分发时间', dataIndex: 'created_at', width: 160, render: fmt },
        {
            title: '操作',
            key: 'action',
            width: 90,
            render: (_, record) =>
                record.status === 'unused' ? (
                    <Popconfirm title="确定撤销该邀请码？" onConfirm={() => handleRevokeInvite(record.id)}>
                        <Button size="small" danger>撤销</Button>
                    </Popconfirm>
                ) : (
                    <Typography.Text type="secondary">—</Typography.Text>
                ),
        },
    ]

    const userColumns: ColumnsType<UserInfo> = [
        { title: '用户名', dataIndex: 'username', width: 130 },
        {
            title: '角色',
            dataIndex: 'role',
            width: 130,
            render: (v: string) => <Tag color={roleColor[v]}>{roleLabel[v]}</Tag>,
        },
        { title: '所属公司', dataIndex: 'company_name', width: 190, render: (v: string | null) => v || '—' },
        { title: '邮箱', dataIndex: 'email', width: 210 },
        { title: '注册时间', dataIndex: 'created_at', width: 165, render: fmt },
        { title: '最后登录', dataIndex: 'last_login_at', width: 165, render: fmt },
        { title: '有效期至', dataIndex: 'expires_at', width: 165, render: fmt },
        {
            title: '状态',
            dataIndex: 'status',
            width: 90,
            render: (v: string) => <Tag color={statusColor[v]}>{statusLabel[v]}</Tag>,
        },
        {
            title: '操作',
            key: 'action',
            width: 170,
            render: (_, record) => {
                // 管理员仅可操作本公司内的用户级账号；最高级管理员可操作除自身/超管外一切
                const canOperate = isSuper ? record.role !== 'super_admin' : record.role === 'user'
                if (!canOperate) {
                    return <Typography.Text type="secondary">—</Typography.Text>
                }
                return (
                    <Space>
                        <Button size="small" onClick={() => setExtendTarget(record)}>
                            延长有效期
                        </Button>
                        <Popconfirm
                            title={isSuper && record.role === 'admin' ? '删除该管理员将同步删除其邀请的所有用户账号，确定？' : '确定清除该账号？'}
                            okText="确定"
                            cancelText="取消"
                            onConfirm={() => handleDeleteUser(record)}
                        >
                            <Button size="small" danger>
                                清除
                            </Button>
                        </Popconfirm>
                    </Space>
                )
            },
        },
    ]

    return (
        <div>
            <div className="page-head">
                <div className="page-head-main">
                    <span className="overline">People · 04</span>
                    <h1 className="page-title font-serif">用户管理</h1>
                    <p className="page-head-desc">
                        分发邀请码、管理团队成员账号与有效期。
                    </p>
                </div>
                <div className="page-head-side">
                    <span className="kbd">邀请码</span>
                    <span className="kbd">账号</span>
                </div>
            </div>

            <Card>
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={[
                        {
                            key: 'invites',
                            label: (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <GiftOutlined style={{ color: '#d9a441' }} />
                                    邀请码管理
                                </span>
                            ),
                            children: (
                                <>
                                    <div className="toolbar-row" style={{ marginBottom: 16 }}>
                                        <div className="toolbar-left">
                                            <span className="chip">共 {invitesTotal} 个邀请码</span>
                                        </div>
                                        <div className="toolbar-right">
                                            <Button icon={<ReloadOutlined />} onClick={() => loadInvites(invitePage)}>
                                                刷新
                                            </Button>
                                            <Magnetic strength={0.3}>
                                                <Button
                                                    type="primary"
                                                    icon={<PlusOutlined />}
                                                    onClick={() => setInviteModalOpen(true)}
                                                    className="btn-jelly"
                                                >
                                                    分发新邀请码
                                                </Button>
                                            </Magnetic>
                                        </div>
                                    </div>
                                    <Table
                                        rowKey="id"
                                        columns={inviteColumns}
                                        dataSource={invites}
                                        loading={invitesLoading}
                                        pagination={{
                                            current: invitePage,
                                            pageSize: 20,
                                            total: invitesTotal,
                                            showTotal: (t) => '共 ' + t + ' 条',
                                            onChange: setInvitePage,
                                        }}
                                        scroll={{ x: 1100 }}
                                    />
                                </>
                            ),
                        },
                        {
                            key: 'users',
                            label: (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <TeamOutlined style={{ color: '#8fbde8' }} />
                                    账号管理
                                </span>
                            ),
                            children: (
                                <>
                                    <div className="toolbar-row" style={{ marginBottom: 16 }}>
                                        <div className="toolbar-left">
                                            <Input
                                                allowClear
                                                prefix={<SearchOutlined />}
                                                placeholder="搜索用户名 / 邮箱"
                                                style={{ width: 280 }}
                                                value={search}
                                                onChange={(e) => {
                                                    setSearch(e.target.value)
                                                    setPage(1)
                                                }}
                                            />
                                        </div>
                                        <div className="toolbar-right">
                                            <Button icon={<ReloadOutlined />} onClick={() => loadUsers(page, search)}>
                                                刷新
                                            </Button>
                                        </div>
                                    </div>
                                    <Table
                                        rowKey="id"
                                        columns={userColumns}
                                        dataSource={users}
                                        loading={usersLoading}
                                        pagination={{
                                            current: page,
                                            pageSize: 20,
                                            total: usersTotal,
                                            showTotal: (t) => '共 ' + t + ' 条',
                                            onChange: setPage,
                                        }}
                                        scroll={{ x: 1300 }}
                                    />
                                </>
                            ),
                        },
                    ]}
                />
            </Card>

            {/* 分发邀请码 */}
            <Modal
                title="分发新邀请码"
                open={inviteModalOpen}
                onOk={handleCreateInvite}
                onCancel={() => {
                    setInviteModalOpen(false)
                    inviteForm.resetFields()
                }}
                okText="生成"
                cancelText="取消"
            >
                <Form form={inviteForm} layout="vertical" initialValues={{ level: isSuper ? 1 : 2 }}>
                    <Form.Item name="level" label="邀请码级别" rules={[{ required: true }]}>
                        <Radio.Group disabled={!isSuper}>
                            <Radio value={1}>一级邀请码（管理员注册）</Radio>
                            <Radio value={2}>二级邀请码（用户注册）</Radio>
                        </Radio.Group>
                    </Form.Item>
                    <Form.Item
                        name="expires_at"
                        label="邀请码有效期"
                        extra="留空表示永久有效，到期后该码不可用于注册"
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            showTime
                            disabledDate={(d: Dayjs) => d && d.isBefore(dayjs().startOf('day'))}
                            placeholder="选择邀请码过期时间"
                        />
                    </Form.Item>
                    <Form.Item
                        name="account_expires_at"
                        label="注册账号默认有效期"
                        extra="使用该邀请码注册的账号将继承此有效期，留空表示永久"
                    >
                        <DatePicker
                            style={{ width: '100%' }}
                            showTime
                            placeholder="选择账号默认过期时间"
                        />
                    </Form.Item>
                </Form>
            </Modal>

            {/* 延长有效期 */}
            <Modal
                title={'延长有效期 — ' + (extendTarget?.username ?? '')}
                open={!!extendTarget}
                onOk={handleExtend}
                onCancel={() => {
                    setExtendTarget(null)
                    extendForm.resetFields()
                }}
                okText="确定"
                cancelText="取消"
            >
                <Form form={extendForm} layout="vertical">
                    <Form.Item
                        name="expires_at"
                        label="新的到期时间"
                        rules={[{ required: true, message: '请选择新的到期时间' }]}
                    >
                        <DatePicker style={{ width: '100%' }} showTime placeholder="选择新的到期时间" />
                    </Form.Item>
                </Form>
            </Modal>
        </div>
    )
}