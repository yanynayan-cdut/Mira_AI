import type { BrowserViewState } from '@profer/shared'

export type BrowserSyncSource = 'agent-push' | 'session-restore'

/** 恢复只补齐浏览器标签；自动组合仅属于 Agent 的实时展示动作。 */
export function resolveBrowserTabSyncOptions(
  source: BrowserSyncSource,
  autoOpen: boolean,
  activityId: string | null = null,
  previousActivityId: string | null = null,
  hasPreviousState = false,
): {
  autoOpen: boolean
  autoGroup: boolean
} {
  return {
    autoOpen,
    autoGroup: source === 'agent-push'
      && autoOpen
      && hasPreviousState
      && !!activityId
      && activityId !== previousActivityId,
  }
}

/**
 * 能代表「浏览器工作已经实际开始」的展示型动作。
 *
 * 只读动作（observe / wait / screenshot / dom inspect / script）不会产生新的可见页面，
 * 因此不应改变用户界面；否则模型一次误调用就会把浏览器面板顶出来。
 */
const BROWSER_DISPLAY_ACTIONS: ReadonlySet<string> = new Set(['navigate', 'tab'])

/**
 * 判断一次主进程 BROWSER_STATE_CHANGED 推送是否应自动打开浏览器面板。
 *
 * 两道防线中的第二道：主进程已不再为只读查询广播状态（BrowserListTabs 是无副作用查询），
 * 这里再要求「当前会话确实有 Agent 工作标签」且「最近一次操作是 navigate/tab」，
 * 并只对已建立基线后的新 activity 自动组合，避免重复状态推送重放旧导航后改写用户布局。
 * 切回会话时仍恢复浏览器标签，但不因历史 activity 自动创建组合。
 */
export function shouldAutoOpenBrowserFromPush(
  state: Pick<BrowserViewState, 'agentTabId' | 'tabs' | 'activity'>,
): boolean {
  if (!state.agentTabId) return false
  // 工作标签必须真实存在：会话被销毁但状态晚到时不能打开空白面板。
  if (!state.tabs.some((tab) => tab.tabId === state.agentTabId)) return false
  const action = state.activity?.action
  return action !== undefined && BROWSER_DISPLAY_ACTIONS.has(action)
}
