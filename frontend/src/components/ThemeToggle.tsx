import { useTheme } from '../context/ThemeContext'
import { SunOutlined, MoonOutlined } from '@ant-design/icons'

interface Props {
    /** floating: 登录页右上角悬浮；chip: 主界面顶栏胶囊 */
    variant?: 'floating' | 'chip'
}

/** 深浅色切换按钮 */
export default function ThemeToggle({ variant = 'chip' }: Props) {
    const { mode, toggle } = useTheme()
    const isDark = mode === 'dark'
    const label = isDark ? '浅色' : '深色'

    return (
        <button
            type="button"
            className={'theme-toggle-btn' + (variant === 'floating' ? ' theme-toggle-floating' : '')}
            onClick={toggle}
            title={isDark ? '切换到浅色模式' : '切换到深色模式'}
            aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
        >
            <span className="toggle-icon">
                {isDark ? <SunOutlined /> : <MoonOutlined />}
            </span>
            {variant === 'chip' && <span>{label}</span>}
        </button>
    )
}
