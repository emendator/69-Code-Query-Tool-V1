import { useState, useRef } from 'react'
import {
    ConfigProvider as AntdProvider,
    Layout,
    Menu,
    Button,
    Dropdown,
    Avatar,
    Tag,
    Alert,
    Modal,
    Form,
    Input,
    message,
} from 'antd'
import {
    SearchOutlined,
    DatabaseOutlined,
    SettingOutlined,
    TeamOutlined,
    MenuFoldOutlined,
    MenuUnfoldOutlined,
    LogoutOutlined,
    UserOutlined,
    LockOutlined,
    BankOutlined,
    ExperimentOutlined,
} from '@ant-design/icons'
import { ConfigProvider } from './context/ConfigContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import QueryPage from './pages/QueryPage'
import DataManagePage from './pages/DataManagePage'
import ConfigPage from './pages/ConfigPage'
import UserManagePage from './pages/UserManagePage'
import { changeCompanyPassword } from './api'
import { buildAntdTheme } from './theme'
import RippleLayer from './components/motion/RippleLayer'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import ThemeToggle from './components/ThemeToggle'

const { Sider, Content, Header } = Layout

type PageKey = 'query' | 'data' | 'config' | 'users'

const roleLabel: Record<string, string> = {
    super_admin: '最高级管理员',
    admin: '管理员',
    user: '用户',
    guest: '游客',
}

const roleColor: Record<string, string> = {
    super_admin: 'gold',
    admin: 'blue',
    user: 'green',
    guest: 'purple',
}

const pageTitle: Record<PageKey, string> = {
    query: '69 码查询',
    data: '数据管理',
    config: '列配置',
    users: '用户管理',
}

const pageIndex: Record<PageKey, string> = {
    query: '01',
    data: '02',
    config: '03',
    users: '04',
}

function AuthGate() {
    const { token } = useAuth()

    if (token) {
        return (
            <ConfigProvider>
                <MainLayout />
            </ConfigProvider>
        )
    }
    return <AuthPage />
}

function MainLayout() {
    const { user, logout } = useAuth()
    const [page, setPage] = useState<PageKey>('query')
    const [collapsed, setCollapsed] = useState(false)
    const [pwdOpen, setPwdOpen] = useState(false)
    const [pwdForm] = Form.useForm()
    const [pwdLoading, setPwdLoading] = useState(false)
    const contentRef = useRef<HTMLDivElement>(null)
    const [scrollProgress, setScrollProgress] = useState(0)
    const [animPage, setAnimPage] = useState<PageKey | null>(null)

    const handlePageChange = (key: PageKey) => {
        setPage(key)
        setAnimPage(key)
    }

    const handleContentScroll = () => {
        const el = contentRef.current
        if (!el) return
        const max = el.scrollHeight - el.clientHeight
        setScrollProgress(max > 0 ? Math.min(1, el.scrollTop / max) : 0)
    }

    const canManageUsers = user?.role === 'super_admin' || user?.role === 'admin'
    const isGuest = user?.role === 'guest'
    const remaining = user?.remaining_days
    const showExpiryWarn =
        !isGuest &&
        user?.expires_at &&
        remaining !== null &&
        remaining !== undefined &&
        remaining <= 7

    const menuItems = [
        {
            key: 'query',
            icon: <SearchOutlined />,
            label: (
                <span className="nav-label">
                    <span className="nav-index">01</span>69 码查询
                </span>
            ),
        },
        {
            key: 'data',
            icon: <DatabaseOutlined />,
            label: (
                <span className="nav-label">
                    <span className="nav-index">02</span>数据管理
                </span>
            ),
        },
        {
            key: 'config',
            icon: <SettingOutlined />,
            label: (
                <span className="nav-label">
                    <span className="nav-index">03</span>列配置
                </span>
            ),
        },
        ...(canManageUsers
            ? [
                  {
                      key: 'users' as PageKey,
                      icon: <TeamOutlined />,
                      label: (
                          <span className="nav-label">
                              <span className="nav-index">04</span>用户管理
                          </span>
                      ),
                  },
              ]
            : []),
    ]

    const userMenuItems = [
        ...(canManageUsers
            ? [{ key: 'company-pwd', icon: <LockOutlined />, label: '修改公司数据库密码' }]
            : []),
        { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
    ]

    const handleUserMenu = ({ key }: { key: string }) => {
        if (key === 'logout') {
            logout()
        } else if (key === 'company-pwd') {
            setPwdOpen(true)
        }
    }

    const handleChangePwd = async () => {
        try {
            const values = await pwdForm.validateFields()
            setPwdLoading(true)
            await changeCompanyPassword(values.old_pwd, values.new_pwd)
            message.success('公司数据库密码已修改')
            setPwdOpen(false)
            pwdForm.resetFields()
        } catch (e) {
            if (e instanceof Error) message.error(e.message)
        } finally {
            setPwdLoading(false)
        }
    }

    const pageStyle = (key: PageKey): React.CSSProperties => ({
        display: page === key ? 'block' : 'none',
        height: '100%',
    })

    return (
        <Layout style={{ minHeight: '100vh' }}>
            <Sider
                width={224}
                collapsedWidth={64}
                theme="dark"
                collapsible
                collapsed={collapsed}
                onCollapse={setCollapsed}
                trigger={null}
                className="app-sider"
            >
                <div className="brand">
                    <div className="brand-mark">69</div>
                    {!collapsed && (
                        <div className="brand-text">
                            <span className="brand-name">
                                码<em>查询</em>器
                            </span>
                            <span className="brand-sub">Barcode Workspace</span>
                        </div>
                    )}
                </div>
                <Menu
                    mode="inline"
                    inlineCollapsed={collapsed}
                    selectedKeys={[page]}
                    items={menuItems}
                    onClick={({ key }) => handlePageChange(key as PageKey)}
                    style={{ borderInlineEnd: 'none', background: 'transparent', paddingTop: 8 }}
                />
                <div
                    className="sider-foot"
                    onClick={() => setCollapsed(!collapsed)}
                    title={collapsed ? '展开侧栏' : '收起侧栏'}
                >
                    {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                    {!collapsed && <span>收起导航</span>}
                </div>
            </Sider>

            <Layout>
                <Header className="app-header">
                    <div className="header-title-wrap">
                        <span className="overline">Workspace</span>
                        <span className="header-title">
                            {pageTitle[page]}
                            <span className="title-sep">/</span>
                            <span style={{ color: 'var(--text3)', fontWeight: 500, fontSize: 13 }}>
                                {pageIndex[page]}
                            </span>
                        </span>
                    </div>

                    <div className="header-meta">
                        {user && (
                            <>
                                <div className="chip">
                                    <BankOutlined style={{ color: 'var(--gold)' }} />
                                    <span>{isGuest ? '游客模式' : user.company_name || '未绑定公司'}</span>
                                </div>
                                {!isGuest && user.expires_at && remaining !== null && remaining !== undefined && (
                                    <div className="chip">
                                        <span
                                            className={'dot ' + (showExpiryWarn ? 'warn' : remaining < 0 ? 'off' : '')}
                                        />
                                        <span>
                                            有效期至 {user.expires_at.replace('T', ' ').slice(0, 10)}
                                            {remaining >= 0 ? ' · 剩 ' + remaining + ' 天' : ' · 已过期'}
                                        </span>
                                    </div>
                                )}
                                {!isGuest && !user.expires_at && (
                                    <div className="chip">
                                        <span className="dot" />
                                        <span>长期有效</span>
                                    </div>
                                )}
                                {isGuest && (
                                    <div className="chip">
                                        <ExperimentOutlined style={{ color: 'var(--info)' }} />
                                        <span>数据不会被保存</span>
                                    </div>
                                )}
                                <ThemeToggle variant="chip" />
                                <Tag color={roleColor[user.role]} style={{ marginInlineEnd: 0 }}>
                                    {roleLabel[user.role]}
                                </Tag>
                                <Dropdown
                                    menu={{ items: userMenuItems, onClick: handleUserMenu }}
                                    placement="bottomRight"
                                >
                                    <div className="user-trigger">
                                        <Avatar
                                            size={30}
                                            style={{
                                                background: 'linear-gradient(150deg,#e85f37,#b83d1c)',
                                                fontSize: 13,
                                                fontWeight: 600,
                                            }}
                                            icon={<UserOutlined />}
                                        />
                                        <span style={{ fontSize: 13, color: '#ede8e1', fontWeight: 600 }}>
                                            {user.username}
                                        </span>
                                    </div>
                                </Dropdown>
                            </>
                        )}
                    </div>
                </Header>

                <Content
                    style={{ overflow: 'auto', position: 'relative' }}
                    ref={contentRef}
                    onScroll={handleContentScroll}
                >
                    <div className="reading-progress">
                        <div style={{ width: (scrollProgress * 100).toFixed(2) + '%' }} />
                    </div>
                    <div className="app-content">
                        {isGuest && (
                            <Alert
                                type="warning"
                                showIcon
                                style={{ marginBottom: 20, borderRadius: 12 }}
                                message="游客模式：您当前的所有数据操作不会被保存，退出登录后自动清除全部使用痕迹。"
                            />
                        )}
                        {showExpiryWarn && (
                            <Alert
                                type="warning"
                                showIcon
                                style={{ marginBottom: 20, borderRadius: 12 }}
                                message={
                                    remaining !== null && remaining !== undefined && remaining >= 0
                                        ? '您的账号将于 ' + user?.expires_at?.replace('T', ' ').slice(0, 10) + ' 到期（剩 ' + remaining + ' 天），到期后将无法登录，请联系管理员延长有效期。'
                                        : '您的账号有效期已到，请联系管理员延长有效期。'
                                }
                            />
                        )}
                        <div
                            style={pageStyle('query')}
                            className={animPage === 'query' ? 'page-enter' : ''}
                            onAnimationEnd={() => setAnimPage(null)}
                        >
                            <QueryPage />
                        </div>
                        <div
                            style={pageStyle('data')}
                            className={animPage === 'data' ? 'page-enter' : ''}
                            onAnimationEnd={() => setAnimPage(null)}
                        >
                            <DataManagePage />
                        </div>
                        <div
                            style={pageStyle('config')}
                            className={animPage === 'config' ? 'page-enter' : ''}
                            onAnimationEnd={() => setAnimPage(null)}
                        >
                            <ConfigPage />
                        </div>
                        {canManageUsers && (
                            <div
                                style={pageStyle('users')}
                                className={animPage === 'users' ? 'page-enter' : ''}
                                onAnimationEnd={() => setAnimPage(null)}
                            >
                                <UserManagePage />
                            </div>
                        )}
                    </div>
                </Content>
            </Layout>

            {/* 修改公司数据库密码 */}
            <Modal
                title="修改公司数据库密码"
                open={pwdOpen}
                onOk={handleChangePwd}
                onCancel={() => {
                    setPwdOpen(false)
                    pwdForm.resetFields()
                }}
                okText="确定"
                cancelText="取消"
                confirmLoading={pwdLoading}
            >
                <Form form={pwdForm} layout="vertical">
                    <Form.Item
                        name="old_pwd"
                        label="原公司数据库密码"
                        rules={[{ required: true, message: '请输入原密码' }]}
                    >
                        <Input.Password placeholder="原公司数据库密码" />
                    </Form.Item>
                    <Form.Item
                        name="new_pwd"
                        label="新公司数据库密码"
                        rules={[{ required: true, message: '请输入新密码' }]}
                    >
                        <Input.Password placeholder="新公司数据库密码" />
                    </Form.Item>
                    <Form.Item
                        name="confirm_pwd"
                        label="确认新密码"
                        dependencies={['new_pwd']}
                        rules={[
                            { required: true, message: '请再次输入新密码' },
                            ({ getFieldValue }) => ({
                                validator(_, value) {
                                    if (!value || getFieldValue('new_pwd') === value) {
                                        return Promise.resolve()
                                    }
                                    return Promise.reject(new Error('两次输入的密码不一致'))
                                },
                            }),
                        ]}
                    >
                        <Input.Password placeholder="确认新密码" />
                    </Form.Item>
                </Form>
            </Modal>
        </Layout>
    )
}

function ThemedApp() {
    const { mode } = useTheme()
    return (
        <AntdProvider theme={buildAntdTheme(mode)}>
            <AuthProvider>
                <AuthGate />
            </AuthProvider>
            <RippleLayer />
        </AntdProvider>
    )
}

export default function App() {
    return (
        <ThemeProvider>
            <ThemedApp />
        </ThemeProvider>
    )
}