import { describe, expect, test } from 'bun:test'
import {
  COMPOSER_RESIZE_DRAG_THRESHOLD_PX,
  COMPOSER_RESIZE_LONG_PRESS_MS,
  COMPOSER_RESIZE_MAX_HEIGHT,
  COMPOSER_RESIZE_MIN_HEIGHT,
  COMPOSER_RESIZE_MIN_LINES,
  clampComposerResizeHeight,
  resolveComposerResizeHeight,
  resolveComposerResizeKeyboardHeight,
  shouldActivateComposerResizeDrag,
} from './composer-resize'

describe('对话栏可调整高度', () => {
  test('最小高度至少容纳三行编辑内容', () => {
    expect(COMPOSER_RESIZE_MIN_LINES).toBe(3)
    expect(COMPOSER_RESIZE_MIN_HEIGHT).toBeGreaterThanOrEqual(3 * 15 * 1.6)
  })

  test('高度取整并限制在最小值和最大值之间', () => {
    expect(clampComposerResizeHeight(80)).toBe(COMPOSER_RESIZE_MIN_HEIGHT)
    expect(clampComposerResizeHeight(220.4)).toBe(220)
    expect(clampComposerResizeHeight(900)).toBe(COMPOSER_RESIZE_MAX_HEIGHT)
    expect(clampComposerResizeHeight(Number.NaN)).toBe(COMPOSER_RESIZE_MIN_HEIGHT)
  })

  test('上边界向上拖动增高，向下拖动缩小', () => {
    expect(resolveComposerResizeHeight(200, -40)).toBe(240)
    expect(resolveComposerResizeHeight(200, 40)).toBe(160)
  })

  test('拖动高度会在三行最小值和最大高度处停止', () => {
    expect(resolveComposerResizeHeight(COMPOSER_RESIZE_MIN_HEIGHT, 50)).toBe(COMPOSER_RESIZE_MIN_HEIGHT)
    expect(resolveComposerResizeHeight(COMPOSER_RESIZE_MAX_HEIGHT, -50)).toBe(COMPOSER_RESIZE_MAX_HEIGHT)
  })

  test('位移阈值或长按时间到达后可激活拖动', () => {
    expect(shouldActivateComposerResizeDrag(COMPOSER_RESIZE_DRAG_THRESHOLD_PX - 1)).toBe(false)
    expect(shouldActivateComposerResizeDrag(COMPOSER_RESIZE_DRAG_THRESHOLD_PX)).toBe(true)
    expect(shouldActivateComposerResizeDrag(-COMPOSER_RESIZE_DRAG_THRESHOLD_PX)).toBe(true)
    expect(shouldActivateComposerResizeDrag(0, COMPOSER_RESIZE_LONG_PRESS_MS - 1)).toBe(false)
    expect(shouldActivateComposerResizeDrag(0, COMPOSER_RESIZE_LONG_PRESS_MS)).toBe(true)
  })

  test('键盘方向键调整高度，Home/End 跳转边界', () => {
    expect(resolveComposerResizeKeyboardHeight(200, 'ArrowUp')).toBe(216)
    expect(resolveComposerResizeKeyboardHeight(200, 'ArrowDown')).toBe(184)
    expect(resolveComposerResizeKeyboardHeight(200, 'Home')).toBe(COMPOSER_RESIZE_MIN_HEIGHT)
    expect(resolveComposerResizeKeyboardHeight(200, 'End')).toBe(COMPOSER_RESIZE_MAX_HEIGHT)
    expect(resolveComposerResizeKeyboardHeight(200, 'Enter')).toBeNull()
  })
})
