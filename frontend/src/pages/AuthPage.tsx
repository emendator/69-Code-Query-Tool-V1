import React, { useEffect, useRef, useState } from 'react'
import { Form, Input, Button, Alert, Typography, Radio, Space, Divider, type InputRef } from 'antd'
import {
    UserOutlined,
    LockOutlined,
    MailOutlined,
    SafetyCertificateOutlined,
    BankOutlined,
    CheckCircleOutlined,
    SafetyOutlined,
    RightOutlined,
    LeftOutlined,
} from '@ant-design/icons'
import { useAuth } from '../context/AuthContext'
import { checkInvite, registerAccount } from '../api'
import InteractiveBackdrop from '../components/motion/InteractiveBackdrop'
import Magnetic from '../components/motion/Magnetic'
import ThemeToggle from '../components/ThemeToggle'

const BLOCKED_REASON_KEY = '69code_blocked_reason'

interface RegisterValues {
    username: string
    password: string
    confirm: string
    email: string
    invite_code: string
    mode?: 'create' | 'join'
    company_name: string
    company_db_password: string
}

/** 3D 翻转认证卡片：正面登录 / 背面注册 */
export default function AuthPage() {
    const { login, guestLogin, applyAuth } = useAuth()

    const [flipped, setFlipped] = useState(false)

    // ── 登录 ──
    const [loginLoading, setLoginLoading] = useState(false)
    const [guestLoading, setGuestLoading] = useState(false)
    const [loginError, setLoginError] = useState('')

    // ── 注册 ──
    const [registerForm] = Form.useForm<RegisterValues>()
    const [registerLoading, setRegisterLoading] = useState(false)
    const [registerError, setRegisterError] = useState('')
    const [inviteLevel, setInviteLevel] = useState<1 | 2 | null>(null)
    const [checkingInvite, setCheckingInvite] = useState(false)
    const watchedMode = Form.useWatch('mode', registerForm)
    const isCreate = inviteLevel === 1 && watchedMode === 'create'

    const loginInputRef = useRef<InputRef>(null)

    // 展示因账号到期/禁用被登出时的提醒
    useEffect(() => {
        const reason = localStorage.getItem(BLOCKED_REASON_KEY)
        if (reason) {
            setLoginError(reason)
            localStorage.removeItem(BLOCKED_REASON_KEY)
        }
    }, [])

    const flip = () => {
        setFlipped((f) => !f)
        setLoginError('')
        setRegisterError('')
        setInviteLevel(null)
        registerForm.resetFields()
    }

    // 翻回正面后自动聚焦用户名
    useEffect(() => {
        if (!flipped) {
            const timer = window.setTimeout(() => loginInputRef.current?.focus(), 900)
            return () => window.clearTimeout(timer)
        }
    }, [flipped])

    // ── 登录提交 ──
    const onLoginFinish = async (values: { username: string; password: string }) => {
        setLoginError('')
        setLoginLoading(true)
        try {
            await login(values.username, values.password)
        } catch (e) {
            setLoginError(e instanceof Error ? e.message : '登录失败，请稍后重试')
        } finally {
            setLoginLoading(false)
        }
    }

    const onGuestLogin = async () => {
        setLoginError('')
        setGuestLoading(true)
        try {
            await guestLogin()
        } catch (e) {
            setLoginError(e instanceof Error ? e.message : '游客登录失败，请稍后重试')
        } finally {
            setGuestLoading(false)
        }
    }

    // ── 邀请码校验 ──
    const handleCheckInvite = async () => {
        const code = registerForm.getFieldValue('invite_code')?.trim()
        if (!code) {
            setRegisterError('请输入邀请码')
            return
        }
        setRegisterError('')
        setCheckingInvite(true)
        try {
            const res = await checkInvite(code)
            setInviteLevel(res.level)
            registerForm.setFieldsValue({ mode: res.level === 1 ? 'create' : 'join' })
        } catch (e) {
            setInviteLevel(null)
            setRegisterError(e instanceof Error ? e.message : '邀请码校验失败')
        } finally {
            setCheckingInvite(false)
        }
    }

    // ── 注册提交 ──
    const onRegisterFinish = async (values: RegisterValues) => {
        setRegisterError('')
        if (inviteLevel === null) {
            setRegisterError('请先点击「校验邀请码」，验证通过后再填写公司信息')
            return
        }
        const mode: 'create' | 'join' =
            inviteLevel === 1 ? (values.mode ?? 'join') : 'join'

        setRegisterLoading(true)
        try {
            const res = await registerAccount({
                username: values.username,
                password: values.password,
                email: values.email,
                invite_code: values.invite_code.trim(),
                mode,
                company_name: values.company_name.trim(),
                company_db_password: values.company_db_password,
            })
            applyAuth(res)
        } catch (e) {
            setRegisterError(e instanceof Error ? e.message : '注册失败，请稍后重试')
        } finally {
            setRegisterLoading(false)
        }
    }

    return (
        <div className="auth-shell">
            <InteractiveBackdrop />
            <ThemeToggle variant="floating" />

            <aside className="auth-brand">
                <div className="brand">
                    <div className="brand-mark float-slow">69</div>
                    <div className="brand-text">
                        <span className="brand-name">
                            码<em>查询</em>器
                        </span>
                        <span className="brand-sub">Barcode Workspace</span>
                    </div>
                </div>

                <div className="auth-brand-copy">
                    <span className="overline">Barcode · Workspace</span>
                    <h1 className="auth-hero">
                        <span className="hero-line" style={{ '--d': '0.05s' } as React.CSSProperties}>
                            <span>每一码，</span>
                        </span>
                        <br />
                        <span className="hero-line" style={{ '--d': '0.18s' } as React.CSSProperties}>
                            <span>
                                都<em className="text-gradient-anim">清清楚楚</em>。
                            </span>
                        </span>
                    </h1>
                    <p className="auth-lead">
                        为团队打造的商品条码工作台 —— 批量精确查询、模糊搜索、Excel
                        导入导出与一键去重，让数据管理像翻阅一本索引清晰的册子。
                    </p>
                    <ul className="auth-features">
                        <li><span>01</span>批量输入 69 码，自动精确 + 模糊匹配</li>
                        <li><span>02</span>Excel 导入 / 导出，重复码一键清理</li>
                        <li><span>03</span>公司协作账号体系，按角色分配权限</li>
                    </ul>
                </div>

                <div className="auth-brand-footer">© 2026 69 码查询器</div>
            </aside>

            <main className="auth-panel">
                <div className={'flip-wrap' + (flipped ? '' : '')}>
                    <div className={'flip-card' + (flipped ? ' flipped' : '')}>

                        {/* ── 正面：登录 ── */}
                        <div className="flip-face flip-face-front auth-card blur-reveal">
                            <span className="overline">Account · Sign in</span>
                            <h2 className="auth-title">欢迎回来</h2>
                            <p className="auth-sub">登录后继续你的查询与数据管理工作</p>

                            {loginError && (
                                <Alert
                                    type="error"
                                    message={loginError}
                                    showIcon
                                    className="auth-error"
                                    closable
                                    onClose={() => setLoginError('')}
                                />
                            )}

                            <Form onFinish={onLoginFinish} size="large" requiredMark={false}>
                                <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
                                    <Input
                                        ref={loginInputRef}
                                        prefix={<UserOutlined style={{ color: 'var(--text4)' }} />}
                                        placeholder="用户名"
                                        autoComplete="username"
                                    />
                                </Form.Item>
                                <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
                                    <Input.Password
                                        prefix={<LockOutlined style={{ color: 'var(--text4)' }} />}
                                        placeholder="密码"
                                        autoComplete="current-password"
                                    />
                                </Form.Item>
                                <Form.Item style={{ marginBottom: 4 }}>
                                    <Magnetic block strength={0.28}>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            block
                                            loading={loginLoading}
                                            className="auth-submit btn-jelly"
                                        >
                                            登 录
                                        </Button>
                                    </Magnetic>
                                </Form.Item>
                            </Form>

                            <Divider plain className="auth-divider">
                                或
                            </Divider>

                            <Button
                                block
                                loading={guestLoading}
                                onClick={onGuestLogin}
                                className="auth-guest-btn"
                            >
                                <SafetyOutlined /> 以游客身份体验
                            </Button>
                            <Alert
                                type="info"
                                showIcon
                                className="auth-notice"
                                message="游客模式可体验全部功能，但不会保留任何数据，退出登录后自动清除所有使用痕迹。"
                            />

                            <div className="flip-toggle">
                                <Typography.Text type="secondary">还没有账号？</Typography.Text>
                                <span className="flip-btn" onClick={flip}>
                                    立即注册 <RightOutlined />
                                </span>
                            </div>
                        </div>

                        {/* ── 背面：注册（基础字段 2×2 排列） ── */}
                        <div className="flip-face flip-face-back auth-card">
                            <span className="overline">Account · Register</span>
                            <h2 className="auth-title">创建账号</h2>
                            <p className="auth-sub">通过邀请码注册，绑定公司与角色</p>

                            {registerError && (
                                <Alert
                                    type="error"
                                    message={registerError}
                                    showIcon
                                    className="auth-error"
                                    closable
                                    onClose={() => setRegisterError('')}
                                />
                            )}

                            <Form
                                form={registerForm}
                                onFinish={onRegisterFinish}
                                size="large"
                                requiredMark={false}
                                onValuesChange={(changed) => {
                                    if ('invite_code' in changed) setInviteLevel(null)
                                }}
                            >
                                {/* 2×2：用户名 / 邮箱 / 密码 / 确认密码 */}
                                <div className="register-grid">
                                    <Form.Item
                                        name="username"
                                        rules={[
                                            { required: true, message: '请输入用户名' },
                                            { pattern: /^[a-zA-Z0-9_]{3,20}$/, message: '3-20位字母、数字或下划线' },
                                        ]}
                                    >
                                        <Input prefix={<UserOutlined style={{ color: 'var(--text4)' }} />} placeholder="用户名" />
                                    </Form.Item>
                                    <Form.Item
                                        name="email"
                                        rules={[
                                            { required: true, message: '请输入邮箱' },
                                            { type: 'email', message: '邮箱格式不正确' },
                                        ]}
                                    >
                                        <Input prefix={<MailOutlined style={{ color: 'var(--text4)' }} />} placeholder="绑定邮箱" />
                                    </Form.Item>
                                    <Form.Item
                                        name="password"
                                        rules={[
                                            { required: true, message: '请输入密码' },
                                            { min: 6, message: '密码至少 6 位' },
                                        ]}
                                    >
                                        <Input.Password prefix={<LockOutlined style={{ color: 'var(--text4)' }} />} placeholder="密码（至少6位）" />
                                    </Form.Item>
                                    <Form.Item
                                        name="confirm"
                                        dependencies={['password']}
                                        rules={[
                                            { required: true, message: '请再次输入密码' },
                                            ({ getFieldValue }) => ({
                                                validator(_, value) {
                                                    if (!value || getFieldValue('password') === value) {
                                                        return Promise.resolve()
                                                    }
                                                    return Promise.reject(new Error('两次输入的密码不一致'))
                                                },
                                            }),
                                        ]}
                                    >
                                        <Input.Password prefix={<LockOutlined style={{ color: 'var(--text4)' }} />} placeholder="确认密码" />
                                    </Form.Item>
                                </div>

                                <Form.Item name="invite_code" rules={[{ required: true, message: '请输入邀请码' }]}>
                                    <Space.Compact style={{ width: '100%' }}>
                                        <Input
                                            prefix={<SafetyCertificateOutlined style={{ color: 'var(--text4)' }} />}
                                            placeholder="邀请码"
                                            disabled={checkingInvite}
                                        />
                                        <Button type="default" loading={checkingInvite} onClick={handleCheckInvite}>
                                            校验
                                        </Button>
                                    </Space.Compact>
                                </Form.Item>

                                {inviteLevel === null ? (
                                    <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                                        请输入并校验邀请码后，继续填写公司信息
                                    </Typography.Text>
                                ) : (
                                    <>
                                        <Divider style={{ margin: '6px 0 14px' }} />
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                fontSize: 13,
                                                color: '#6fc78f',
                                                background: 'var(--ok-soft)',
                                                border: '1px solid var(--ok-line)',
                                                borderRadius: 10,
                                                padding: '8px 12px',
                                                marginBottom: 14,
                                            }}
                                        >
                                            <CheckCircleOutlined />
                                            <span>
                                                邀请码有效：
                                                {inviteLevel === 1 ? '一级邀请码（管理员注册）' : '二级邀请码（用户注册）'}
                                            </span>
                                        </div>

                                        {inviteLevel === 1 && (
                                            <Form.Item name="mode" initialValue="create">
                                                <Radio.Group style={{ width: '100%' }}>
                                                    <Space direction="vertical" style={{ width: '100%' }}>
                                                        <Radio value="create">创建新公司</Radio>
                                                        <Radio value="join">加入已有公司</Radio>
                                                    </Space>
                                                </Radio.Group>
                                            </Form.Item>
                                        )}

                                        <Form.Item
                                            name="company_name"
                                            rules={[{ required: true, message: '请输入公司名称' }]}
                                            extra={isCreate ? '公司名称填写后不可修改' : undefined}
                                        >
                                            <Input prefix={<BankOutlined style={{ color: 'var(--text4)' }} />} placeholder="公司名称" />
                                        </Form.Item>
                                        {inviteLevel === 2 && (
                                            <Typography.Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
                                                用户账号仅支持加入已有公司
                                            </Typography.Text>
                                        )}

                                        <Form.Item
                                            name="company_db_password"
                                            rules={[{ required: true, message: isCreate ? '请设置公司数据库密码' : '请输入公司数据库密码' }]}
                                        >
                                            <Input.Password
                                                prefix={<LockOutlined style={{ color: 'var(--text4)' }} />}
                                                placeholder={isCreate ? '设置公司数据库密码' : '公司数据库密码'}
                                            />
                                        </Form.Item>
                                    </>
                                )}

                                <Form.Item style={{ marginBottom: 4, marginTop: 8 }}>
                                    <Magnetic block strength={0.28}>
                                        <Button
                                            type="primary"
                                            htmlType="submit"
                                            block
                                            loading={registerLoading}
                                            className="auth-submit btn-jelly"
                                        >
                                            注 册
                                        </Button>
                                    </Magnetic>
                                </Form.Item>
                            </Form>

                            <div className="flip-toggle">
                                <Typography.Text type="secondary">已有账号？</Typography.Text>
                                <span className="flip-btn" onClick={flip}>
                                    <LeftOutlined /> 前往登录
                                </span>
                            </div>
                        </div>

                    </div>
                </div>
            </main>
        </div>
    )
}