export type TabDragMode = 'pending' | 'group' | 'sorting'

export const TAB_DRAG_THRESHOLD = 5

export interface TabDragTransition {
  mode: TabDragMode
  started: Exclude<TabDragMode, 'pending'> | null
}

/**
 * 指针位移足以确定意图后再选择手势；一旦确定，整次拖拽都保持该模式。
 */
export function resolveTabDragMode(input: {
  mode: TabDragMode
  dx: number
  dy: number
}): TabDragMode {
  if (input.mode !== 'pending') return input.mode

  if (Math.abs(input.dx) <= TAB_DRAG_THRESHOLD && Math.abs(input.dy) <= TAB_DRAG_THRESHOLD) {
    return 'pending'
  }

  return Math.abs(input.dy) > Math.abs(input.dx) && input.dy > 0
    ? 'group'
    : 'sorting'
}

export function resolveTabDragTransition(input: {
  mode: TabDragMode
  dx: number
  dy: number
}): TabDragTransition {
  const mode = resolveTabDragMode(input)
  return {
    mode,
    started: input.mode === 'pending' && mode !== 'pending' ? mode : null,
  }
}
