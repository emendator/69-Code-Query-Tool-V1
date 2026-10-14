import { useEffect, useRef } from 'react'

interface Orb {
    x: number
    y: number
    r: number
    vx: number
    vy: number
    baseA: number
    ph: number
}

interface Ring {
    x: number
    y: number
    r: number
    max: number
}

interface Props {
    className?: string
}

/**
 * 登录页交互式动态背景（Canvas + rAF，零依赖）
 * - 漂浮粒子 + 近距离连线（星座感）
 * - 光标跟随光晕，粒子被光标轻微吸引
 * - 点击泛起涟漪光波
 * - 聚焦输入框时整体色调从朱砂向琥珀过渡
 * - prefers-reduced-motion 时仅绘制一帧静态画面
 */
export default function InteractiveBackdrop({ className }: Props) {
    const ref = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = ref.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        let w = 0
        let h = 0
        let dpr = 1
        let raf = 0
        let running = true
        const mouse = { x: -9999, y: -9999 }
        const rings: Ring[] = []
        let orbs: Orb[] = []
        let focus = 0
        let focusTarget = 0
        let t = 0

        const makeOrb = (): Orb => ({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 1.4 + Math.random() * 3.4,
            vx: (Math.random() - 0.5) * 0.34,
            vy: (Math.random() - 0.5) * 0.34,
            baseA: 0.22 + Math.random() * 0.4,
            ph: Math.random() * Math.PI * 2,
        })

        const resize = () => {
            const rect = canvas.getBoundingClientRect()
            w = rect.width
            h = rect.height
            dpr = Math.min(2, window.devicePixelRatio || 1)
            canvas.width = Math.max(1, Math.round(w * dpr))
            canvas.height = Math.max(1, Math.round(h * dpr))
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
            const count = reduce ? 0 : Math.min(80, Math.floor((w * h) / 17000))
            orbs = Array.from({ length: count }, makeOrb)
        }

        // 事件挂在 window 上：canvas 被品牌栏/表单面板（z-index:1）完全覆盖，
        // 挂在 canvas 上收不到任何鼠标事件，粒子跟随与点击涟漪将失效
        const toCanvas = (clientX: number, clientY: number) => {
            const rect = canvas.getBoundingClientRect()
            return {
                x: clientX - rect.left,
                y: clientY - rect.top,
                inside: clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom,
            }
        }

        const onMove = (e: MouseEvent) => {
            const p = toCanvas(e.clientX, e.clientY)
            if (p.inside) {
                mouse.x = p.x
                mouse.y = p.y
            } else {
                mouse.x = -9999
                mouse.y = -9999
            }
        }

        const onLeave = () => {
            mouse.x = -9999
            mouse.y = -9999
        }

        const onClick = (e: MouseEvent) => {
            const p = toCanvas(e.clientX, e.clientY)
            if (!p.inside) return
            rings.push({
                x: p.x,
                y: p.y,
                r: 4,
                max: 110 + Math.random() * 60,
            })
        }

        const onFocusIn = (e: FocusEvent) => {
            const el = e.target as HTMLElement
            focusTarget = el.matches('input, textarea') && el.closest('.auth-shell') ? 1 : 0
        }

        const draw = () => {
            if (!running) return
            ctx.clearRect(0, 0, w, h)

            // 跟随主题：浅色下使用更深的朱砂、更高的对比度
            const light = document.documentElement.dataset.theme === 'light'
            const hueBase = light ? 14 : 22
            const lumBase = light ? 46 : 56
            const aMul = light ? 1.15 : 1
            const hue = hueBase + focus * (light ? 10 : 16)

            // 环境光晕
            const glowR = ctx.createRadialGradient(w * 0.82, h * 0.1, 0, w * 0.82, h * 0.1, w * 0.5)
            glowR.addColorStop(0, 'hsla(' + hue + ', 72%, ' + (light ? 42 : 52) + '%, ' + (light ? 0.05 : 0.07) + ')')
            glowR.addColorStop(1, 'transparent')
            ctx.fillStyle = glowR
            ctx.fillRect(0, 0, w, h)

            const glowB = ctx.createRadialGradient(w * 0.12, h * 0.95, 0, w * 0.12, h * 0.95, w * 0.42)
            glowB.addColorStop(0, 'hsla(38, 65%, ' + (light ? 45 : 55) + '%, ' + (light ? 0.04 : 0.05) + ')')
            glowB.addColorStop(1, 'transparent')
            ctx.fillStyle = glowB
            ctx.fillRect(0, 0, w, h)

            // 粒子 + 连线
            for (let i = 0; i < orbs.length; i++) {
                const o = orbs[i]
                const dxm = mouse.x - o.x
                const dym = mouse.y - o.y
                const dm = Math.hypot(dxm, dym)
                if (dm < 170 && dm > 0.001) {
                    const pull = (1 - dm / 170) * 0.028
                    o.vx += (dxm / dm) * pull
                    o.vy += (dym / dm) * pull
                }
                o.vx *= 0.985
                o.vy *= 0.985
                o.x += o.vx
                o.y += o.vy
                if (o.x < -20) o.x = w + 20
                if (o.x > w + 20) o.x = -20
                if (o.y < -20) o.y = h + 20
                if (o.y > h + 20) o.y = -20

                const pulse = 0.72 + 0.28 * Math.sin(t * 0.0011 + o.ph)
                const a = o.baseA * pulse * (0.85 + focus * 0.25) * aMul
                ctx.beginPath()
                ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
                ctx.fillStyle = 'hsla(' + hue + ', 74%, ' + (lumBase + Math.round(pulse * 8)) + '%, ' + a.toFixed(3) + ')'
                ctx.fill()
            }

            ctx.lineWidth = 1
            for (let i = 0; i < orbs.length; i++) {
                for (let j = i + 1; j < orbs.length; j++) {
                    const a = orbs[i]
                    const b = orbs[j]
                    const dx = a.x - b.x
                    const dy = a.y - b.y
                    const d = dx * dx + dy * dy
                    if (d < 14400) {
                        const alpha = (1 - Math.sqrt(d) / 120) * (light ? 0.16 : 0.13) * (0.8 + focus * 0.4)
                        ctx.strokeStyle = 'hsla(' + hue + ', 70%, ' + (light ? 48 : 60) + '%, ' + alpha.toFixed(3) + ')'
                        ctx.beginPath()
                        ctx.moveTo(a.x, a.y)
                        ctx.lineTo(b.x, b.y)
                        ctx.stroke()
                    }
                }
            }

            // 光标跟随光晕
            if (mouse.x > -1000) {
                const mg = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 210)
                mg.addColorStop(0, 'hsla(' + hue + ', 78%, ' + (light ? 45 : 56) + '%, ' + (light ? 0.12 : 0.10) + ')')
                mg.addColorStop(1, 'transparent')
                ctx.fillStyle = mg
                ctx.fillRect(0, 0, w, h)
            }

            // 点击涟漪
            for (let i = rings.length - 1; i >= 0; i--) {
                const r = rings[i]
                r.r += 3.2
                const p = r.r / r.max
                if (p >= 1) {
                    rings.splice(i, 1)
                    continue
                }
                ctx.beginPath()
                ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2)
                ctx.strokeStyle = 'hsla(' + hue + ', 80%, ' + (light ? 48 : 62) + '%, ' + ((1 - p) * (light ? 0.6 : 0.5)).toFixed(3) + ')'
                ctx.lineWidth = 1.6 * (1 - p) + 0.4
                ctx.stroke()
            }

            focus += (focusTarget - focus) * 0.04
            t += 16
            raf = requestAnimationFrame(draw)
        }

        resize()
        window.addEventListener('resize', resize)
        window.addEventListener('mousemove', onMove)
        window.addEventListener('blur', onLeave)
        document.addEventListener('mouseleave', onLeave)
        window.addEventListener('click', onClick)
        document.addEventListener('focusin', onFocusIn)

        if (reduce) {
            // 静态一帧（不启动物理循环）
            focus = 0
            ctx.clearRect(0, 0, w, h)
            const light = document.documentElement.dataset.theme === 'light'
            const hue = light ? 14 : 22
            const lum = light ? 46 : 58
            for (const o of orbs) {
                ctx.beginPath()
                ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2)
                ctx.fillStyle = 'hsla(' + hue + ', 74%, ' + lum + '%, ' + (o.baseA * (light ? 1.15 : 1)).toFixed(3) + ')'
                ctx.fill()
            }
        } else {
            raf = requestAnimationFrame(draw)
        }

        return () => {
            running = false
            cancelAnimationFrame(raf)
            window.removeEventListener('resize', resize)
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('blur', onLeave)
            document.removeEventListener('mouseleave', onLeave)
            window.removeEventListener('click', onClick)
            document.removeEventListener('focusin', onFocusIn)
        }
    }, [])

    return <canvas ref={ref} className={'motion-backdrop' + (className ? ' ' + className : '')} />
}