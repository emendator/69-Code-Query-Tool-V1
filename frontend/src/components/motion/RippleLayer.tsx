import { useEffect } from 'react'

/** 全局点击涟漪：作用于所有 .ant-btn（从点击处扩散波纹） */
export default function RippleLayer() {
    useEffect(() => {
        const onPointerDown = (e: PointerEvent) => {
            const target = e.target as HTMLElement
            const host = target.closest('.ant-btn')
            if (!host) return
            const rect = host.getBoundingClientRect()
            const d = Math.max(rect.width, rect.height) * 1.15
            const span = document.createElement('span')
            span.className = 'ripple-ink'
            span.style.width = d + 'px'
            span.style.height = d + 'px'
            span.style.left = e.clientX - rect.left - d / 2 + 'px'
            span.style.top = e.clientY - rect.top - d / 2 + 'px'
            host.appendChild(span)
            window.setTimeout(() => span.remove(), 750)
        }
        document.addEventListener('pointerdown', onPointerDown)
        return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [])
    return null
}
