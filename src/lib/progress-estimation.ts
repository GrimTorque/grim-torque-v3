/**
 * Progress estimation utilities for different AI models
 * Provides estimated processing times and progress tracking strategies
 */

export interface ProgressConfig {
  estimatedTime: number // ms
  stages: ProgressStage[]
}

export interface ProgressStage {
  name: string
  percentage: number
  duration: number // ms
}

// Image generation time estimates (in milliseconds)
const IMAGE_TIME_ESTIMATES: Record<string, number> = {
  'nano-banana-pro': 15000,
  'nano-banana': 20000,
  'dreamshaper': 25000,
  'juggernaut-xl': 30000,
  'absolute-reality': 25000,
  'deliberate': 20000,
  'protovision-xl': 30000,
  'epicrealism': 25000,
  'ultra': 45000,
  'dall-e-3': 45000,
  'dall-e-3-hd': 60000,
  'gpt-4-vision': 30000,
  'claude-vision': 25000,
  'gemini-pro-vision': 30000,
}

// Video generation time estimates (in milliseconds)
const VIDEO_TIME_ESTIMATES: Record<string, Record<string, number>> = {
  'veo-3.1-fast': {
    '5s': 60000,
    '8s': 90000,
    '10s': 120000,
  },
  'veo-3.1-pro': {
    '5s': 90000,
    '8s': 120000,
    '10s': 180000,
  },
  'sora-2-pro': {
    '4s': 450000,
    '8s': 720000,
  },
  'kling-2.6': {
    '5s': 90000,
    '10s': 150000,
  },
  'minimax-video-01': {
    '5s': 90000,
    '8s': 120000,
  },
  'luma-photorealistic': {
    '5s': 90000,
    '8s': 120000,
  },
}

/**
 * Get estimated time for image generation based on model
 */
export function getImageEstimatedTime(model: string): number {
  // Check for exact match first
  if (IMAGE_TIME_ESTIMATES[model]) {
    return IMAGE_TIME_ESTIMATES[model]
  }

  // Check for partial matches (e.g., 'ultra' in model name)
  for (const [key, value] of Object.entries(IMAGE_TIME_ESTIMATES)) {
    if (model.toLowerCase().includes(key.toLowerCase())) {
      return value
    }
  }

  // Default fallback
  return 60000 // 60 seconds (increased from 12s)
}

/**
 * Get estimated time for video generation based on model and duration
 */
export function getVideoEstimatedTime(model: string, duration: string = '8s'): number {
  // Check for exact match
  const modelEstimates = VIDEO_TIME_ESTIMATES[model]
  if (modelEstimates && modelEstimates[duration]) {
    return modelEstimates[duration]
  }

  // Check for partial matches
  for (const [key, estimates] of Object.entries(VIDEO_TIME_ESTIMATES)) {
    if (model.toLowerCase().includes(key.toLowerCase())) {
      return estimates[duration] || estimates['8s'] || 120000
    }
  }

  // Default fallback based on duration
  if (duration.includes('4s') || duration.includes('5s')) {
    return 120000 // 2 minutes
  } else if (duration.includes('10s')) {
    return 300000 // 5 minutes
  }
  return 180000 // Default 180 seconds for 8s (3 minutes)
}

/**
 * Generate progress stages for image generation
 */
export function getImageProgressStages(estimatedTime: number): ProgressStage[] {
  const stages: ProgressStage[] = [
    {
      name: 'Initializing',
      percentage: 0,
      duration: Math.max(1000, estimatedTime * 0.05),
    },
    {
      name: 'Processing prompt',
      percentage: 10,
      duration: Math.max(1000, estimatedTime * 0.1),
    },
    {
      name: 'Generating image',
      percentage: 25,
      duration: Math.max(2000, estimatedTime * 0.6),
    },
    {
      name: 'Refining details',
      percentage: 75,
      duration: Math.max(1000, estimatedTime * 0.15),
    },
    {
      name: 'Finalizing',
      percentage: 95,
      duration: Math.max(500, estimatedTime * 0.1),
    },
  ]

  return stages
}

/**
 * Generate progress stages for video generation
 */
export function getVideoProgressStages(estimatedTime: number, duration: string = '8s'): ProgressStage[] {
  const stages: ProgressStage[] = [
    {
      name: 'Initializing',
      percentage: 0,
      duration: Math.max(1500, estimatedTime * 0.05),
    },
    {
      name: 'Processing prompt',
      percentage: 5,
      duration: Math.max(1500, estimatedTime * 0.08),
    },
    {
      name: 'Setting up renderer',
      percentage: 15,
      duration: Math.max(2000, estimatedTime * 0.1),
    },
    {
      name: 'Rendering frames',
      percentage: 30,
      duration: Math.max(3000, estimatedTime * 0.55),
    },
    {
      name: 'Encoding video',
      percentage: 80,
      duration: Math.max(2000, estimatedTime * 0.15),
    },
    {
      name: 'Finalizing',
      percentage: 95,
      duration: Math.max(1000, estimatedTime * 0.07),
    },
  ]

  return stages
}

/**
 * Progressive progress updater - moves through stages smoothly with real-time percentage tracking
 */
export function createProgressUpdater(
  stages: ProgressStage[],
  onProgress: (percentage: number, message: string, stageInfo?: { stageIndex: number; currentStage: string; stageCount: number; stageProgress: number }) => void,
  onComplete: () => void,
  onFinalizingProgress?: (percentage: number) => void
): () => void {
  let aborted = false
  const updateIntervalMs = 100 // Update every 100ms for smooth transitions
  let finalizingTimeoutId: ReturnType<typeof setTimeout> | null = null

  const updateThroughStages = async () => {
    for (let i = 0; i < stages.length && !aborted; i++) {
      const stage = stages[i]
      const nextStage = stages[i + 1]
      const startPercentage = stage.percentage
      const endPercentage = nextStage?.percentage || 100

      const isFinalizing = stage.name === 'Finalizing'

      if (isFinalizing) {
        // Special handling for Finalizing stage to ensure continuous progress
        // This addresses the "stuck at 99%" or "instant jump" issues
        let elapsed = 0
        const duration = stage.duration
        // Maximum time to run finalizing loop (5 minutes max to prevent infinite loop)
        const maxFinalizingTime = 300000
        
        while (!aborted && elapsed < maxFinalizingTime) {
          elapsed += updateIntervalMs
          
          let finalizingPct = 0
          if (elapsed <= duration) {
            // Linear progression up to 90% over the estimated duration
            finalizingPct = Math.min(90, (elapsed / duration) * 90)
          } else {
            // Asymptotic progression from 90% to 99%
            // This ensures it keeps moving but never quite hits 100% until completion
            // Uses a decay constant of 10s for the "overtime" period
            finalizingPct = 90 + (9 * (1 - Math.exp(-(elapsed - duration) / 10000)))
          }
          
          // Ensure it's at least 1% and max 99%
          finalizingPct = Math.max(1, Math.min(finalizingPct, 99))
          
          if (onFinalizingProgress) {
            onFinalizingProgress(finalizingPct)
          }

          // Update overall progress
          // Map finalizing progress (0-100) to the remaining overall percentage (startPercentage -> 99)
          const overallPct = Math.min(
             startPercentage + (finalizingPct / 100) * (99 - startPercentage), 
             99
          )
          
          onProgress(overallPct, stage.name, {
            stageIndex: i,
            currentStage: stage.name,
            stageCount: stages.length,
            stageProgress: Math.round(finalizingPct)
          })

          // Use setTimeout-based delay that can be interrupted
          await new Promise<void>((resolve) => {
            finalizingTimeoutId = setTimeout(() => {
              finalizingTimeoutId = null
              resolve()
            }, updateIntervalMs)
          })
        }
      } else {
        // Standard linear progression for non-finalizing stages
        // Calculate total updates for this stage
        const stageUpdates = Math.ceil(stage.duration / updateIntervalMs)
        const percentagePerUpdate = (endPercentage - startPercentage) / stageUpdates

        for (let updateStep = 0; updateStep < stageUpdates && !aborted; updateStep++) {
          // Calculate smooth progress for this step
          const currentStageProgress = Math.round((updateStep / stageUpdates) * 100)
          const currentPercentage = Math.round(
            startPercentage + percentagePerUpdate * updateStep
          )

          // Ensure we don't exceed the next stage's percentage
          const clamped = Math.min(currentPercentage, endPercentage - 1)

          onProgress(clamped, stage.name, {
            stageIndex: i,
            currentStage: stage.name,
            stageCount: stages.length,
            stageProgress: currentStageProgress
          })

          // Wait for the next update interval
          await new Promise((resolve) => setTimeout(resolve, updateIntervalMs))
        }
  
        // Ensure we hit the end percentage of this stage
        if (!aborted) {
          // Cap global progress at 99%
          const finalPercentage = Math.min(endPercentage - 1, 99)
          
          onProgress(finalPercentage, stage.name, {
            stageIndex: i,
            currentStage: stage.name,
            stageCount: stages.length,
            stageProgress: 100
          })
        }
      }
    }

    // Don't auto-complete - wait for manual completion from generation logic
    // This ensures we only reach 100% when generation is actually complete
  }

  // Start the update process
  updateThroughStages().catch((error) => {
    if (!aborted) {
      console.error('Progress update error:', error)
    }
  })

  // Return abort function
  return () => {
    aborted = true
    // Clear any pending timeout to stop the loop immediately
    if (finalizingTimeoutId !== null) {
      clearTimeout(finalizingTimeoutId)
      finalizingTimeoutId = null
    }
  }
}
