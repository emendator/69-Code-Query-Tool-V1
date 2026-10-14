/* ── Shared Types ─────────────────────────────────────────── */

export interface Product {
    id: number
    model: string
    name: string
    code: string
    source: string
    remark: string
    created_at: string
    updated_at: string
}

export interface ProductCreate {
    model: string
    name: string
    code: string
    remark: string
}

export interface ProductUpdate {
    model: string
    name: string
    code: string
    remark: string
}

export interface ApiResponse<T = unknown> {
    success: boolean
    data: T
    message: string
}

export interface PageData<T> {
    items: T[]
    total: number
    page: number
    page_size: number
}

export interface BatchQueryItem {
    code: string
    found: boolean
    row: Product | null
}

export interface ImportPreview {
    filename: string
    total_rows: number
    columns: string[]
    preview_rows: Record<string, string>[]
}

export interface ColumnMatchResult {
    target_field: string  // 'model' | 'name' | 'code'
    source_column: string
    confidence: string     // 'high' | 'medium' | 'low'
}

export interface SkipDetail {
    code: string
    reason: string
}

export interface ImportResult {
    total: number
    imported: number
    skipped: number
    skip_details?: SkipDetail[]
}

export interface ColumnConfigItem {
    field: string
    view_type?: string
    label: string
    width: number
    visible: boolean
    sort_order: number
}

export interface DeduplicateResult {
    deleted_count: number
}

/* ── Auth / 登录权限系统 ─────────────────────────────────── */

export type Role = 'super_admin' | 'admin' | 'user' | 'guest'

export interface UserInfo {
    id: number
    username: string
    role: Role
    company_id: number | null
    company_name: string | null
    email: string
    status: 'active' | 'expired' | 'disabled'
    expires_at: string | null
    created_at: string | null
    last_login_at: string | null
    remaining_days: number | null
}

export interface LoginResponse {
    token: string
    user: UserInfo
}

export interface RegisterRequest {
    username: string
    password: string
    email: string
    invite_code: string
    mode: 'create' | 'join'
    company_name: string
    company_db_password: string
}

export interface InviteCodeItem {
    id: number
    code: string
    level: 1 | 2
    issued_by: number
    issued_by_username?: string | null
    status: 'unused' | 'used' | 'revoked'
    expires_at: string | null
    account_expires_at: string | null
    used_by: number | null
    used_by_username?: string | null
    used_at: string | null
    created_at: string | null
}

export interface InviteCreateRequest {
    level: 1 | 2
    expires_at?: string | null
    account_expires_at?: string | null
}
