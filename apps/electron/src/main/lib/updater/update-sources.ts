import type { AppUpdater } from 'electron-updater'

type UpdateFeedConfiguration = Exclude<Parameters<AppUpdater['setFeedURL']>[0], string>

export interface UpdateSource {
  id: 'override' | 'github'
  label: string
  configuration: UpdateFeedConfiguration
}

export const UPDATE_REQUEST_TIMEOUT_MS = 30_000

const GITHUB_UPDATE_SOURCE: UpdateSource = {
  id: 'github',
  label: 'GitHub Releases',
  configuration: {
    provider: 'github',
    owner: 'yanynayan-cdut',
    repo: 'Mira_AI',
    releaseType: 'release',
    timeout: UPDATE_REQUEST_TIMEOUT_MS,
  },
}

function normalizeFeedUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/** Accept HTTPS hostnames only; reject credentials, plain HTTP, and literal IP addresses. */
export function isSecureUpdateFeedUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.hostname.includes('.') &&
      !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(url.hostname) &&
      !/^\[[0-9a-f:]+\]$/i.test(url.hostname)
  } catch {
    return false
  }
}

/** GitHub Releases is the default; a secure environment override is tried first. */
export function getUpdateSources(overrideUrl = process.env.PROFER_UPDATE_FEED_URL): UpdateSource[] {
  const sources: UpdateSource[] = []

  if (overrideUrl && !isSecureUpdateFeedUrl(overrideUrl)) {
    console.warn('[更新] 忽略不安全的 PROFER_UPDATE_FEED_URL，仅允许 HTTPS 域名')
  }

  if (isSecureUpdateFeedUrl(overrideUrl)) {
    sources.push({
      id: 'override',
      label: '环境变量更新源',
      configuration: {
        provider: 'generic',
        url: normalizeFeedUrl(overrideUrl),
        timeout: UPDATE_REQUEST_TIMEOUT_MS,
      },
    })
  }

  sources.push(GITHUB_UPDATE_SOURCE)
  return sources
}
