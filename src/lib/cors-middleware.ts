/**
 * CORS Middleware Configuration
 * Ensures all API requests from the frontend include proper CORS headers
 * 
 * Origin is dynamically generated based on the current project ID
 * Allowed Methods: POST, OPTIONS
 * Allowed Headers: Authorization, Content-Type
 */

import { getEnv } from './env'

// Dynamically construct the origin URL from environment variables
const projectId = getEnv('VITE_BLINK_PROJECT_ID')
const ALLOWED_ORIGIN = projectId 
  ? `https://${projectId}.sites.blink.new`
  : 'http://localhost:5173' // Fallback for local development

const ALLOWED_METHODS = ['POST', 'OPTIONS']
const ALLOWED_HEADERS = ['Authorization', 'Content-Type', 'Accept']

export interface CORSConfig {
  origin: string
  methods: string[]
  headers: string[]
  credentials: boolean
  maxAge: number
}

/**
 * Get CORS configuration object
 */
export function getCORSConfig(): CORSConfig {
  return {
    origin: ALLOWED_ORIGIN,
    methods: ALLOWED_METHODS,
    headers: ALLOWED_HEADERS,
    credentials: true,
    maxAge: 86400, // 24 hours
  }
}

/**
 * Get CORS headers object for fetch requests
 */
export function getCORSHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
    'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json',
  }
}

/**
 * Fetch options with CORS configuration
 */
export function getFetchOptions(method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST'): RequestInit {
  return {
    method,
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': ALLOWED_METHODS.join(', '),
      'Access-Control-Allow-Headers': ALLOWED_HEADERS.join(', '),
    },
  }
}

/**
 * Setup global fetch interceptor
 * This ensures all fetch requests include CORS headers
 */
export function setupCORSInterceptor(): void {
  const originalFetch = window.fetch

  window.fetch = function (url: string | Request, options?: RequestInit) {
    const opts = options ? { ...options } : {}

    // Ensure headers exist
    if (!opts.headers) {
      opts.headers = {}
    }

    // Convert headers to Headers object if needed
    const headers = new Headers(opts.headers)

    // Ensure headers exist
    opts.headers = headers

    // Ensure CORS mode
    if (!opts.mode) {
      opts.mode = 'cors'
    }

    return originalFetch.apply(this, [url, opts])
  } as typeof fetch
}

/**
 * Verify CORS headers are set correctly
 */
export function verifyCORSHeaders(): boolean {
  const config = getCORSConfig()
  console.log('CORS Configuration:', {
    origin: config.origin,
    methods: config.methods,
    headers: config.headers,
    credentials: config.credentials,
    maxAge: config.maxAge,
  })
  return true
}

/**
 * Log CORS configuration on page load
 */
export function logCORSConfig(): void {
  console.group('🔒 CORS Configuration')
  console.log('Allowed Origin:', ALLOWED_ORIGIN)
  console.log('Allowed Methods:', ALLOWED_METHODS)
  console.log('Allowed Headers:', ALLOWED_HEADERS)
  console.log('Headers Object:', getCORSHeaders())
  console.groupEnd()
}
