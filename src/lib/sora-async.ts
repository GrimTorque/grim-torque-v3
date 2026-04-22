/**
 * Async Sora 2 Pro Handler
 * Optimized for preventing timeouts on Sora 2 Pro requests
 */

import { FUNCTIONS } from './api-config'
import { blink } from './blink'

interface AsyncVideoParams {
  prompt: string
  model: string
  duration: string
  aspect_ratio: string
  image_url?: string
  resolution: string
  generate_audio?: boolean
  raw?: boolean
}

/**
 * Generate video asynchronously for Sora 2 Pro
 * Returns job ID immediately and polls for completion
 */
export async function generateVideoAsync(params: AsyncVideoParams): Promise<string> {
  const jobId = `sora-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const { data, error } = await (blink as any).functions.invoke(FUNCTIONS.generateVideo, {
    body: {
      ...params,
      job_id: jobId,
    },
    headers: {
      'X-Async': 'true', // Signal async mode
    }
  })

  if (error) {
    throw new Error(error.message || `Server error: ${error.status}`)
  }

  const result = data?.data || data
  if (result.error) {
    throw new Error(result.error)
  }

  // Job accepted - return ID immediately
  return jobId
}

/**
 * Poll for video generation completion
 */
export async function pollVideoCompletion(
  jobId: string,
  onProgress?: (status: string) => void,
  maxWaitMs: number = 60 * 60 * 1000 // 60 minutes
): Promise<string> {
  const startTime = Date.now()
  const pollInterval = 5000 // Poll every 5 seconds
  let pollCount = 0
  const maxPolls = Math.floor(maxWaitMs / pollInterval)

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      pollCount++
      const elapsed = Date.now() - startTime

      try {
        // Check timeout
        if (elapsed > maxWaitMs) {
          clearInterval(interval)
          reject(new Error(`Job timeout after ${Math.floor(elapsed / 1000)}s. Sora 2 Pro is highly complex and may take longer during peak times. Please try again.`))
          return
        }

        // Poll status
        const { data: status, error } = await (blink as any).functions.invoke(
          FUNCTIONS.checkJobStatus,
          {
            body: { job_id: jobId },
          }
        )

        if (error) {
          // Status check failed, continue polling
          onProgress?.(`Checking status... (attempt ${pollCount}/${maxPolls})`)
          return
        }

        const data = status.data || status
        if (data.completed && data.videoUrl) {
          clearInterval(interval)
          resolve(data.videoUrl)
        } else if (data.failed) {
          clearInterval(interval)
          reject(new Error(data.error || 'Job failed'))
        } else {
          // Still processing
          const percentEstimate = Math.min(90, (elapsed / maxWaitMs) * 100)
          onProgress?.(
            `Rendering Sora 2 Pro video... (${Math.floor(percentEstimate)}% estimated, ${Math.floor(elapsed / 1000)}s elapsed)`
          )
        }
      } catch (error: any) {
        // Continue polling on error
        console.warn('Polling error (will retry):', error?.message)
        onProgress?.(`Connection retry... (attempt ${pollCount})`)
      }
    }, pollInterval)
  })
}

/**
 * Complete async video generation with progress tracking
 */
export async function generateVideoAsyncWithPolling(
  params: AsyncVideoParams,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.('Initializing Sora 2 Pro engine...')
  const jobId = await generateVideoAsync(params)
  onProgress?.('Job queued, now rendering...')

  const videoUrl = await pollVideoCompletion(jobId, onProgress)
  return videoUrl
}

/*
 * Get project ID from various sources
 */
/* 
function getProjectId(): string {
  // Try to get from localStorage (set by auth context)
  const stored = localStorage.getItem('blink_project_id')
  if (stored) return stored

  // Fallback to getting from document location
  const url = new URL(window.location.href)
  const match = url.hostname.match(/^([a-z0-9-]+)\.sites\.blink\.new$/)
  return match ? match[1] : 'grim-torque-ai-us0veyd9'
}
*/