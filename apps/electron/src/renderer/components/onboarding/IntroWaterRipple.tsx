/** Mira 开场重播：共享品牌动画，保留原 WebGL 水纹和点击跳过。 */
import * as React from 'react'
import { createPortal } from 'react-dom'
import { IntroFluidBackground } from './IntroFluidBackground'
import miraLogo from '@/assets/mira-icon.png'
import { createMiraIntroMarkup, MIRA_INTRO_DURATION_MS, MIRA_INTRO_STYLES } from '../../../shared/mira-intro'

const miraIntroMarkup = createMiraIntroMarkup(miraLogo)

export function IntroWaterRipple({ onDone, durationMs = 5000 }: {
  onDone: () => void
  durationMs?: number
}): React.ReactElement {
  const onDoneRef = React.useRef(onDone)
  const [done, setDone] = React.useState(false)
  onDoneRef.current = onDone

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDone(true), durationMs)
    return () => window.clearTimeout(timer)
  }, [durationMs])

  React.useEffect(() => {
    if (!done) return
    const timer = window.setTimeout(() => onDoneRef.current(), 180)
    return () => window.clearTimeout(timer)
  }, [done])

  // 与冷启动相同的时间线；较短的调用时长按比例压缩，留出结束淡出的时间。
  const animationDuration = Math.min(MIRA_INTRO_DURATION_MS, durationMs * 0.85)
  const animationStyle = { '--mira-intro-duration': `${animationDuration}ms` } as React.CSSProperties

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex cursor-pointer select-none items-center justify-center overflow-hidden bg-black transition-opacity duration-150"
      style={{ opacity: done ? 0 : 1 }}
      onClick={() => setDone(true)}
      role="presentation"
    >
      <IntroFluidBackground durationMs={durationMs} />
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_56%,transparent_48%,rgba(0,0,0,.16)_100%)]" />
      <style>{MIRA_INTRO_STYLES}</style>
      <div style={animationStyle} dangerouslySetInnerHTML={{ __html: miraIntroMarkup }} />
      <span className="absolute bottom-[8%] z-10 font-mono text-[10px] uppercase tracking-[0.32em] text-white/30" aria-hidden="true">
        Click to skip
      </span>
    </div>,
    document.body,
  )
}
