import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  COMPOSER_RESIZE_LONG_PRESS_MS,
  COMPOSER_RESIZE_MAX_HEIGHT,
  COMPOSER_RESIZE_MIN_HEIGHT,
  clampComposerResizeHeight,
  resolveComposerResizeHeight,
  resolveComposerResizeKeyboardHeight,
  shouldActivateComposerResizeDrag,
} from '@/lib/composer-resize'

interface ResizeSession {
  pointerId: number
  startY: number
  startHeight: number
  lastHeight: number
  active: boolean
  previousCursor: string
  previousUserSelect: string
}

interface ComposerResizeHandleProps {
  /** 当前实际显示高度；未手动调整时传 null，由父级 DOM 测量。 */
  currentHeight: number | null
  /** 父级 DOM 尚未完成布局时的保底高度。 */
  fallbackHeight: number
  minHeight?: number
  maxHeight?: number
  /** 拖动过程中的临时高度，不负责持久化。 */
  onResize: (height: number) => void
  /** 松开鼠标或键盘调整完成后提交高度。 */
  onResizeEnd: (height: number) => void
  className?: string
}

/**
 * 对话输入栏上边界的拖动手柄。
 *
 * 手柄只在发生实际位移后提交拖动，普通点击不会锁定自动高度；短暂按住后也会进入拖动态，
 * 适配用户所说的“停留在上边界时长按调整”。
 */
export function ComposerResizeHandle({
  currentHeight,
  fallbackHeight,
  minHeight = COMPOSER_RESIZE_MIN_HEIGHT,
  maxHeight,
  onResize,
  onResizeEnd,
  className,
}: ComposerResizeHandleProps): React.ReactElement {
  const handleRef = React.useRef<HTMLDivElement>(null)
  const sessionRef = React.useRef<ResizeSession | null>(null)
  const longPressTimerRef = React.useRef<number | null>(null)
  const resolvedMinHeight = minHeight ?? COMPOSER_RESIZE_MIN_HEIGHT
  const resolvedMaxHeight = maxHeight ?? COMPOSER_RESIZE_MAX_HEIGHT

  const clearLongPressTimer = React.useCallback((): void => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }
  }, [])

  const restoreDocumentStyle = React.useCallback((session: ResizeSession): void => {
    document.body.style.cursor = session.previousCursor
    document.body.style.userSelect = session.previousUserSelect
  }, [])

  const activateSession = React.useCallback((session: ResizeSession): void => {
    if (session.active) return
    session.active = true
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [])

  const finishSession = React.useCallback((commit: boolean): void => {
    const session = sessionRef.current
    if (!session) return
    clearLongPressTimer()
    sessionRef.current = null
    restoreDocumentStyle(session)
    if (commit && session.active && session.lastHeight !== session.startHeight) {
      onResizeEnd(session.lastHeight)
    }
  }, [clearLongPressTimer, onResizeEnd, restoreDocumentStyle])

  const handlePointerDown = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0 || sessionRef.current) return
    event.preventDefault()

    const parent = event.currentTarget.parentElement
    const editor = parent?.querySelector<HTMLElement>('[data-profer-rich-text-input]')
    const measuredEditorHeight = editor?.getBoundingClientRect().height
    const measuredHeight = measuredEditorHeight && measuredEditorHeight > 0
      ? measuredEditorHeight
      : currentHeight ?? (parent && parent.getBoundingClientRect().height > 0 ? parent.getBoundingClientRect().height : fallbackHeight)
    const startHeight = clampComposerResizeHeight(measuredHeight, {
      minHeight: resolvedMinHeight,
      maxHeight: resolvedMaxHeight,
    })
    const session: ResizeSession = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight,
      lastHeight: startHeight,
      active: false,
      previousCursor: document.body.style.cursor,
      previousUserSelect: document.body.style.userSelect,
    }
    sessionRef.current = session
    event.currentTarget.setPointerCapture(event.pointerId)
    longPressTimerRef.current = window.setTimeout(() => {
      if (sessionRef.current === session
        && shouldActivateComposerResizeDrag(0, COMPOSER_RESIZE_LONG_PRESS_MS)) {
        activateSession(session)
      }
    }, COMPOSER_RESIZE_LONG_PRESS_MS)
  }, [activateSession, currentHeight, fallbackHeight, resolvedMaxHeight, resolvedMinHeight])

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    const session = sessionRef.current
    if (!session || session.pointerId !== event.pointerId) return

    const deltaY = event.clientY - session.startY
    if (!session.active) {
      if (!shouldActivateComposerResizeDrag(deltaY)) return
      clearLongPressTimer()
      activateSession(session)
    }

    event.preventDefault()
    const nextHeight = resolveComposerResizeHeight(session.startHeight, deltaY, {
      minHeight: resolvedMinHeight,
      maxHeight: resolvedMaxHeight,
    })
    if (nextHeight === session.lastHeight) return
    session.lastHeight = nextHeight
    onResize(nextHeight)
  }, [activateSession, clearLongPressTimer, onResize, resolvedMaxHeight, resolvedMinHeight])

  const handlePointerUp = React.useCallback((event: React.PointerEvent<HTMLDivElement>): void => {
    if (sessionRef.current?.pointerId !== event.pointerId) return
    finishSession(true)
  }, [finishSession])

  const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>): void => {
    const value = clampComposerResizeHeight(currentHeight ?? fallbackHeight, {
      minHeight: resolvedMinHeight,
      maxHeight: resolvedMaxHeight,
    })
    const nextHeight = resolveComposerResizeKeyboardHeight(value, event.key, {
      minHeight: resolvedMinHeight,
      maxHeight: resolvedMaxHeight,
    })
    if (nextHeight === null) return

    event.preventDefault()
    if (nextHeight !== value) onResize(nextHeight)
    onResizeEnd(nextHeight)
  }, [currentHeight, fallbackHeight, onResize, onResizeEnd, resolvedMaxHeight, resolvedMinHeight])

  React.useEffect(() => () => {
    finishSession(true)
  }, [finishSession])

  const value = clampComposerResizeHeight(currentHeight ?? fallbackHeight, {
    minHeight: resolvedMinHeight,
    maxHeight: resolvedMaxHeight,
  })

  return (
    <div
      ref={handleRef}
      role="separator"
      aria-label="调整对话栏高度"
      aria-orientation="horizontal"
      aria-valuemin={resolvedMinHeight}
      aria-valuemax={resolvedMaxHeight}
      aria-valuenow={value}
      tabIndex={0}
      title="调整对话栏高度"
      data-profer-composer-resize-handle
      className={cn(
        'group absolute inset-x-0 top-0 z-20 h-3 cursor-row-resize touch-none select-none titlebar-no-drag focus:outline-none',
        className,
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => finishSession(true)}
      onKeyDown={handleKeyDown}
    >
      <span className="pointer-events-none absolute left-1/2 top-0.5 h-0.5 w-12 -translate-x-1/2 rounded-full bg-border/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-active:opacity-100" />
    </div>
  )
}
