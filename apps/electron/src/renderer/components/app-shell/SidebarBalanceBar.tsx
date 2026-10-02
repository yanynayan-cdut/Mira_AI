/**
 * SidebarBalanceBar — 侧栏底部积分条
 *
 * 已订阅账号优先显示订阅额度，否则显示账户余额。
 * 积分只在显示层换算，底层余额和告警判断保持服务端原始值。
 * 随主题变化：正常态用 primary，低积分用琥珀色，耗尽用 destructive。
 * 点击进入「积分与用量」设置页。
 */
import * as React from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { Coins, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import {
  creditsPointsAtom,
  creditCycleSummaryAtom,
  creditsLowAtom,
  creditsExhaustedAtom,
  isInOverdraftAtom,
  balancePackagePointsAtom,
  balanceReferralPointsAtom,
  balancePurchasedPointsAtom,
  quotaToPoints,
  subscriptionAtom,
  subscriptionsAtom,
} from '@/atoms/credits-atoms'
import { useCreditsLoader } from '@/hooks/useCreditsLoader'

interface SidebarBalanceBarProps {
  collapsed?: boolean
}

/** 积分显示（保留 1 位小数） */
function formatPoints(n: number): string {
  const displayValue = n * 0.1
  return displayValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 }) + ' 积分'
}

function formatPointValue(n: number): string {
  return (n * 0.1).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })
}

function timestampToMs(value: number | undefined): number | null {
  if (value === undefined || !Number.isFinite(value) || value <= 0) return null
  return value >= 1_000_000_000_000 ? value : value * 1000
}

function formatDateTime(value: number | undefined): string {
  const timestamp = timestampToMs(value)
  return timestamp === null ? '长期有效' : new Date(timestamp).toLocaleString('zh-CN')
}

function formatRefreshCountdown(value: number | undefined): string | null {
  const timestamp = timestampToMs(value)
  if (timestamp === null || timestamp <= Date.now()) return null
  const totalMinutes = Math.max(1, Math.ceil((timestamp - Date.now()) / 60_000))
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${days}d ${hours}h ${minutes}min 后刷新`
}

export function SidebarBalanceBar({ collapsed = false }: SidebarBalanceBarProps): React.ReactElement | null {
  useCreditsLoader(60_000)

  const points = useAtomValue(creditsPointsAtom)
  const cycleSummary = useAtomValue(creditCycleSummaryAtom)
  const isLow = useAtomValue(creditsLowAtom)
  const isExhausted = useAtomValue(creditsExhaustedAtom)
  const isOverdraft = useAtomValue(isInOverdraftAtom)
  const pkgPts = useAtomValue(balancePackagePointsAtom)
  const refPts = useAtomValue(balanceReferralPointsAtom)
  const purPts = useAtomValue(balancePurchasedPointsAtom)
  const subscription = useAtomValue(subscriptionAtom)
  const subscriptions = useAtomValue(subscriptionsAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)

  const openCredits = (): void => {
    setSettingsTab('credits')
    setSettingsOpen(true)
  }

  const activeSubscription = subscriptions.find((item) => item.status === 'active')
  const hasActiveSubscription = subscription?.hasSubscription === true
    && (subscription.status === undefined || subscription.status === 'active')

  if (hasActiveSubscription) {
    const planName = subscription.plan || activeSubscription?.planTitle || '当前订阅'
    const totalQuota = activeSubscription?.quotaTotal ?? 0
    const remainingQuota = activeSubscription?.quotaRemaining ?? Math.max(0, totalQuota - (activeSubscription?.quotaUsed ?? 0))
    const remainingPercent = totalQuota > 0
      ? Math.min(100, Math.max(0, Math.round((remainingQuota / totalQuota) * 100)))
      : 0
    const expiresAt = subscription.expiresAt ?? activeSubscription?.end_time
    const refreshLabel = formatRefreshCountdown(activeSubscription?.next_reset_time)
    const subscriptionTooltip = [
      refreshLabel,
      `到期时间：${formatDateTime(expiresAt)}`,
    ].filter(Boolean).join('\n')
    const tooltipText = collapsed
      ? `${planName} · ${formatPointValue(quotaToPoints(remainingQuota))} / ${formatPointValue(quotaToPoints(totalQuota))}\n${subscriptionTooltip}`
      : subscriptionTooltip
    const subscriptionTone = 'border-primary/40 bg-primary text-primary-foreground hover:bg-primary/90'

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={openCredits}
              aria-label={`订阅 ${planName}`}
              className={cn(
                'w-full flex items-center justify-center py-2 rounded-[10px] border transition-colors titlebar-no-drag',
                subscriptionTone,
              )}
            >
              <Crown className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[min(320px,calc(100vw-24px))] whitespace-pre-line border border-border/60">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      )
    }

    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={openCredits}
            aria-label={`订阅 ${planName}，剩余 ${formatPointValue(quotaToPoints(remainingQuota))} / ${formatPointValue(quotaToPoints(totalQuota))}`}
            className={cn(
              'w-full flex flex-col gap-1.5 px-3 py-2 rounded-[10px] border transition-colors titlebar-no-drag text-left',
              subscriptionTone,
            )}
          >
            <div className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-medium">
                  <Crown size={11} />
                  订阅
                </span>
                <span className="min-w-0 truncate text-[11px] font-medium">{planName}</span>
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums">
                {formatPointValue(quotaToPoints(remainingQuota))} / {formatPointValue(quotaToPoints(totalQuota))}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-black/15 dark:bg-white/20" aria-label={`周期内剩余 ${remainingPercent}%`}>
              <div className="h-full rounded-full bg-zinc-600 transition-all duration-500 dark:bg-zinc-700" style={{ width: `${remainingPercent}%` }} />
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[min(320px,calc(100vw-24px))] whitespace-pre-line border border-border/60">
          {tooltipText}
        </TooltipContent>
      </Tooltip>
    )
  }

  // 未加载到余额（非代管 / 未登录 / 拉取失败）不显示
  if (points === null) return null

  // 进度条必须与积分页一致，以服务端的当前结算周期分母计算；绝不混入历史累计消耗。
  const cycleTotalPoints = cycleSummary ? Math.round(cycleSummary.totalAllocated * 100) / 10 : null
  const remainingPct = cycleTotalPoints && cycleTotalPoints > 0
    ? Math.max(0, Math.min(100, Math.round((points / cycleTotalPoints) * 100)))
    : 0
  const cycleTooltip = cycleTotalPoints !== null
    ? `本周期: ${formatPoints(points)} / ${formatPoints(cycleTotalPoints)}（${remainingPct}%）`
    : '本周期额度同步中…'

  const tone = isOverdraft
    ? { text: 'text-red-500', bar: 'bg-red-500', track: 'bg-red-500/15', ring: 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10' }
    : isExhausted
      ? { text: 'text-destructive', bar: 'bg-destructive', track: 'bg-destructive/15', ring: 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10' }
      : isLow
        ? { text: 'text-yellow-600 dark:text-yellow-400', bar: 'bg-yellow-500', track: 'bg-yellow-500/15', ring: 'border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10' }
        : { text: 'text-foreground/80', bar: 'bg-primary', track: 'bg-primary/15', ring: 'border-border bg-foreground/[0.02] hover:bg-foreground/[0.05]' }

  const bucketTooltip = `套餐: ${pkgPts} | 返利: ${refPts} | 充值: ${purPts}`

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={openCredits}
        aria-label={`我的积分 ${formatPoints(points)}`}
        title={`我的积分 ${formatPoints(points)}\n${cycleTooltip}\n${bucketTooltip}${isOverdraft ? '\n已透支！' : isExhausted ? '（已耗尽）' : isLow ? '（偏低）' : ''}`}
        className={cn(
          'w-full flex items-center justify-center py-2 rounded-[10px] border transition-colors titlebar-no-drag',
          tone.ring,
        )}
      >
        <Coins className={cn('size-4', tone.text)} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={openCredits}
      aria-label={`我的积分 ${formatPoints(points)}，点击查看`}
      title={`我的积分 ${formatPoints(points)}\n${cycleTooltip}\n${bucketTooltip}${isOverdraft ? '\n已透支！请尽快充值' : ''}`}
      className={cn(
        'w-full flex flex-col gap-1.5 px-3 py-2 rounded-[10px] border transition-colors titlebar-no-drag text-left',
        tone.ring,
      )}
    >
      <div className="flex items-center gap-2">
        <Coins className={cn('size-3.5 shrink-0', tone.text)} />
        <span className="text-[11px] text-foreground/50 flex-1">
          {isOverdraft ? '积分已透支' : isExhausted ? '积分已耗尽' : isLow ? '积分偏低' : '我的积分'}
        </span>
        <span className={cn('text-xs font-semibold tabular-nums', tone.text)}>
          {formatPoints(points)}
        </span>
      </div>
      <div className={cn('h-1 rounded-full overflow-hidden', tone.track)}>
        <div
          className={cn('h-full rounded-full transition-all duration-500', tone.bar)}
          style={{ width: `${cycleTotalPoints === null ? 0 : Math.max(2, remainingPct)}%` }}
        />
      </div>
    </button>
  )
}
