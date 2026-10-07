// Evaluated by Vercel at deployment time, never imported into the browser app.
const backendUrl = process.env.BACKEND_URL
const error = 'Set BACKEND_URL in Vercel to your backend HTTPS origin (for example, https://your-service.onrender.com), without a path, query, or credentials.'
if (!backendUrl) throw new Error(error)
let backend: URL
try {
  backend = new URL(backendUrl)
} catch {
  throw new Error(error)
}
if (
  backend.protocol !== 'https:' ||
  backend.username || backend.password ||
  backend.pathname !== '/' || backend.search || backend.hash ||
  backend.hostname === 'localhost' || backend.hostname === '127.0.0.1' ||
  backend.hostname === '[::1]'
) throw new Error(error)

const backendPaths = ['api', 'accounts', 'static', 'admin']

export const config = {
  framework: 'vite',
  buildCommand: 'npm run build',
  outputDirectory: 'dist',
  rewrites: [
    ...backendPaths.map(path => ({
      source: `/${path}/:path*`,
      destination: `${backend.origin}/${path}/:path*`,
    })),
    { source: '/:path*', destination: '/index.html' },
  ],
  // Keep authenticated data and private photos out of the CDN, even if an
  // upstream response accidentally supplies cacheable headers.
  headers: ['api', 'accounts', 'admin'].map(path => ({
    source: `/${path}/:path*`,
    headers: [
      { key: 'Cache-Control', value: 'private, no-store' },
      { key: 'CDN-Cache-Control', value: 'no-store' },
      { key: 'Vercel-CDN-Cache-Control', value: 'no-store' },
      { key: 'x-vercel-enable-rewrite-caching', value: '0' },
    ],
  })),
}
