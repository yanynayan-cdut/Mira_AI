/** 对话输入栏手动高度调整的纯逻辑。 */

/** 手动调整的最小行数。 */
export const COMPOSER_RESIZE_MIN_LINES = 3
/** RichTextInput 编辑器文字规格：15px × 1.6。 */
export const COMPOSER_RESIZE_LINE_HEIGHT = 15 * 1.6
/** ProseMirror 顶部内边距，见 rich-text-input.tsx 的编辑器样式。 */
export const COMPOSER_RESIZE_EDITOR_PADDING_TOP = 9
/** 当前编辑器没有额外的底部内边距。 */
export const COMPOSER_RESIZE_EDITOR_PADDING_BOTTOM = 0
/** 三行文字加编辑器内边距，保证手动高度不会压到三行以下。 */
export const COMPOSER_RESIZE_MIN_HEIGHT = Math.ceil(
  COMPOSER_RESIZE_MIN_LINES * COMPOSER_RESIZE_LINE_HEIGHT
    + COMPOSER_RESIZE_EDITOR_PADDING_TOP
    + COMPOSER_RESIZE_EDITOR_PADDING_BOTTOM,
)
/** 与输入框既有展开档一致的手动最大高度。 */
export const COMPOSER_RESIZE_MAX_HEIGHT = 500
/** 鼠标移动超过该距离才从按下进入拖动，避免点击边界误改变高度。 */
export const COMPOSER_RESIZE_DRAG_THRESHOLD_PX = 4
/** 短暂按住边界后进入可拖状态；快速拖动仍由位移阈值立即接管。 */
export const COMPOSER_RESIZE_LONG_PRESS_MS = 120
/** 键盘调整的单步高度。 */
export const COMPOSER_RESIZE_KEY_STEP = 16

export interface ComposerResizeBounds {
  minHeight?: number
  maxHeight?: number
}

/** 把高度收敛到合法范围并取整，防止缩放产生半像素高度。 */
export function clampComposerResizeHeight(
  height: number,
  { minHeight = COMPOSER_RESIZE_MIN_HEIGHT, maxHeight = COMPOSER_RESIZE_MAX_HEIGHT }: ComposerResizeBounds = {},
): number {
  const min = Math.max(0, Math.round(minHeight))
  const max = Math.max(min, Math.round(maxHeight))
  if (!Number.isFinite(height)) return min
  return Math.min(max, Math.max(min, Math.round(height)))
}

/** 上边界向上移动时增加输入栏高度，向下移动时缩小输入栏高度。 */
export function resolveComposerResizeHeight(
  startHeight: number,
  deltaY: number,
  bounds: ComposerResizeBounds = {},
): number {
  return clampComposerResizeHeight(startHeight - deltaY, bounds)
}

/** 位移到达阈值后立刻进入拖动，长按计时由手柄事件驱动。 */
export function shouldActivateComposerResizeDrag(deltaY: number, elapsedMs = 0): boolean {
  return Math.abs(deltaY) >= COMPOSER_RESIZE_DRAG_THRESHOLD_PX
    || elapsedMs >= COMPOSER_RESIZE_LONG_PRESS_MS
}

/** 解析无障碍键盘对高度的调整；不支持的按键返回 null。 */
export function resolveComposerResizeKeyboardHeight(
  currentHeight: number,
  key: string,
  bounds: ComposerResizeBounds = {},
): number | null {
  let nextHeight: number | null = null
  if (key === 'ArrowUp') nextHeight = currentHeight + COMPOSER_RESIZE_KEY_STEP
  if (key === 'ArrowDown') nextHeight = currentHeight - COMPOSER_RESIZE_KEY_STEP
  if (key === 'PageUp') nextHeight = currentHeight + COMPOSER_RESIZE_KEY_STEP * 3
  if (key === 'PageDown') nextHeight = currentHeight - COMPOSER_RESIZE_KEY_STEP * 3
  if (key === 'Home') nextHeight = bounds.minHeight ?? COMPOSER_RESIZE_MIN_HEIGHT
  if (key === 'End') nextHeight = bounds.maxHeight ?? COMPOSER_RESIZE_MAX_HEIGHT
  return nextHeight === null ? null : clampComposerResizeHeight(nextHeight, bounds)
}
