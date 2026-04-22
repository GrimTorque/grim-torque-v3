/**
 * Credential generation utility for Blink Project ID and Publishable Key
 */

import { getEnv } from './env'

/**
 * Generate a unique Project ID
 * Format: ai-image-video-gener-[random 8 chars]
 * @deprecated Use the current Project ID instead of generating a new one
 */
export function generateProjectId(): string {
  // Return the environment variable if available, otherwise fallback
  return getEnv('VITE_BLINK_PROJECT_ID')
}

/**
 * Generate a Blink Publishable Key
 * Format: blnk_pk_[random 32 chars with alphanumeric and special chars]
 */
export function generatePublishableKey(): string {
  // Return the environment variable if available
  return getEnv('VITE_BLINK_PUBLISHABLE_KEY')
}

/**
 * Save credentials to local storage
 * In a real implementation, this would save to .env.local or a backend service
 */
export function saveCredentialsToStorage(projectId: string, publishableKey: string): void {
  // Store in session/local for immediate use
  sessionStorage.setItem('VITE_BLINK_PROJECT_ID', projectId)
  sessionStorage.setItem('VITE_BLINK_PUBLISHABLE_KEY', publishableKey)

  console.log('Credentials synced:', {
    projectId,
    publishableKey: '***',
    timestamp: new Date().toISOString()
  })
}

/**
 * Sync credentials with environment variables
 * 
 * @param currentProjectId - The current Project ID
 * @returns The current Project ID and Publishable Key from env
 */
export async function generateAndSaveCredentials(currentProjectId: string): Promise<{
  projectId: string
  publishableKey: string
}> {
  // CRITICAL: Always return the environment variables to ensure consistency
  const projectId = getEnv('VITE_BLINK_PROJECT_ID') || currentProjectId
  const publishableKey = getEnv('VITE_BLINK_PUBLISHABLE_KEY')

  saveCredentialsToStorage(projectId, publishableKey)

  return { projectId, publishableKey }
}
