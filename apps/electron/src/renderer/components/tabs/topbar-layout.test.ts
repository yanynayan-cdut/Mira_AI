import { expect, test } from 'bun:test'
import {
  TOPBAR_ACTIONS_EDGE_GAP,
  TOPBAR_CONTENT_HEIGHT,
  TOPBAR_CONTENT_OFFSET,
  TOPBAR_HEIGHT,
  resolveTopBarDragRightInset,
  resolveTopBarTabDragGap,
  resolveNaturalTabLeft,
  resolveTopBarGeometry,
} from './topbar-layout'

test('顶栏内容行保持 40px 外框与 37px 内容行，垂直偏移取整数', () => {
  expect(resolveTopBarGeometry({ brandWidth: 32, actionWidth: 96, availableWidth: 800 })).toEqual({
    frameHeight: 40,
    contentHeight: 37,
    contentOffset: 1,
    bottomGutter: 2,
    tabsViewportWidth: 672,
  })
  // 半像素居中会在 Windows 125%/150%/175% 缩放后变成非整数物理像素
  expect(Number.isInteger(TOPBAR_CONTENT_OFFSET)).toBe(true)
  expect(TOPBAR_CONTENT_OFFSET).toBe(1)
})

test('顶栏垂直几何在常见外框/内容高度组合下始终是整数 CSS px', () => {
  const frames = [20, 32, 36, 40, 44, 48]
  const contents = [0, 24, 31, 32, 36, 37, 40, 56]

  for (const frameHeight of frames) {
    for (const contentHeight of contents) {
      const geometry = resolveTopBarGeometry({
        frameHeight,
        contentHeight,
        brandWidth: 0,
        actionWidth: 0,
        availableWidth: 800,
      })
      expect(Number.isInteger(geometry.contentOffset)).toBe(true)
      expect(Number.isInteger(geometry.bottomGutter)).toBe(true)
      // 偏移 + 内容 + 下边距必须正好等于外框，不允许丢像素或溢出
      expect(geometry.contentOffset + geometry.contentHeight + geometry.bottomGutter).toBe(
        geometry.frameHeight,
      )
      expect(geometry.contentOffset).toBeGreaterThanOrEqual(0)
      expect(geometry.bottomGutter).toBeGreaterThanOrEqual(0)
    }
  }
})

test('操作区宽度只影响 Tab 横向视口，不影响垂直偏移', () => {
  const withoutActions = resolveTopBarGeometry({ brandWidth: 32, actionWidth: 0, availableWidth: 800 })
  const withActions = resolveTopBarGeometry({ brandWidth: 32, actionWidth: 160, availableWidth: 800 })

  expect(withoutActions.contentOffset).toBe(withActions.contentOffset)
  expect(withoutActions.bottomGutter).toBe(withActions.bottomGutter)
  expect(withActions.tabsViewportWidth).toBe(608)
})

test('异常尺寸不会产生负内边距或负视口', () => {
  expect(resolveTopBarGeometry({ frameHeight: 20, contentHeight: 32, brandWidth: 100, actionWidth: 100, availableWidth: 50 })).toEqual({
    frameHeight: 20,
    contentHeight: 20,
    contentOffset: 0,
    bottomGutter: 0,
    tabsViewportWidth: 0,
  })
})

test('拖拽层右边界紧贴操作胶囊左缘，不与其重叠', () => {
  // 操作区实测宽度 + 边缘间距 = 拖拽层必须让开的宽度；胶囊本身定位在 right: 12px
  expect(resolveTopBarDragRightInset(96)).toBe(96 + TOPBAR_ACTIONS_EDGE_GAP)
  expect(resolveTopBarDragRightInset(0)).toBe(TOPBAR_ACTIONS_EDGE_GAP)

  // 无操作区时不能出现负偏移；异常输入（undefined 被调用方兜成 0）也要安全
  expect(resolveTopBarDragRightInset(-10)).toBe(TOPBAR_ACTIONS_EDGE_GAP)

  const barWidth = 1000
  const actionsWidth = 168
  const dragRightEdge = barWidth - resolveTopBarDragRightInset(actionsWidth)
  const actionsLeftEdge = barWidth - TOPBAR_ACTIONS_EDGE_GAP - actionsWidth
  expect(dragRightEdge).toBe(actionsLeftEdge)
})

test('标签行窗口拖动区只覆盖最后一个可见 Tab 与右侧操作区之间的空白', () => {
  const gap = resolveTopBarTabDragGap({
    contentLeft: 40,
    viewportLeft: 40,
    viewportRight: 580,
    lastTabRight: 272,
    actionsLeft: 520,
  })

  expect(gap).toEqual({ left: 233, width: 246 })

  // 两端各留 1px，拖动矩形既不压标签，也不压右侧按钮。
  expect(40 + gap.left).toBe(273)
  expect(40 + gap.left + gap.width).toBe(519)
})

test('无可用空白或标签滚动到右侧时隐藏标签行拖动区', () => {
  expect(resolveTopBarTabDragGap({
    contentLeft: 0,
    viewportLeft: 0,
    viewportRight: 300,
    lastTabRight: 320,
    actionsLeft: 280,
  })).toEqual({ left: 300, width: 0 })

  expect(resolveTopBarTabDragGap({
    contentLeft: 0,
    viewportLeft: 0,
    viewportRight: 300,
    lastTabRight: -20,
    actionsLeft: 280,
  })).toEqual({ left: 1, width: 278 })
})

test('标签自然位置减去偏移父级和横向滚动容器的 scrollLeft', () => {
  expect(resolveNaturalTabLeft({
    offsetParentLeft: 100,
    offsetLeft: 260,
    offsetParentScrollLeft: 8,
    tabScrollLeft: 120,
  })).toBe(232)
})

test('顶栏常量关系保持稳定', () => {
  expect(TOPBAR_HEIGHT).toBeGreaterThan(TOPBAR_CONTENT_HEIGHT)
  expect(TOPBAR_ACTIONS_EDGE_GAP).toBeGreaterThan(0)
})
