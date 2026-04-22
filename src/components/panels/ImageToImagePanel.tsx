import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import { MultiImageUpload, type UploadedImage } from '@/components/MultiImageUpload'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Loader2, Image as ImageIcon, Download, Trash2, Copy, X, Sparkles, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { modifyImageWithRetry } from '@/lib/ai-retry'
import { getSDKModel, IMAGE_MODELS, ASPECT_RATIOS, getBlendSupportedModels } from '@/lib/models'
import { useAuth } from '@/hooks/use-auth'
import { AuthModal } from '@/components/AuthModal'
import { downloadImage } from '@/lib/download'
import { FullSizeViewer } from '@/components/FullSizeViewer'
import { useProgress } from '@/hooks/use-progress'
import { getImageEstimatedTime, getImageProgressStages, createProgressUpdater } from '@/lib/progress-estimation'

interface TransformResult {
  id: string
  imageUrl: string
  sourceImageUrl: string
  prompt: string
  model: string
  aspectRatio: string
  createdAt: Date
}

export function ImageToImagePanel() {
  const { isAuthenticated, user, refreshUser } = useAuth()
  const { startProgress, updateProgress, updateFinalizingProgress, completeProgress, resetProgress } = useProgress()
  const previewRef = useRef<HTMLDivElement>(null)
  const abortProgressRef = useRef<(() => void) | null>(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('nano-banana-pro') // Default to Nano Banana Pro for quality
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [transformationIntent, setTransformationIntent] = useState<'refine' | 'blend'>('refine')
  const [refineQuality, setRefineQuality] = useState<'4k' | '8k'>('4k')
  const [blendStrength, setBlendStrength] = useState(0.5)
  const [blendMode, setBlendMode] = useState<'fusion' | 'style' | 'subject'>('fusion')
  const [quantity, setQuantity] = useState(1)
  const [useRaw, setUseRaw] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [sourceImages, setSourceImages] = useState<UploadedImage[]>([])
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [selectedPrimaryImageId, setSelectedPrimaryImageId] = useState<string | null>(null)
  const [results, setResults] = useState<TransformResult[]>([])
  const [previewingImage, setPreviewingImage] = useState<string | null>(null)

  // Cleanup progress updater on unmount
  useEffect(() => {
    return () => {
      if (abortProgressRef.current) {
        abortProgressRef.current()
      }
    }
  }, [])

  const handleImagesSelect = (images: UploadedImage[]) => {
    setSourceImages(images)
    
    if (images.length === 0) {
      setSelectedPrimaryImageId(null)
      setGeneratedImage(null)
    } else {
      // If current primary image is no longer in the list, or none selected, pick the first one
      const stillExists = images.some(img => img.id === selectedPrimaryImageId)
      if (!stillExists || !selectedPrimaryImageId) {
        setSelectedPrimaryImageId(images[0].id)
        setGeneratedImage(null)
      }
    }
  }

  const handleGenerate = async () => {
    if (sourceImages.length === 0) {
      toast.error('Please upload at least one source image')
      return
    }
    if (!prompt.trim()) {
      toast.error('Please enter a prompt describing your vision')
      return
    }

    // Credit check
    const isUnlimited = user?.isAdmin || user?.username === 'Admin'
    if (!isUnlimited && (user?.credits ?? 0) < quantity) {
      toast.error(`Insufficient credits. You need ${quantity} credits for this generation.`)
      return
    }

    const currentModel = IMAGE_MODELS.find(m => m.id === model)
    const effectiveQuantity = currentModel?.supportsQuantity ? quantity : 1

    setGenerating(true)
    
    // Start progress tracking
    const estimatedTime = getImageEstimatedTime(model)
    const progressStages = getImageProgressStages(estimatedTime)
    startProgress('Initializing image transformation...', estimatedTime, {
      stageCount: progressStages.length,
    })
    abortProgressRef.current = createProgressUpdater(
      progressStages,
      (percentage, message, stageInfo) => {
        updateProgress(percentage, message, stageInfo)
      },
      completeProgress,
      (finalizingPercentage) => {
        updateFinalizingProgress(finalizingPercentage)
      }
    )

    try {
      const primaryImage = sourceImages.find(img => img.id === selectedPrimaryImageId)
      if (!primaryImage) {
        toast.error('Please select a primary image')
        return
      }

      // Determine which images to process based on intent
      // For blending, ensure the selected primary image is the first one in the array (the "source")
      // Subsequent images act as style/reference/blend inputs
      const imagesToProcess = (transformationIntent === 'blend' && sourceImages.length > 1) 
        ? [
            primaryImage.url, 
            ...sourceImages
              .filter(img => img.id !== selectedPrimaryImageId)
              .map(img => img.url)
          ]
        : [primaryImage.url]

      // Enhanced prompt construction based on user intent
      let finalPrompt = prompt
      
      if (transformationIntent === 'refine') {
        // Refine/upscale mode - focus on enhancement
        finalPrompt = `Upscale and enhance to ${refineQuality} resolution. Keep the exact same composition, subject, and content. Enhance clarity, sharpness, texture, and detail. Make photorealistic. ${prompt}${useRaw ? ' Apply cinematic raw film look.' : ''}`
      } else if (transformationIntent === 'blend' && imagesToProcess.length > 1) {
        // Multi-image blend mode - more structured and explicit prompts
        const strengthPercent = Math.round(blendStrength * 100)
        
        if (blendMode === 'style') {
          // Style transfer: Apply visual style from reference images to the primary image
          finalPrompt = `CRITICAL: The FIRST image (image 1) MUST be the absolute primary anchor and main subject. Your task is to apply the artistic style, colors, lighting, and visual aesthetics from the other reference image(s) to the FIRST image while keeping its subject and composition identical. Blend intensity: ${strengthPercent}%. ${prompt}${useRaw ? ' Apply cinematic raw film look.' : ''}`
        } else if (blendMode === 'subject') {
          // Subject integration: Merge subjects/elements from reference images into primary scene
          finalPrompt = `CRITICAL: The FIRST image (image 1) MUST be the absolute primary anchor and the background scene. Your task is to take the main subjects, objects, or key elements from the other reference image(s) and integrate them naturally into the environment and background provided by the FIRST image. Do not change the background. Match the lighting, perspective, and scale. Blend intensity: ${strengthPercent}%. ${prompt}${useRaw ? ' Apply cinematic raw film look.' : ''}`
        } else {
          // Fusion mode: Balanced creative merge of all images
          finalPrompt = `CRITICAL: The FIRST image (image 1) MUST be the absolute primary anchor and structural foundation (${100 - strengthPercent}% weight). Merge visual elements, composition, subjects, and style from the other images (${strengthPercent}% weight). The final result MUST strictly follow the composition and background of the FIRST image. ${prompt}${useRaw ? ' Apply cinematic raw film look.' : ''}`
        }
      } else if (transformationIntent === 'blend') {
        // Single image creative enhancement
        finalPrompt = `Creatively enhance and transform this image. Add ${Math.round(blendStrength * 100)}% new artistic details while preserving the core subject. ${prompt}${useRaw ? ' Apply cinematic raw film look.' : ''}`
      }

      const newGeneratedResults: TransformResult[] = []
      
      // Get the correct SDK model for editing
      const sdkModel = getSDKModel(model, 'edit')
      
      // Build modification parameters with consistent aspect ratio support
      const modifyParams: any = {
        images: imagesToProcess as string[],
        prompt: finalPrompt,
        model: sdkModel,
        n: effectiveQuantity,
        aspect_ratio: aspectRatio
      }
      
      const { data } = await modifyImageWithRetry(
        modifyParams,
        transformationIntent === 'blend'
      )

      if (data && data.length > 0) {
        data.forEach((result, index) => {
          newGeneratedResults.push({
            id: `transform-${Date.now()}-${index}`,
            imageUrl: result.url,
            sourceImageUrl: primaryImage.url,
            prompt: finalPrompt,
            model: IMAGE_MODELS.find(m => m.id === model)?.label || 'Nano Banana Pro',
            aspectRatio,
            createdAt: new Date()
          })
        })
        
        // Set the first one as the main preview
        setGeneratedImage(data[0].url)
      }

      if (newGeneratedResults.length > 0) {
        setResults([...newGeneratedResults, ...results])
        toast.success(`${newGeneratedResults.length} image(s) transformed successfully!`)
        completeProgress()

        // Refresh user to update credit balance
        refreshUser()
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      resetProgress()
      
      const errorMessage = error?.message || 'Failed to transform image'
      const isValidationError = errorMessage.includes('422') || errorMessage.includes('Unprocessable Entity')
      const isTimeout = errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out') || errorMessage.includes('504') || errorMessage.includes('524')
      
      if (isValidationError) {
        toast.error('Invalid parameters. Try a different prompt, aspect ratio, or engine.', {
          duration: 6000,
        })
      } else if (isTimeout || errorMessage.includes('Failed to fetch') || errorMessage.includes('Network request failed') || errorMessage.includes('network issue') || errorMessage.includes('persistent network issue')) {
        toast.error('The engine is taking longer than expected. Please wait or try a different model.', {
          duration: 10000,
        })
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setGenerating(false)
      if (abortProgressRef.current) {
        abortProgressRef.current()
        abortProgressRef.current = null
      }
    }
  }

  const handleDownload = (imageUrl?: string) => {
    const url = imageUrl || generatedImage
    if (url) {
      downloadImage(url)
    }
  }

  const handleDelete = (id: string) => {
    setResults(results.filter(r => r.id !== id))
    toast.success('Result deleted')
  }

  const handleCopyPrompt = (promptText: string) => {
    navigator.clipboard.writeText(promptText)
    toast.success('Prompt copied to clipboard')
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-primary/10 bg-card/30 backdrop-blur-xl aura-glow rounded-3xl overflow-hidden">
            <CardContent className="p-8 space-y-6">


              <MultiImageUpload
                onImagesSelect={handleImagesSelect}
                maxImages={10}
                disabled={generating}
              />

              {/* Transformation Intent */}
              <div className="space-y-3">
                <Label className="text-sm font-bold tracking-tight">Transformation Intent</Label>
                <div className="grid grid-cols-2 gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`p-2 rounded-xl border-2 text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 ${
                          transformationIntent === 'refine'
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border/50 hover:border-primary/30'
                        }`}
                      >
                        Refine
                        <ChevronDown className="h-3 w-3" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48 bg-card/95 backdrop-blur-xl border-primary/20 rounded-xl">
                      <DropdownMenuItem 
                        onClick={() => {
                          setTransformationIntent('refine')
                          setRefineQuality('4k')
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider p-3 cursor-pointer focus:bg-primary/10 focus:text-primary"
                      >
                        Ultra HD 4K
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          setTransformationIntent('refine')
                          setRefineQuality('8k')
                        }}
                        className="text-[10px] font-bold uppercase tracking-wider p-3 cursor-pointer focus:bg-primary/10 focus:text-primary"
                      >
                        Extreme 8K
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <button
                    onClick={() => {
                      setTransformationIntent('blend')
                      // Auto-switch to a blend-supported model if current model doesn't support blending
                      const blendModels = getBlendSupportedModels()
                      const currentModel = IMAGE_MODELS.find(m => m.id === model)
                      if (!currentModel?.supportsBlend && blendModels.length > 0) {
                        // Default to nano-banana-pro for best blend quality
                        setModel('nano-banana-pro')
                      }
                    }}
                    className={`p-2 rounded-xl border-2 text-[10px] font-bold uppercase tracking-wider transition-all ${
                      transformationIntent === 'blend'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    Blend/Merge
                  </button>
                </div>
              </div>

              {/* Blend Strength Slider */}
              {transformationIntent === 'blend' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-3">
                      <Label className="text-sm font-bold tracking-tight">Blend Strategy</Label>
                      <Select value={blendMode} onValueChange={(val: any) => setBlendMode(val)}>
                        <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fusion">Dynamic Fusion (Balanced)</SelectItem>
                          <SelectItem value="style">Style Transfer (Aesthetic Focus)</SelectItem>
                          <SelectItem value="subject">Subject Merge (Content Focus)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-4 p-4 rounded-2xl bg-primary/5 border border-primary/10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <Label className="text-xs font-bold uppercase tracking-wider">Synthesis Factor</Label>
                        </div>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {Math.round(blendStrength * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[blendStrength]}
                        onValueChange={(vals) => setBlendStrength(vals[0])}
                        min={0.1}
                        max={1.0}
                        step={0.05}
                        className="py-2"
                      />
                      <div className="flex justify-between text-[8px] font-bold text-muted-foreground uppercase tracking-widest">
                        <span>Conservative</span>
                        <span>Balanced</span>
                        <span>Revolutionary</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Refine Quality Indicator */}
              {transformationIntent === 'refine' && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                    Target: {refineQuality === '4k' ? 'Ultra HD 4K' : 'Extreme 8K'}
                  </span>
                </div>
              )}

              {/* Primary Source Image Selection */}
              {sourceImages.length > 0 && (
                <div className="space-y-3 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <div className="h-1 w-1 rounded-full bg-primary" />
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Select Primary Anchor
                    </Label>
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {sourceImages.map((img) => (
                      <button
                        key={img.id}
                        onClick={() => {
                          setSelectedPrimaryImageId(img.id)
                          setGeneratedImage(null)
                        }}
                        className={`relative rounded-xl overflow-hidden border-2 transition-all aspect-square ${
                          selectedPrimaryImageId === img.id
                            ? 'border-primary shadow-[0_0_15px_rgba(168,85,247,0.4)] scale-95'
                            : 'border-transparent opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt="Source"
                          className="w-full h-full object-cover"
                        />
                        {selectedPrimaryImageId === img.id && (
                          <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                            <div className="bg-primary text-white rounded-full p-1">
                              <ImageIcon className="h-3 w-3" />
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <Label htmlFor="model" className="text-sm font-bold tracking-tight">
                  Image Engine
                  {transformationIntent === 'blend' && (
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">(Blend-compatible only)</span>
                  )}
                </Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(transformationIntent === 'blend' ? getBlendSupportedModels() : IMAGE_MODELS).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label} <span className="text-xs text-muted-foreground ml-2">({m.tier})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="aspect" className="text-sm font-bold tracking-tight">Aspect Ratio</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ASPECT_RATIOS.map((ratio) => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="quantity" className="text-sm font-bold tracking-tight">Quantity</Label>
                  <Select 
                    value={quantity.toString()} 
                    onValueChange={(val) => setQuantity(parseInt(val))}
                    disabled={!IMAGE_MODELS.find(m => m.id === model)?.supportsQuantity}
                  >
                    <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Image</SelectItem>
                      <SelectItem value="2">2 Images</SelectItem>
                      <SelectItem value="3">3 Images</SelectItem>
                      <SelectItem value="4">4 Images</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                <div className="space-y-0.5">
                  <Label htmlFor="raw-mode" className="text-xs font-bold uppercase tracking-wider">RAW MODE</Label>
                  <p className="text-[10px] text-muted-foreground">Cinematic, less-processed look</p>
                </div>
                <Button
                  variant={useRaw ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseRaw(!useRaw)}
                  className="h-8 rounded-lg text-[10px] font-bold uppercase"
                >
                  {useRaw ? "Enabled" : "Disabled"}
                </Button>
              </div>

              <div className="space-y-3">
                <Label htmlFor="prompt" className="text-sm font-bold tracking-tight">Creative Direction</Label>
                <Textarea
                  id="prompt"
                  placeholder={
                    sourceImages.length > 1 && transformationIntent === 'blend'
                      ? 'Describe how to blend or merge these assets into a masterpiece...'
                      : sourceImages.length > 0 && transformationIntent === 'refine'
                        ? 'Describe the refinements you want to make to the primary image...'
                        : 'Describe the transformation in detail. Be specific about style, lighting, and mood...'
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="resize-none bg-background/30 rounded-2xl border-border/50 focus:border-primary/50 transition-colors"
                />
              </div>

              {!isAuthenticated ? (
                <AuthModal
                  trigger={
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-2xl shadow-xl aura-glow transition-all active:scale-95" size="lg">
                      <ImageIcon className="mr-2 h-5 w-5" />
                      Sign In to Unlock Power
                    </Button>
                  }
                />
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={generating || (sourceImages.length === 0 || !prompt.trim())}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-2xl shadow-xl aura-glow transition-all active:scale-95"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="mr-2 h-5 w-5" />
                      Transform {sourceImages.length > 1 && transformationIntent === 'blend' ? 'Collection' : 'Asset'}
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Output/Preview */}
        <div className="lg:col-span-7 space-y-6" ref={previewRef}>
          <Card className="border-primary/10 bg-card/30 backdrop-blur-xl rounded-3xl h-full min-h-[500px] flex flex-col aura-glow overflow-hidden">
            <CardContent className="p-8 flex-1 flex flex-col space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  Live Preview
                </h3>
                {generatedImage && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownload()} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
                      <Download className="h-3 w-3 mr-2" />
                      Save Export
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPreviewingImage(generatedImage)} className="rounded-xl font-bold uppercase tracking-widest text-[10px]">
                      <ImageIcon className="h-3 w-3 mr-2" />
                      Full Screen
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex-1 relative rounded-2xl bg-muted/30 border border-border/50 overflow-hidden flex items-center justify-center" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                {generatedImage ? (
                  <div className="absolute inset-0 group">
                    <img
                      src={generatedImage}
                      alt="Transformed"
                      className="w-full h-full object-contain p-4"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <p className="text-white font-bold uppercase tracking-widest text-sm translate-y-4 group-hover:translate-y-0 transition-transform">
                        High Fidelity Preview
                      </p>
                    </div>
                  </div>
                ) : selectedPrimaryImageId ? (
                  <div className="absolute inset-0 animate-fade-in">
                    <img
                      src={sourceImages.find(img => img.id === selectedPrimaryImageId)?.url}
                      alt="Primary Anchor"
                      className="w-full h-full object-cover opacity-20 blur-md grayscale scale-110"
                    />
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 bg-background/40 backdrop-blur-[2px]">
                      <div className="relative">
                        <div className="h-24 w-24 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center aura-glow">
                          <ImageIcon className="h-10 w-10 text-primary" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-primary text-white rounded-full p-2 shadow-lg animate-bounce">
                          <Sparkles className="h-4 w-4" />
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-lg font-bold text-foreground uppercase tracking-widest">Awaiting Synthesis</p>
                        <p className="text-xs text-muted-foreground/80 max-w-[250px] mx-auto leading-relaxed">
                          The selected anchor asset is ready for transformation. Describe your vision to begin the process.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 animate-pulse">
                    <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto aura-glow">
                      <ImageIcon className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Awaiting Input</p>
                      <p className="text-xs text-muted-foreground/60">Configure settings and prompt to begin synthesis</p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Gallery */}
      {results.length > 0 && (
        <div className="space-y-6 pt-12">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold tracking-tight">Generation History</h3>
            <div className="bg-muted px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              {results.length} Creations
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((result) => (
              <Card key={result.id} className="glass-card rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                <div className="relative bg-muted/30 overflow-hidden flex items-center justify-center" style={{ aspectRatio: result.aspectRatio.replace(':', '/') }}>
                  <img
                    src={result.imageUrl}
                    alt="Transformed"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-2 py-0.5 rounded uppercase tracking-wider border border-white/10">
                    {result.aspectRatio}
                  </div>
                  
                  {/* Action Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setGeneratedImage(result.imageUrl)
                        previewRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="rounded-xl font-bold h-10 w-10 p-0"
                      title="Show in Preview"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPreviewingImage(result.imageUrl)}
                      className="rounded-xl font-bold h-10 w-10 p-0"
                      title="View Full Size"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(result.imageUrl)}
                      className="rounded-xl font-bold h-10 w-10 p-0"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={result.sourceImageUrl}
                      alt="Source"
                      className="h-10 w-10 rounded-lg object-cover border border-border/50 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{result.model}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 italic leading-relaxed">
                        "{result.prompt}"
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase">
                      {new Date(result.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCopyPrompt(result.prompt)}
                        className="h-7 w-7 p-0 rounded-lg hover:bg-primary/10 hover:text-primary"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(result.id)}
                        className="h-7 w-7 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      <FullSizeViewer
        mediaUrl={previewingImage}
        onClose={() => setPreviewingImage(null)}
        mediaType="image"
        prompt={results.find(r => r.imageUrl === previewingImage)?.prompt}
        onDownload={() => handleDownload(previewingImage || '')}
      />
    </div>
  )
}
