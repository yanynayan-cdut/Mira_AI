import { describe, expect, test } from 'bun:test'
import { getUpdateSources, isSecureUpdateFeedUrl, UPDATE_REQUEST_TIMEOUT_MS } from './update-sources'

describe('Mira update source order', () => {
  test('defaults to the Mira GitHub Releases repository', () => {
    expect(getUpdateSources(undefined)).toEqual([{
      id: 'github',
      label: 'GitHub Releases',
      configuration: {
        provider: 'github',
        owner: 'yanynayan-cdut',
        repo: 'Mira_AI',
        releaseType: 'release',
        timeout: UPDATE_REQUEST_TIMEOUT_MS,
      },
    }])
  })

  test('a secure environment feed is tried before GitHub', () => {
    expect(getUpdateSources('https://updates.example.com/mira/').map((source) => source.id))
      .toEqual(['override', 'github'])
    expect(getUpdateSources('https://updates.example.com/mira/')[0]?.configuration)
      .toMatchObject({ provider: 'generic', url: 'https://updates.example.com/mira' })
  })

  test('rejects plain HTTP, literal IPs, credentials, and invalid URLs', () => {
    for (const value of [
      'http://updates.example.com/mira/',
      'https://192.0.2.10/mira/',
      'https://[::1]/mira/',
      'https://user:pass@updates.example.com/mira/',
      'not-a-url',
    ]) {
      expect(isSecureUpdateFeedUrl(value)).toBe(false)
      expect(getUpdateSources(value).map((source) => source.id)).toEqual(['github'])
    }
    expect(isSecureUpdateFeedUrl('https://updates.example.com/mira?channel=stable')).toBe(true)
  })
})
