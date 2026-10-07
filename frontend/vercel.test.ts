import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('Vercel deployment configuration', () => {
  it.each([undefined, '', 'http://backend.example.com', 'https://backend.example.com/api', 'https://user:password@backend.example.com', 'https://backend.example.com?token=secret', 'https://localhost'])('rejects invalid backend origin %s', async value => {
    vi.stubEnv('BACKEND_URL', value)
    await expect(import('./vercel')).rejects.toThrow('Set BACKEND_URL in Vercel')
  })

  it('preserves backend paths, keeps SPA fallback last, and disables private caching', async () => {
    vi.stubEnv('BACKEND_URL', 'https://backend.example.com/')
    const { config } = await import('./vercel')
    expect(config.rewrites).toEqual([
      ...['api', 'accounts', 'static', 'admin'].map(path => ({
        source: `/${path}/:path*`, destination: `https://backend.example.com/${path}/:path*`,
      })),
      { source: '/:path*', destination: '/index.html' },
    ])
    for (const path of ['api', 'accounts', 'admin']) {
      expect(config.headers).toContainEqual({
        source: `/${path}/:path*`,
        headers: [
          { key: 'Cache-Control', value: 'private, no-store' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
          { key: 'x-vercel-enable-rewrite-caching', value: '0' },
        ],
      })
    }
  })
})
