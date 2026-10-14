import { useRef, useState, type ReactNode, type CSSProperties } from 'react'

interface Props {
    children: ReactNode
    strength?: number
    block?: boolean
    className?: string
    style?: CSSProperties
}

/** 磁性悬停：元素被光标轻微“吸引”，松手回弹（弹簧缓动） */
export default function Magnetic({ children, strength = 0.32, block, className, style }: Props) {
    const ref = useRef<HTMLDivElement>(null)
    const [pos, setPos] = useState({ x: 0, y: 0 })

    const onMove = (e: React.MouseEvent) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        setPos({
            x: (e.clientX - (r.left + r.width / 2)) * strength,
            y: (e.clientY - (r.top + r.height / 2)) * strength,
        })
    }

    return (
        <div
            ref={ref}
            className={'magnetic' + (block ? ' block' : '') + (className ? ' ' + className : '')}
            style={style}
            onMouseMove={onMove}
            onMouseLeave={() => setPos({ x: 0, y: 0 })}
        >
            <div className="magnetic-inner" style={{ transform: 'translate(' + pos.x + 'px,' + pos.y + 'px)' }}>
                {children}
            </div>
        </div>
    )
}
