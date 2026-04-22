/**
 * Environment variable helper
 * Safely accesses import.meta.env variables
 */

export function getEnv(key: string, fallback = ''): string {
  return (import.meta.env[key as keyof ImportMetaEnv] || fallback) as string
}

export const ENV = {
  get VITE_BLINK_PROJECT_ID() {
    return getEnv('VITE_BLINK_PROJECT_ID', '')
  },
  get VITE_BLINK_PUBLISHABLE_KEY() {
    return getEnv('VITE_BLINK_PUBLISHABLE_KEY', '')
  },
}
