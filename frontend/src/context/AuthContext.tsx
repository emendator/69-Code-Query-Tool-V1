import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { UserInfo, LoginResponse } from '../types'
import { loginAccount, guestLoginAccount, logoutAccount, fetchMe, authStorage } from '../api'

const USER_KEY = '69code_user'

interface AuthContextValue {
    token: string | null
    user: UserInfo | null
    login: (username: string, password: string) => Promise<void>
    guestLogin: () => Promise<void>
    applyAuth: (res: LoginResponse) => void
    logout: () => void
    refreshMe: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>({
    token: null,
    user: null,
    login: async () => { },
    guestLogin: async () => { },
    applyAuth: () => { },
    logout: () => { },
    refreshMe: async () => { },
})

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => authStorage.getToken())
    const [user, setUser] = useState<UserInfo | null>(() => {
        try {
            const raw = localStorage.getItem(USER_KEY)
            return raw ? (JSON.parse(raw) as UserInfo) : null
        } catch {
            return null
        }
    })

    const applyAuth = useCallback((res: LoginResponse) => {
        localStorage.setItem('69code_token', res.token)
        localStorage.setItem(USER_KEY, JSON.stringify(res.user))
        setToken(res.token)
        setUser(res.user)
    }, [])

    const login = useCallback(
        async (username: string, password: string) => {
            const res = await loginAccount(username, password)
            applyAuth(res)
        },
        [applyAuth],
    )

    const guestLogin = useCallback(async () => {
        const res = await guestLoginAccount()
        applyAuth(res)
    }, [applyAuth])

    const logout = useCallback(async () => {
        // 游客退出：先通知后端清除使用痕迹（用户/公司/69库/上传目录），再清理本地登录态
        try {
            if (user?.role === 'guest' && authStorage.getToken()) {
                await logoutAccount()
            }
        } catch {
            // 后端清理失败也照常本地退出
        }
        authStorage.clear()
        setToken(null)
        setUser(null)
    }, [user])

    const refreshMe = useCallback(async () => {
        if (!authStorage.getToken()) return
        const me = await fetchMe()
        localStorage.setItem(USER_KEY, JSON.stringify(me))
        setUser(me)
    }, [])

    // 已登录时启动刷新用户信息（有效期/最后登录时间等）
    useEffect(() => {
        if (token) {
            refreshMe().catch(() => { })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return (
        <AuthContext.Provider value={{ token, user, login, guestLogin, applyAuth, logout, refreshMe }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}
