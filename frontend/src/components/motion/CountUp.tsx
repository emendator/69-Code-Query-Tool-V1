import { useEffect, useRef, useState } from 'react'

interface Props {
    value: number
    duration?: number
    className?: string
}

/** 数字滚动：0 → 目标值（三次缓出） */
export default function CountUp({ value, duration = 800, className }: Props) {
    const [display, setDisplay] = useState(0)
    const prevRef = useRef(0)

    useEffect(() => {
        const from = prevRef.current
        const to = value
        prevRef.current = value
        if (from === to) return
        const start = performance.now()
        let raf = 0
        const tick = (t: number) => {
            const p = Math.min(1, (t - start) / duration)
            const eased = 1 - Math.pow(1 - p, 3)
            setDisplay(Math.round(from + (to - from) * eased))
            if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [value, duration])

    return <span className={'countup' + (className ? ' ' + className : '')}>{display}</span>
}
