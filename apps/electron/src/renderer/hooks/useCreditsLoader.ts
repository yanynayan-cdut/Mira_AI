/**
 * 额度加载 — 把服务端余额拉进 jotai atoms
 *
 * 统一三处对额度的读取：
 *   - 侧栏余额条（登录后展示 + 定时刷新）
 *   - 额度不足（402）后的即时刷新
 *   - 设置页额度概览
 *
 * 只要已登录 Gateway 即可读取余额。Gateway 的认证/余额模式不等同于
 * 商业代理模式，避免尚未启用 `/v1/proxy/*` 时误判为不可读取。
 */
import * as React from 'react'
import { useAtomValue, useSetAtom, useStore } from 'jotai'
import { authStatusAtom } from '@/atoms/identity-atoms'
import {
  creditsBalanceAtom,
  creditsLifetimeConsumedAtom,
  creditsLoadingAtom,
  creditsBalancePackageAtom,
  creditsBalanceReferralAtom,
  creditsBalancePurchasedAtom,
  creditCycleSummaryAtom,
  membershipTierAtom,
  isVipAtom,
  multiplierAtom,
  inviteCodeAtom,
  subscriptionAtom,
  subscriptionsAtom,
  accountUserAtom,
} from '@/atoms/credits-atoms'

/** jotai store（useStore() / createStore() 的返回类型） */
type JotaiStore = ReturnType<typeof useStore>

/** 拉取一次余额并写入指定 store。供组件外（如全局错误监听）调用。 */
function clearCreditsState(store: JotaiStore): void {
  store.set(creditsBalanceAtom, null)
  store.set(creditsLifetimeConsumedAtom, 0)
  store.set(creditsBalancePackageAtom, 0)
  store.set(creditsBalanceReferralAtom, 0)
  store.set(creditsBalancePurchasedAtom, 0)
  store.set(creditCycleSummaryAtom, null)
  store.set(membershipTierAtom, 'free')
  store.set(isVipAtom, false)
  store.set(multiplierAtom, 1.0)
  store.set(inviteCodeAtom, null)
  store.set(subscriptionAtom, null)
  store.set(subscriptionsAtom, [])
  store.set(accountUserAtom, null)
}

export async function refreshCreditsInto(store: JotaiStore): Promise<void> {
  try {
    const auth = await window.electronAPI.auth.getTeamAuth()
    if (!auth) {
      clearCreditsState(store)
      return
    }
    const resp = await fetch(`${auth.baseUrl}/v1/account/credits`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
    if (!resp.ok) {
      // 认证已失效时不能保留上一个账号的余额或订阅状态；普通服务异常仍保留旧快照。
      if (resp.status === 401 || resp.status === 403) clearCreditsState(store)
      return
    }
    const d = await resp.json()
    // 当前用户本地账本余额：balance 可能为 null（非代管或查询失败）
    store.set(creditsBalanceAtom, d.balance ?? null)
    store.set(creditsLifetimeConsumedAtom, d.lifetimeConsumed ?? 0)
    // 积分分账 + 会员
    store.set(creditsBalancePackageAtom, d.balancePackage ?? 0)
    store.set(creditsBalanceReferralAtom, d.balanceReferral ?? 0)
    store.set(creditsBalancePurchasedAtom, d.balancePurchased ?? 0)
    // 服务端灰度或旧版本未返回时保持 null，界面会明确提示同步中，不能倒退到历史累计分母。
    store.set(creditCycleSummaryAtom, d.cycleSummary ?? null)
    store.set(membershipTierAtom, d.membershipTier ?? 'free')
    store.set(isVipAtom, !!d.isVip)
    store.set(multiplierAtom, d.multiplier ?? 1.0)
    store.set(inviteCodeAtom, d.inviteCode ?? null)
    // 订阅状态：服务端明确返回 null 时必须清除旧账号/已过期订阅的陈旧卡片。
    store.set(subscriptionAtom, d.subscription ?? null)
    // new-api 账户可能同时存在多条订阅；保留完整明细供额度页展示。
    store.set(subscriptionsAtom, Array.isArray(d.subscriptions) ? d.subscriptions : [])
    store.set(accountUserAtom, d.user ?? null)
  } catch {
    /* 静默：余额拉取失败不打扰用户 */
  }
}

/**
 * 在组件中加载并定时刷新余额。
 * @param pollMs 轮询间隔，默认 60s；传 0 关闭轮询
 */
export function useCreditsLoader(pollMs = 60_000): { reload: () => Promise<void> } {
  const store = useStore()
  const setLoading = useSetAtom(creditsLoadingAtom)
  const authStatus = useAtomValue(authStatusAtom)
  // 应用启动时余额组件通常早于登录界面挂载；用账号标识触发登录后的首次加载。
  const authKey = authStatus.isLoggedIn
    ? `${authStatus.teamAccountId ?? ''}:${authStatus.teamEmail ?? ''}`
    : 'logged-out'

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      await refreshCreditsInto(store)
    } finally {
      setLoading(false)
    }
  }, [store, setLoading])

  React.useEffect(() => {
    void reload()
    if (pollMs <= 0) return
    const timer = setInterval(() => { void reload() }, pollMs)
    return () => clearInterval(timer)
  }, [reload, pollMs, authKey])

  return { reload }
}
