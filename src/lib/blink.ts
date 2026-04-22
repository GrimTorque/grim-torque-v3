import { createClient } from '@blinkdotnew/sdk'
import { ENV } from './env'

// Dynamically read from environment variables
const projectId = ENV.VITE_BLINK_PROJECT_ID
const publishableKey = ENV.VITE_BLINK_PUBLISHABLE_KEY

// Use current project credentials
const CURRENT_PROJECT_ID = 'grim-torque-ai-zfan3glq'
const CURRENT_PUBLISHABLE_KEY = 'blnk_pk_NYiqGnqnHQ4kr8uj0LhWDmz3lvufPA4q'

// Create Blink client without auth mode - this app uses custom authentication
// Storage uploads are public add-only and don't require Blink auth
export const blink = createClient({
  projectId: projectId || CURRENT_PROJECT_ID,
  publishableKey: publishableKey || CURRENT_PUBLISHABLE_KEY
})
