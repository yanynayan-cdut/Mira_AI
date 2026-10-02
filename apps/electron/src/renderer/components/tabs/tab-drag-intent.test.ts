import { expect, test } from 'bun:test'
import {
  resolveTabDragTransition,
  resolveTabDragMode,
  TAB_DRAG_THRESHOLD,
  type TabDragMode,
} from './tab-drag-intent'

const pending: TabDragMode = 'pending'

test('拖拽未超过阈值时保持待定', () => {
  expect(resolveTabDragMode({ mode: pending, dx: TAB_DRAG_THRESHOLD, dy: 0 })).toBe('pending')
  expect(resolveTabDragMode({ mode: pending, dx: 0, dy: -TAB_DRAG_THRESHOLD })).toBe('pending')
})

test('首次明确向下移动才进入组合模式', () => {
  expect(resolveTabDragMode({ mode: pending, dx: 2, dy: 6 })).toBe('group')
  expect(resolveTabDragMode({ mode: pending, dx: -4, dy: 8 })).toBe('group')
})

test('横向或向上移动进入排序模式', () => {
  expect(resolveTabDragMode({ mode: pending, dx: 6, dy: 2 })).toBe('sorting')
  expect(resolveTabDragMode({ mode: pending, dx: -8, dy: 7 })).toBe('sorting')
  expect(resolveTabDragMode({ mode: pending, dx: 1, dy: -8 })).toBe('sorting')
})

test('首次横向或向上越过阈值时发起排序交接', () => {
  expect(resolveTabDragTransition({ mode: pending, dx: 6, dy: 2 })).toEqual({
    mode: 'sorting',
    started: 'sorting',
  })
  expect(resolveTabDragTransition({ mode: pending, dx: 1, dy: -8 })).toEqual({
    mode: 'sorting',
    started: 'sorting',
  })
  expect(resolveTabDragTransition({ mode: 'sorting', dx: 40, dy: 0 })).toEqual({
    mode: 'sorting',
    started: null,
  })
})

test('拖拽模式确定后保持不变，横向排序不会升级为组合', () => {
  expect(resolveTabDragMode({ mode: 'sorting', dx: 1, dy: 100 })).toBe('sorting')
  expect(resolveTabDragMode({ mode: 'group', dx: 100, dy: 1 })).toBe('group')
})
