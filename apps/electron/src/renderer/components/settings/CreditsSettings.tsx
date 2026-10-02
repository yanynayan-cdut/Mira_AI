/**
 * 额度与用量页面。
 *
 * 所有数值都来自当前登录账号的 Mira Gateway credits 接口，避免显示旧的本地额度账本。
 */
import * as React from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { RefreshCw, Zap, Clock, CreditCard, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SettingsSection, SettingsCard } from './primitives'
import {
  accountUserAtom,
  creditsPointsAtom,
  creditsLifetimeConsumedPointsAtom,
  creditsLoadingAtom,
  creditsLowAtom,
  creditsExhaustedAtom,
  quotaToPoints,
  subscriptionAtom,
  membershipTierAtom,
  subscriptionsAtom,
} from '@/atoms/credits-atoms'
import { useCreditsLoader } from '@/hooks/useCreditsLoader'

const DISPLAY_CREDITS_SCALE = 0.1

function fmtPointsNum(value: number): string {
  return (value * DISPLAY_CREDITS_SCALE).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

/** new-api 时间戳通常为秒，兼容 Gateway 已转换为毫秒的数据。 */
function timestampToMs(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return null
  return value >= 1_000_000_000_000 ? value : value * 1000
}

function formatSubscriptionDate(value: number | undefined): string {
  const timestamp = timestampToMs(value)
  return timestamp === null ? '长期有效' : new Date(timestamp).toLocaleDateString('zh-CN')
}

function subscriptionStatusLabel(status: string | undefined): string {
  switch (status) {
    case 'active': return '生效中'
    case 'expired': return '已到期'
    case 'cancelled': return '已取消'
    case 'pending': return '待生效'
    default: return status || '未知状态'
  }
}

function accountName(user: { display_name?: string; username?: string; email?: string }): string {
  return user.display_name?.trim() || user.username?.trim() || user.email?.trim() || '已登录账号'
}

interface AdaptiveTextLayout {
  fontSize: number
  whiteSpace: 'nowrap' | 'normal'
}

function useAdaptiveGroupText(
  text: string,
  maxSize: number,
  minSize: number,
  widthRatio: number,
  minWidth: number,
): { ref: React.RefObject<HTMLSpanElement>; layout: AdaptiveTextLayout } {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [layout, setLayout] = React.useState<AdaptiveTextLayout>({ fontSize: maxSize, whiteSpace: 'nowrap' })

  React.useLayoutEffect(() => {
    let disposed = false
    const fitText = () => {
      const element = ref.current
      const container = element?.parentElement
      if (!element || !container) return

      const maxWidth = Math.max(minWidth, Math.floor(container.clientWidth * widthRatio))
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) return
      const computed = getComputedStyle(element)
      const fontFamily = computed.fontFamily || 'sans-serif'
      const fontWeight = computed.fontWeight || '400'
      const measure = (fontSize: number) => {
        context.font = `${fontWeight} ${fontSize}px ${fontFamily}`
        return context.measureText(text).width
      }

      let size = maxSize
      while (size > minSize && measure(size) > maxWidth) size -= 1
      const fitsOnOneLine = measure(size) <= maxWidth
      if (!disposed) setLayout({ fontSize: size, whiteSpace: fitsOnOneLine ? 'nowrap' : 'normal' })
    }

    const container = ref.current?.parentElement
    const observer = typeof ResizeObserver === 'undefined' || !container ? null : new ResizeObserver(fitText)
    observer?.observe(container as Element)
    void document.fonts?.ready.then(fitText)
    fitText()
    return () => {
      disposed = true
      observer?.disconnect()
    }
  }, [maxSize, minSize, minWidth, text, widthRatio])

  return { ref, layout }
}

export function CreditsSettings(): React.ReactElement {
  const { reload: reloadCredits } = useCreditsLoader(60_000)
  const points = useAtomValue(creditsPointsAtom)
  const lifetimeConsumedPoints = useAtomValue(creditsLifetimeConsumedPointsAtom)
  const [loading, setLoading] = useAtom(creditsLoadingAtom)
  const isLow = useAtomValue(creditsLowAtom)
  const isExhausted = useAtomValue(creditsExhaustedAtom)
  const accountUser = useAtomValue(accountUserAtom)
  const subscription = useAtomValue(subscriptionAtom)
  const tier = useAtomValue(membershipTierAtom)
  const subscriptions = useAtomValue(subscriptionsAtom)

  const balanceLoaded = accountUser !== null && points !== null
  const totalPoints = balanceLoaded
    ? Math.max(0, points) + Math.max(0, lifetimeConsumedPoints)
    : 0
  const usedPercent = totalPoints > 0
    ? Math.min(100, Math.max(0, Math.round((lifetimeConsumedPoints / totalPoints) * 100)))
    : 0
  const groupName = (accountUser?.group || tier || 'free').trim()
  const currentTierName = groupName
  const watermarkText = groupName.toUpperCase()
  const watermark = useAdaptiveGroupText(watermarkText, 110, 32, 0.58, 1)
  const groupMeta = useAdaptiveGroupText(groupName, 11, 8, 0.42, 1)
  const watermarkColors: Record<string, string> = {
    free: 'text-gray-100 dark:text-gray-800',
    standard: 'text-blue-100 dark:text-blue-950',
    plus: 'text-violet-100 dark:text-violet-950',
    pro: 'text-amber-100 dark:text-amber-950',
  }
  const watermarkColor = watermarkColors[currentTierName.toLowerCase()] || watermarkColors.free

  const handleRefresh = React.useCallback(async () => {
    setLoading(true)
    try {
      await reloadCredits()
    } finally {
      setLoading(false)
    }
  }, [reloadCredits, setLoading])

  return (
    <div className="space-y-8">
      <SettingsSection title="积分概览" description="显示当前登录账号的额度与订阅状态">
        {accountUser ? (
          <>
            <div className="relative overflow-hidden rounded-xl border border-border bg-card px-5 py-4">
              <span
                ref={watermark.ref}
                className={cn(
                  'absolute top-0 right-0 z-0 max-w-[58%] select-none pointer-events-none break-words text-right leading-[0.9]',
                  watermarkColor,
                )}
                style={{
                  fontSize: `${watermark.layout.fontSize}px`,
                  fontFamily: '"Mira Group Display", sans-serif',
                  whiteSpace: watermark.layout.whiteSpace,
                  overflowWrap: 'anywhere',
                  padding: '0.15em 0.25em 0 0',
                }}
              >
                {watermarkText}
              </span>

              <div className="relative z-10">
                <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{accountName(accountUser)}</span>
                  {accountUser.email && accountUser.email !== accountUser.username && <span>· {accountUser.email}</span>}
                  <span>· 会员组</span>
                  <span
                    ref={groupMeta.ref}
                    className="max-w-[42%] break-words leading-tight"
                    style={{
                      fontFamily: '"Mira Group Display", sans-serif',
                      fontSize: `${groupMeta.layout.fontSize}px`,
                      whiteSpace: groupMeta.layout.whiteSpace,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {groupName}
                  </span>
                </div>

                <div className="mb-3">
                  <div className="text-[10px] tracking-wide text-muted-foreground">账户可用额度</div>
                  <div className={cn('text-[34px] font-bold leading-none tracking-tight tabular-nums', isExhausted && 'text-red-500')}>
                    {points === null ? '—' : fmtPointsNum(points)}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">积分</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                  <div>
                    <div className="mb-0.5 text-[10px] text-muted-foreground">累计已用额度</div>
                    <div className="font-semibold tabular-nums">{fmtPointsNum(lifetimeConsumedPoints)} 积分</div>
                  </div>
                  <div>
                    <div className="mb-0.5 text-[10px] text-muted-foreground">账号订阅</div>
                    <div className="flex items-center gap-1.5 font-semibold">
                      {subscription?.hasSubscription ? (subscription.plan || '已订阅') : '免费版'}
                      {subscription?.expiresAt && <Clock size={12} className="text-muted-foreground" />}
                    </div>
                  </div>
                  {subscription?.expiresAt && (
                    <div>
                      <div className="mb-0.5 text-[10px] text-muted-foreground">到期时间</div>
                      <div className="font-semibold tabular-nums">{formatSubscriptionDate(subscription.expiresAt)}</div>
                    </div>
                  )}
                </div>

                {(isExhausted || isLow) && (
                  <div className={cn('mt-3 flex items-center gap-2 text-xs font-medium', isExhausted ? 'text-red-500' : 'text-yellow-600')}>
                    <Zap size={14} />
                    {isExhausted ? '账户额度已用尽' : '账户额度偏低'}
                  </div>
                )}
              </div>
            </div>

            <SettingsCard className="mt-3">
              <div className="space-y-2.5 px-4 py-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">已使用比例</span>
                  <span className="font-semibold tabular-nums">{usedPercent}%</span>
                </div>
                <div className="relative h-2 rounded-full bg-muted">
                  <div
                    className={cn('absolute inset-y-0 left-0 rounded-full transition-all duration-500', isExhausted ? 'bg-destructive' : isLow ? 'bg-yellow-500' : 'bg-primary')}
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
                <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
                  <span>可用 {fmtPointsNum(points ?? 0)} 积分</span>
                  <span>累计已用 {fmtPointsNum(lifetimeConsumedPoints)} 积分</span>
                </div>
              </div>
            </SettingsCard>
          </>
        ) : (
          <SettingsCard>
            <div className="py-5 text-center text-sm text-muted-foreground">
              {loading ? '正在同步账号额度…' : '请先登录团队账号，查看账号额度与订阅信息'}
            </div>
          </SettingsCard>
        )}
      </SettingsSection>

      <SettingsCard>
        <button
          type="button"
          onClick={() => {
            void window.electronAPI.openExternal('https://yanyanyan.vip/wallet').catch(() => {
              toast.error('无法打开额度与订阅管理页面，请稍后重试')
            })
          }}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-surface-selected/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CreditCard size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">管理额度与订阅</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">在浏览器中查看和管理账户额度、订阅</span>
          </span>
          <ExternalLink size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </SettingsCard>

      {accountUser && (
        <SettingsSection title="订阅明细" description="当前登录账号的订阅额度与有效期">
          <SettingsCard divided={false}>
            {subscriptions.length > 0 ? (
              <div className="space-y-2">
                {subscriptions.map((item, index) => {
                  const total = item.quotaTotal ?? 0
                  const used = item.quotaUsed ?? 0
                  const remaining = item.quotaRemaining ?? Math.max(0, total - used)
                  const planName = item.planTitle || (item.plan_id !== undefined ? `Plan ${item.plan_id}` : '未命名套餐')
                  const statusClass = item.status === 'active' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                  return (
                    <div key={item.id ?? `${planName}-${index}`} className="rounded-lg bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{planName}</span>
                        <span className={cn('shrink-0 text-[11px]', statusClass)}>{subscriptionStatusLabel(item.status)}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                        <div>
                          <div className="text-muted-foreground">剩余额度</div>
                          <div className="font-medium tabular-nums">{fmtPointsNum(quotaToPoints(remaining))} 积分</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">订阅额度</div>
                          <div className="font-medium tabular-nums">{fmtPointsNum(quotaToPoints(total))} 积分</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">已用额度</div>
                          <div className="font-medium tabular-nums">{fmtPointsNum(quotaToPoints(used))} 积分</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">结束时间</div>
                          <div className="font-medium tabular-nums">{formatSubscriptionDate(item.end_time)}</div>
                        </div>
                      </div>
                      {item.next_reset_time !== undefined && (
                        <div className="mt-1 text-[11px] text-muted-foreground">下次重置：{formatSubscriptionDate(item.next_reset_time)}</div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-3 text-sm text-muted-foreground">当前账号暂无订阅记录</div>
            )}
          </SettingsCard>
        </SettingsSection>
      )}

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>刷新账号额度</span>
        </Button>
      </div>
    </div>
  )
}
