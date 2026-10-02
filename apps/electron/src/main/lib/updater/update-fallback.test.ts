import { describe, expect, test } from 'bun:test'
import { runWithUpdateSourceFallback } from './update-fallback'
import { getUpdateSources } from './update-sources'

describe('更新源回退', () => {
  test('override fails then falls back to Mira GitHub Releases', async () => {
    const attempted: string[] = []
    const result = await runWithUpdateSourceFallback(
      getUpdateSources('https://updates.example.com/mira/'),
      async (source) => {
        attempted.push(source.id)
        if (source.id === 'override') throw new Error('ECONNRESET')
        return source.id
      },
    )

    expect(attempted).toEqual(['override', 'github'])
    expect(result).toBe('github')
  })

  test('aggregates errors only after every configured source fails', async () => {
    await expect(runWithUpdateSourceFallback(
      getUpdateSources(undefined),
      async (source) => { throw new Error(`${source.id} unavailable`) },
    )).rejects.toThrow('GitHub Releases: github unavailable')
  })
})
