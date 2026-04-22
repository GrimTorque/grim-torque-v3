// Aspect ratio options
export const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9 (Landscape)', size: '1344x768' },
  { value: '9:16', label: '9:16 (Portrait)', size: '768x1344' },
  { value: '1:1', label: '1:1 (Square)', size: '1024x1024' },
  { value: '4:3', label: '4:3 (Classic)', size: '1152x864' },
  { value: '3:4', label: '3:4 (Portrait)', size: '864x1152' },
  { value: '21:9', label: '21:9 (Ultrawide)', size: '1536x640' },
] as const

export type AspectRatioValue = typeof ASPECT_RATIOS[number]['value']

// Get the best size for a given aspect ratio
export const getAspectRatioSize = (ratio: string): string => {
  const found = ASPECT_RATIOS.find(r => r.value === ratio)
  return found?.size || '1024x1024'
}

// Duration options supported by each video model family
export interface DurationOption {
  value: string
  label: string
}

// Image generation models
export const IMAGE_MODELS = [
  { id: 'nano-banana', label: 'Nano Banana', tier: 'Standard', supportsQuantity: true, supportsRaw: true, supportsBlend: true },
  { id: 'nano-banana-pro', label: 'Nano Banana Pro', tier: 'Premium', supportsQuantity: true, supportsRaw: true, supportsBlend: true },
] as const

// Get models that support blending
export const getBlendSupportedModels = () => IMAGE_MODELS.filter(m => m.supportsBlend)

// Video generation models (Text-to-Video)
export const VIDEO_MODELS = [
  { id: 'veo-3.1-fast', label: 'Veo 3.1 (Fast)', tier: 'Standard', supportsRaw: true },
  { id: 'veo-3.1-pro', label: 'Veo 3.1 Pro', tier: 'Advanced', supportsRaw: true },
  { id: 'kling-2.6', label: 'Kling 2.6', tier: 'Advanced', supportsRaw: true },
  { id: 'sora-2-pro', label: 'Sora 2 Pro', tier: 'Premium', supportsRaw: true },
] as const

// Image-to-Video models (includes models available only for I2V)
export const IMAGE_TO_VIDEO_MODELS = [
  { id: 'veo-3.1-fast', label: 'Veo 3.1 (Fast)', tier: 'Standard', supportsRaw: true },
  { id: 'veo-3.1-pro', label: 'Veo 3.1 Pro', tier: 'Advanced', supportsRaw: true },
  { id: 'kling-2.6', label: 'Kling 2.6', tier: 'Advanced', supportsRaw: true },
] as const

// Get available aspect ratios for a model
export const getSupportedAspectRatios = (uiModelId: string) => {
  const isSora = uiModelId === 'sora-2-pro'
  if (isSora) {
    // Sora 2 Pro only supports these according to skill
    return ASPECT_RATIOS.filter(r => ['16:9', '9:16', '1:1'].includes(r.value))
  }
  return ASPECT_RATIOS
}

export const getSupportedDurations = (uiModelId: string, mode: 'text' | 'image' = 'text'): DurationOption[] => {
  // Model-specific duration mappings
  switch (uiModelId) {
    case 'veo-3.1-fast':
    case 'veo-3.1-pro':
      return [
        { value: '8s', label: '8 seconds' }
      ]
    
    case 'sora-2-pro':
      return [
        { value: '4s', label: '4 seconds' },
        { value: '8s', label: '8 seconds' }
      ]
    
    case 'kling-2.6':
      return [
        { value: '5s', label: '5 seconds' },
        { value: '10s', label: '10 seconds' }
      ]
    
    default:
      return [{ value: '5s', label: '5 seconds' }, { value: '10s', label: '10 seconds' }]
  }
}

// Get the default duration for a model
export const getDefaultDuration = (uiModelId: string, mode: 'text' | 'image' = 'text'): string => {
  const durations = getSupportedDurations(uiModelId, mode)
  // Return the first (default) duration option for the model
  return durations[0]?.value || '8s'
}

// Check if a duration is valid for a model
export const isDurationValid = (uiModelId: string, duration: string, mode: 'text' | 'image' = 'text'): boolean => {
  const supported = getSupportedDurations(uiModelId, mode)
  return supported.some(d => d.value === duration)
}

export const getSDKModel = (uiModelId: string, type: 'image' | 'video' | 'edit' | 'i2v'): string => {
  // Video Models (Text-to-Video)
  if (type === 'video') {
    switch (uiModelId) {
      case 'veo-3.1-fast':
        return 'fal-ai/veo3.1/fast';
      case 'veo-3.1-pro':
        return 'fal-ai/veo3.1';
      case 'kling-2.6':
        return 'fal-ai/kling-video/v2.6/pro/text-to-video';
      case 'sora-2-pro':
        return 'fal-ai/sora-2/text-to-video/pro';
      default:
        return 'fal-ai/veo3.1/fast';
    }
  }

  // Image-to-Video Models
  if (type === 'i2v') {
    switch (uiModelId) {
      case 'veo-3.1-fast':
        return 'fal-ai/veo3.1/fast/image-to-video';
      case 'veo-3.1-pro':
        return 'fal-ai/veo3.1/image-to-video';
      case 'kling-2.6':
        return 'fal-ai/kling-video/v2.6/pro/image-to-video';
      case 'sora-2-pro':
        return 'fal-ai/sora-2/image-to-video/pro';
      default:
        return 'fal-ai/veo3.1/image-to-video';
    }
  }

  // Image Edit Models
  if (type === 'edit') {
    // Route to appropriate edit engine based on model
    switch (uiModelId) {
      case 'nano-banana':
        return 'fal-ai/nano-banana';
      case 'nano-banana-pro':
        return 'fal-ai/nano-banana-pro';
      default:
        return 'fal-ai/nano-banana';
    }
  }

  // Image Generation Models (Text-to-Image)
  switch (uiModelId) {
    case 'nano-banana':
      return 'fal-ai/nano-banana';
    case 'nano-banana-pro':
      return 'fal-ai/nano-banana-pro';
    default:
      return 'fal-ai/nano-banana';
  }
}

// Resolution options for HI-RES MODE
export const RESOLUTION_OPTIONS = [
  { value: '720p', label: '720p (Standard)' },
  { value: '1080p', label: '1080p (High-Res)' },
] as const

export type ResolutionValue = typeof RESOLUTION_OPTIONS[number]['value']

// Check if a model supports resolution setting
export const supportsResolution = (uiModelId: string): boolean => {
  // All current video models support resolution
  return ['veo-3.1-fast', 'veo-3.1-pro', 'kling-2.6', 'sora-2-pro'].includes(uiModelId)
}

export const getVideoParams = (sdkModel: string, uiDuration: string, uiResolution?: string) => {
  // Always use compatible defaults for the SDK
  let duration: string | undefined = uiDuration
  const isSora = sdkModel.includes('sora-2')
  const isVeo = sdkModel.includes('veo')
  const isKling = sdkModel.includes('kling')
  
  // Duration options for models
  if (isVeo) {
    // Veo 3.1 (Fast & Pro) only supports 8s
    duration = '8s'
  } else if (isSora) {
    // Sora 2 Pro supports 4s and 8s
    if (!duration || (duration !== '4s' && duration !== '8s')) {
      duration = '8s'
    }
  } else if (!duration) {
    duration = '5s'
  }
  
  // Resolution handling for all models
  // Default to 720p for stability but allow user override
  let resolution: string = uiResolution || '720p'
  
  // Validate resolution is supported
  if (resolution !== '720p' && resolution !== '1080p') {
    resolution = '720p'
  }
  
  const finalDuration = duration
  
  return {
    duration: finalDuration,
    resolution
  }
}