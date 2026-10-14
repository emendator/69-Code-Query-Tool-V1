import axios from 'axios'
import type {
    ApiResponse,
    PageData,
    Product,
    ProductCreate,
    ProductUpdate,
    BatchQueryItem,
    ImportPreview,
    ColumnMatchResult,
    ImportResult,
    ColumnConfigItem,
    DeduplicateResult,
    UserInfo,
    LoginResponse,
    RegisterRequest,
    InviteCodeItem,
    InviteCreateRequest,
} from '../types'

const TOKEN_KEY = '69code_token'
const BLOCKED_REASON_KEY = '69code_blocked_reason'

export const authStorage = {
    getToken: () => localStorage.getItem(TOKEN_KEY),
    clear: () => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('69code_user')
    },
}

const http = axios.create({
    baseURL: '/api',
    timeout: 30000,
})

http.interceptors.request.use((config) => {
    const token = authStorage.getToken()
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

http.interceptors.response.use(
    (res) => res,
    (err) => {
        const status = err.response?.status
        const detail = err.response?.data?.detail || ''
        const msg = detail || err.response?.data?.message || err.message || '网络错误'

        // 登录态失效（token 无效/过期）→ 清除并回登录页
        if (status === 401 && authStorage.getToken()) {
            authStorage.clear()
            window.location.reload()
            return Promise.reject(new Error(msg))
        }

        // 账号被禁用/有效期已到 → 记录原因并登出，登录页展示提醒
        if (
            status === 403 &&
            authStorage.getToken() &&
            (detail.includes('账号有效期已到') || detail.includes('账号已被禁用'))
        ) {
            localStorage.setItem(BLOCKED_REASON_KEY, detail)
            authStorage.clear()
            window.location.reload()
            return Promise.reject(new Error(msg))
        }

        return Promise.reject(new Error(msg))
    },
)

/* ── Query ──────────────────────────────────────────────── */

export async function querySingle(code: string): Promise<Product | null> {
    const res = await http.get<ApiResponse<Product | null>>('/query/single', { params: { code } })
    return res.data.data
}

export async function queryBatch(codes: string[]): Promise<BatchQueryItem[]> {
    const res = await http.post<ApiResponse<BatchQueryItem[]>>('/query/batch', { codes })
    return res.data.data
}

export async function queryFuzzy(q: string): Promise<Product[]> {
    const res = await http.get<ApiResponse<Product[]>>('/query/fuzzy', { params: { q } })
    return res.data.data
}

/* ── Data Management ───────────────────────────────────── */

export async function fetchDataList(
    page: number,
    pageSize: number,
    search: string,
): Promise<PageData<Product>> {
    const res = await http.get<ApiResponse<PageData<Product>>>('/data', {
        params: { page, page_size: pageSize, search },
    })
    return res.data.data
}

export async function createProduct(data: ProductCreate): Promise<Product> {
    const res = await http.post<ApiResponse<Product>>('/data', data)
    return res.data.data
}

export async function updateProduct(id: number, data: ProductUpdate): Promise<Product> {
    const res = await http.put<ApiResponse<Product>>(`/data/${id}`, data)
    return res.data.data
}

export async function deleteProduct(id: number): Promise<void> {
    await http.delete(`/data/${id}`)
}

export async function batchDeleteProducts(ids: number[]): Promise<void> {
    await http.post('/data/batch-delete', ids)
}

/* ── Deduplication ─────────────────────────────────────── */

export async function getDuplicateCodes(): Promise<string[]> {
    const res = await http.get<ApiResponse<string[]>>('/data/duplicate-codes')
    return res.data.data
}

export async function getDuplicateProducts(): Promise<Product[]> {
    const res = await http.get<ApiResponse<Product[]>>('/data/duplicates')
    return res.data.data
}

export async function deduplicate(): Promise<DeduplicateResult> {
    const res = await http.post<ApiResponse<DeduplicateResult>>('/data/deduplicate')
    return res.data.data
}

/* ── Import ─────────────────────────────────────────────── */

export async function uploadTempFile(file: File): Promise<string> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiResponse<{ filename: string }>>('/import/upload-temp', form)
    return res.data.data.filename
}

export async function getImportPreview(filename: string): Promise<ImportPreview> {
    const res = await http.post<ApiResponse<ImportPreview>>('/import/upload', { filename })
    return res.data.data
}

export async function matchColumns(columns: string[]): Promise<ColumnMatchResult[]> {
    const res = await http.post<ApiResponse<{ matches: ColumnMatchResult[] }>>('/import/match-columns', { columns })
    return res.data.data.matches
}

export async function confirmImport(
    filename: string,
    columnMapping: Record<string, string>,
    addToSemantic: boolean,
): Promise<ImportResult> {
    const res = await http.post<ApiResponse<ImportResult>>('/import/confirm', {
        filename,
        column_mapping: columnMapping,
        add_to_semantic: addToSemantic,
    })
    return res.data.data
}

/* ── Semantic ───────────────────────────────────────────── */

export async function addSemanticMapping(sourceColumn: string, targetField: string): Promise<void> {
    await http.post('/semantic', { source_column: sourceColumn, target_field: targetField })
}

/* ── Column Config ─────────────────────────────────────── */

export async function fetchColumnConfigs(viewType: string = 'data'): Promise<ColumnConfigItem[]> {
    const res = await http.get<ApiResponse<ColumnConfigItem[]>>('/config/columns', {
        params: { view_type: viewType },
    })
    return res.data.data
}

export async function updateColumnConfigs(columns: ColumnConfigItem[]): Promise<void> {
    await http.put('/config/columns', { columns })
}

export async function uploadFileForImport(file: File): Promise<ImportPreview> {
    const form = new FormData()
    form.append('file', file)
    const res = await http.post<ApiResponse<ImportPreview>>('/import/upload', form)
    return res.data.data
}

/* ── Auth / 登录权限系统 ────────────────────────────── */

export async function checkInvite(inviteCode: string): Promise<{ level: 1 | 2 }> {
    const res = await http.post<ApiResponse<{ level: 1 | 2 }>>('/auth/register/check-invite', {
        invite_code: inviteCode,
    })
    return res.data.data
}

export async function registerAccount(data: RegisterRequest): Promise<LoginResponse> {
    const res = await http.post<ApiResponse<LoginResponse>>('/auth/register', data)
    return res.data.data
}

export async function loginAccount(username: string, password: string): Promise<LoginResponse> {
    const res = await http.post<ApiResponse<LoginResponse>>('/auth/login', { username, password })
    return res.data.data
}

export async function guestLoginAccount(): Promise<LoginResponse> {
    const res = await http.post<ApiResponse<LoginResponse>>('/auth/guest/login')
    return res.data.data
}

export async function logoutAccount(): Promise<void> {
    await http.post('/auth/logout')
}

export async function fetchMe(): Promise<UserInfo> {
    const res = await http.get<ApiResponse<UserInfo>>('/auth/me')
    return res.data.data
}

export async function changeCompanyPassword(oldPwd: string, newPwd: string): Promise<void> {
    await http.put('/auth/company/password', {
        old_db_password: oldPwd,
        new_db_password: newPwd,
    })
}

/* ── Invites ─────────────────────────────────────────── */

export async function fetchInvites(page = 1, pageSize = 50): Promise<PageData<InviteCodeItem>> {
    const res = await http.get<ApiResponse<PageData<InviteCodeItem>>>('/invites', {
        params: { page, page_size: pageSize },
    })
    return res.data.data
}

export async function createInvite(data: InviteCreateRequest): Promise<InviteCodeItem> {
    const res = await http.post<ApiResponse<InviteCodeItem>>('/invites', data)
    return res.data.data
}

export async function revokeInvite(id: number): Promise<void> {
    await http.delete(`/invites/${id}`)
}

/* ── User management ─────────────────────────────────── */

export async function fetchUsers(params: {
    page?: number
    page_size?: number
    search?: string
    role?: string
    status?: string
}): Promise<PageData<UserInfo>> {
    const res = await http.get<ApiResponse<PageData<UserInfo>>>('/users', { params })
    return res.data.data
}

export async function extendUser(id: number, expiresAt: string): Promise<void> {
    await http.put(`/users/${id}/extend`, { expires_at: expiresAt })
}

export async function deleteUser(id: number): Promise<{ deleted_count: number }> {
    const res = await http.delete<ApiResponse<{ deleted_count: number }>>(`/users/${id}`)
    return res.data.data
}
