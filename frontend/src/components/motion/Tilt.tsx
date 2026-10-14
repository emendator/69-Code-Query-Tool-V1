import { useRef, useState, type ReactNode, type CSSProperties } from 'react'

interface Props {
    children: ReactNode
    max?: number
    className?: string
    style?: CSSProperties
}

/** 3D 悬浮卡片：跟随光标做轻微立体旋转 */
export default function Tilt({ children, max = 7, className, style }: Props) {
    const ref = useRef<HTMLDivElement>(null)
    const [rot, setRot] = useState({ x: 0, y: 0 })

    const onMove = (e: React.MouseEvent) => {
        const el = ref.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const px = (e.clientX - r.left) / r.width - 0.5
        const py = (e.clientY - r.top) / r.height - 0.5
        setRot({ x: -py * max * 2, y: px * max * 2 })
    }

    return (
        <div
            ref={ref}
            className={'tilt' + (className ? ' ' + className : '')}
            style={style}
            onMouseMove={onMove}
            onMouseLeave={() => setRot({ x: 0, y: 0 })}
        >
            <div
                className="tilt-inner"
                style={{ transform: 'perspective(900px) rotateX(' + rot.x + 'deg) rotateY(' + rot.y + 'deg)' }}
            >
                {children}
            </div>
        </div>
    )
}
