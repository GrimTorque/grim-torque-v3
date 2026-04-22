/**
 * Async Job Queue for Sora 2 Pro Video Generation
 * Prevents timeouts by executing generation as background tasks
 * Implements parallel polling mechanism to check job status
 */

import { FUNCTIONS } from './api-config'
import { blink } from './blink'

export interface SoraJob {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  prompt: string
  model: string
  videoUrl?: string
  error?: string
  createdAt: number
  completedAt?: number
  // Store params for retry/execution
  params?: any
}

class SoraAsyncQueue {
  private jobs = new Map<string, SoraJob>()
  private queue: string[] = []
  private processing = false
  private maxConcurrent = 5 // Increased concurrency for submissions
  private activeCount = 0
  private subscribers = new Map<string, Set<(job: SoraJob) => void>>()

  /**
   * Add a new job to the queue and return its ID
   */
  async addJob(params: {
    prompt: string
    model: string
    duration: string
    aspect_ratio: string
    resolution: string
    raw: boolean
    image_url?: string
    generate_audio?: boolean
    userId?: string
  }): Promise<string> {
    const jobId = `sora-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    const job: SoraJob = {
      id: jobId,
      status: 'queued',
      prompt: params.prompt,
      model: params.model,
      createdAt: Date.now(),
      params: { ...params, job_id: jobId }
    }
    
    this.jobs.set(jobId, job)
    this.queue.push(jobId)
    
    // Start processing if not already running
    this.processQueue()
    
    return jobId
  }

  /**
   * Wait for a specific job to complete
   */
  async waitForCompletion(jobId: string): Promise<string> {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error('Job not found')

    if (job.status === 'completed' && job.videoUrl) {
      return job.videoUrl
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Job failed')
    }

    return new Promise((resolve, reject) => {
      const unsubscribe = this.subscribe(jobId, (updatedJob) => {
        if (updatedJob.status === 'completed' && updatedJob.videoUrl) {
          unsubscribe()
          resolve(updatedJob.videoUrl)
        } else if (updatedJob.status === 'failed') {
          unsubscribe()
          reject(new Error(updatedJob.error || 'Job failed'))
        }
      })
    })
  }

  /**
   * Subscribe to updates for a specific job
   */
  subscribe(jobId: string, callback: (job: SoraJob) => void): () => void {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set())
    }
    this.subscribers.get(jobId)?.add(callback)
    
    return () => {
      const subs = this.subscribers.get(jobId)
      if (subs) {
        subs.delete(callback)
        if (subs.size === 0) {
          this.subscribers.delete(jobId)
        }
      }
    }
  }

  private notifySubscribers(job: SoraJob) {
    const subs = this.subscribers.get(job.id)
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(job)
        } catch (error) {
          console.error('Subscriber callback error:', error)
        }
      })
    }
  }

  /**
   * Process queue - handle job submissions with concurrency limit
   */
  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const jobId = this.queue.shift()
      if (!jobId) break

      const job = this.jobs.get(jobId)
      if (!job) continue

      this.activeCount++
      
      // Execute job submission (does NOT wait for completion)
      this.executeJobSubmission(job).finally(() => {
        this.activeCount--
        // Trigger next processing cycle
        if (this.queue.length > 0) {
          this.processQueue()
        }
      })
    }

    this.processing = false
  }

  /**
   * Execute job submission to Edge Function
   */
  private async executeJobSubmission(job: SoraJob) {
    try {
      job.status = 'processing'
      this.notifySubscribers(job)

      // Use the SDK invoke method
      const { data, error } = await (blink as any).functions.invoke(FUNCTIONS.generateVideo, {
        body: job.params,
        headers: {
          'X-Async': 'true', // Signal to edge function to return early
        }
      })

      if (error) {
        throw new Error(error.message || `Server error: ${error.status}`)
      }

      const result = data?.data || data
      if (result.error) {
        throw new Error(result.error)
      }

      // Submission successful - start independent polling process
      // This is the "Split Process" - polling runs independently of submission queue
      this.startPolling(job.id)

    } catch (error: any) {
      console.error(`Job ${job.id} submission failed:`, error)
      job.status = 'failed'
      job.error = error?.message || 'Submission failed'
      this.notifySubscribers(job)
    }
  }

  /**
   * Independent polling process for a job
   */
  private async startPolling(jobId: string) {
    const maxWaitTime = 60 * 60 * 1000 // 60 minutes (increased to support high-quality generation)
    const startTime = Date.now()
    // Optimized polling interval: start frequent (10s) to catch fast failures, then settle to 15s to reduce load
    const pollInterval = 10000 
    let consecutiveErrors = 0

    const interval = setInterval(async () => {
      try {
        const job = this.jobs.get(jobId)
        if (!job) {
          clearInterval(interval)
          return
        }

        // Check timeout
        if (Date.now() - startTime > maxWaitTime) {
          clearInterval(interval)
          job.status = 'failed'
          job.error = 'Job timed out. The generation took longer than 60 minutes. Please try again or use a faster model.'
          this.notifySubscribers(job)
          return
        }

        // Poll status
        const { data, error } = await (blink as any).functions.invoke(FUNCTIONS.checkJobStatus, {
          body: { job_id: jobId }
        })

        if (error) {
          consecutiveErrors++
          
          // Handle auth errors immediately
          if (error.status === 401 || error.code === 'AUTH_ERROR' || error.message?.includes('401')) {
            clearInterval(interval)
            job.status = 'failed'
            job.error = 'Authentication expired. Please refresh the page and sign in again.'
            this.notifySubscribers(job)
            return
          }

          // Stop if too many consecutive errors (network/server down)
          if (consecutiveErrors > 20) { // ~3 minutes of continuous failure
             clearInterval(interval)
             job.status = 'failed'
             job.error = 'Connection lost. Unable to check job status.'
             this.notifySubscribers(job)
             return
          }

          // Ignore transient errors, just wait for next poll
          return
        }
        
        // Reset error counter on successful response
        consecutiveErrors = 0

        const result = data?.data || data
        
        if (result.completed) {
          if (result.videoUrl) {
            clearInterval(interval)
            job.status = 'completed'
            job.videoUrl = result.videoUrl
            job.completedAt = Date.now()
            this.notifySubscribers(job)
          } else {
             // Completed but no URL found - stop polling to prevent infinite loop
             clearInterval(interval)
             job.status = 'failed'
             job.error = 'Job completed but no video URL was found in the response.'
             this.notifySubscribers(job)
          }
        } else if (result.failed) {
          clearInterval(interval)
          job.status = 'failed'
          job.error = result.error || 'Job failed'
          this.notifySubscribers(job)
        }
        // If still processing, just continue polling
        
      } catch (error) {
        // Continue polling on error
        console.warn(`Polling error for ${jobId}:`, error)
      }
    }, pollInterval)
  }
}

// Export singleton instance
export const soraQueue = new SoraAsyncQueue()
