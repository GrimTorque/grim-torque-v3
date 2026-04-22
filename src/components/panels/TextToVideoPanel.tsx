import { useState, useRef, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Video, Download, Trash2, Copy, Play, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { generateVideoWithRetry } from '@/lib/ai-retry'
import { useAuth } from '@/hooks/use-auth'
import { AuthModal } from '@/components/AuthModal'
import { downloadVideo } from '@/lib/download'
import { FullSizeViewer } from '@/components/FullSizeViewer'
import { useProgress } from '@/hooks/use-progress'
import { getVideoEstimatedTime, getVideoProgressStages, createProgressUpdater } from '@/lib/progress-estimation'
import { getSDKModel, getVideoParams, getSupportedDurations, isDurationValid, getSupportedAspectRatios, VIDEO_MODELS, ASPECT_RATIOS, supportsResolution, RESOLUTION_OPTIONS } from '@/lib/models'

interface GeneratedResult {
  id: string
  videoUrl: string
  prompt: string
  model: string
  duration: string
  aspectRatio: string
  createdAt: Date
  rawMode: boolean
  resolution: string
}

export function TextToVideoPanel() {
  const { isAuthenticated, user, refreshUser } = useAuth()
  const { startProgress, updateProgress, updateFinalizingProgress, completeProgress, resetProgress } = useProgress()
  const previewRef = useRef<HTMLDivElement>(null)
  const abortProgressRef = useRef<(() => void) | null>(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('veo-3.1-fast')
  const [duration, setDuration] = useState('8s')
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [quantity, setQuantity] = useState(1)
  const [useRaw, setUseRaw] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState<string>('')
  const [resolution, setResolution] = useState<'720p' | '1080p'>('720p')
  const [results, setResults] = useState<GeneratedResult[]>([])
  const [previewingVideo, setPreviewingVideo] = useState<string | null>(null) // For modal
  const [activeVideo, setActiveVideo] = useState<string | null>(null) // For preview area

  // Get available duration options for current model
  const durationOptions = useMemo(() => getSupportedDurations(model, 'text'), [model])

  // Reset duration when model changes if current duration is not supported
  useEffect(() => {
    if (!isDurationValid(model, duration, 'text')) {
      const validDurations = getSupportedDurations(model, 'text')
      setDuration(validDurations[0]?.value || '5s')
    }
  }, [duration, model])

  // Cleanup progress updater on unmount
  useEffect(() => {
    return () => {
      if (abortProgressRef.current) {
        abortProgressRef.current()
      }
    }
  }, [])

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    if (!navigator.onLine) {
      toast.error('No internet connection. Please check your network.')
      return
    }

    // Credit check
    const isUnlimited = user?.isAdmin || user?.username === 'Admin'
    if (!isUnlimited && (user?.credits ?? 0) < quantity) {
      toast.error(`Insufficient credits. You need ${quantity} credits for this generation.`)
      return
    }

    setGenerating(true)
    setGenerationStatus('')

    // Start progress tracking
    const estimatedTime = getVideoEstimatedTime(model, duration)
    const progressStages = getVideoProgressStages(estimatedTime, duration)
    startProgress('Initializing video generation...', estimatedTime, {
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
      // Determine model using central utility (text-to-video only)
      const sdkModel = getSDKModel(model, 'video')
      const { duration: mappedDuration, resolution: mappedResolution } = getVideoParams(sdkModel, duration, resolution)
    
      const finalPrompt = prompt
      const params: any = {
        prompt: finalPrompt,
        model: sdkModel,
        resolution: mappedResolution,
        duration: mappedDuration,
        raw: useRaw,
        aspect_ratio: aspectRatio
      }
    
      // Generate multiple videos in parallel (Sora 2 Pro supports parallel processing)
      const generationPromises = []
      
      for (let i = 0; i < quantity; i++) {
        generationPromises.push((async (index) => {
          try {
            setGenerationStatus(`Processing video ${index + 1} of ${quantity}...`)
            
            const { result } = await generateVideoWithRetry(params)
            
            const newResult: GeneratedResult = {
              id: `video-${Date.now()}-${index}`,
              videoUrl: result.video.url,
              prompt,
              model: VIDEO_MODELS.find(m => m.id === model)?.label || 'Veo 3.1 Pro',
              duration,
              aspectRatio,
              createdAt: new Date(),
              rawMode: useRaw,
              resolution: resolution
            }
            
            setResults(prev => [newResult, ...prev])
            if (index === 0) {
              setActiveVideo(result.video.url)
            }
          } catch (error) {
             console.error(`Generation failed for video ${index + 1}`, error)
             // We don't throw here to allow other videos to complete
          }
        })(i))
      }
      
      await Promise.all(generationPromises)
      
      // The logic for updating results and activeVideo is now handled within the promises.
      // We can remove the old sequential result handling.
      
      toast.success(`Video generation completed!`)
      setGenerationStatus('')
      completeProgress()

      // Refresh user to update credit balance
      refreshUser()
    } catch (error: any) {
      setGenerationStatus('')
      resetProgress()
      // Safe error logging to avoid circular reference issues
      console.error('Generation error:', {
        message: error?.message,
        code: error?.code,
        status: error?.status,
        details: error?.details ? 'Present' : 'None'
      })
      
      const errorMessage = error?.message || 'Failed to generate video'
      const isValidationError = errorMessage.includes('422') || errorMessage.includes('Unprocessable Entity')
      const isTimeout = errorMessage.toLowerCase().includes('timeout') || errorMessage.toLowerCase().includes('timed out') || errorMessage.includes('504') || errorMessage.includes('524')
      
      if (isValidationError) {
        toast.error('Invalid parameters. Try a different prompt, duration, or engine.', {
          duration: 6000,
        })
      } else if (isTimeout || errorMessage.includes('Failed to fetch') || errorMessage.includes('Network request failed') || errorMessage.includes('network issue') || errorMessage.includes('persistent network issue')) {
        toast.error('The engine is taking longer than expected. Please wait a few moments or try the "Fast" model if this persists.', {
          duration: 10000,
        })
      } else {
        toast.error(errorMessage)
      }
    } finally {
      setGenerating(false)
      setGenerationStatus('')
      if (abortProgressRef.current) {
        abortProgressRef.current()
        abortProgressRef.current = null
      }
    }
  }

  const handleDownload = (videoUrl: string) => {
    downloadVideo(videoUrl)
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


              <div className="space-y-3">
                <Label htmlFor="model" className="text-sm font-bold tracking-tight">Video Engine</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VIDEO_MODELS.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label} <span className="text-xs text-muted-foreground ml-2">({m.tier})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {model === 'sora-2-pro' && (
                  <p className="text-[10px] text-primary/70 font-medium px-1">
                    Sora 2 Pro supports cinematic 4s and 8s generations. Processing is optimized for high-fidelity output.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="prompt" className="text-sm font-bold tracking-tight">Creative Direction</Label>
                <Textarea
                  id="prompt"
                  placeholder="Describe the cinematic masterpiece you want to bring to life... (No content restrictions)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={5}
                  className="resize-none bg-background/30 rounded-2xl border-border/50 focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="duration" className="text-sm font-bold tracking-tight">Timeline</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {durationOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="aspect" className="text-sm font-bold tracking-tight">Ratio</Label>
                  <Select value={aspectRatio} onValueChange={setAspectRatio}>
                    <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getSupportedAspectRatios(model).map((ratio) => (
                        <SelectItem key={ratio.value} value={ratio.value}>
                          {ratio.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="quantity" className="text-sm font-bold tracking-tight">Quantity</Label>
                  <Select value={quantity.toString()} onValueChange={(val) => setQuantity(parseInt(val))}>
                    <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Video</SelectItem>
                      <SelectItem value="2">2 Videos</SelectItem>
                      <SelectItem value="3">3 Videos</SelectItem>
                      <SelectItem value="4">4 Videos</SelectItem>
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

              {supportsResolution(model) && (
                <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold uppercase tracking-wider text-rose-500">HI-RES MODE</Label>
                    <p className="text-[10px] text-muted-foreground">Toggle 1080p (Higher quality, slower rendering)</p>
                  </div>
                  <Button
                    variant={resolution === '1080p' ? "default" : "outline"}
                    size="sm"
                    onClick={() => setResolution(resolution === '720p' ? '1080p' : '720p')}
                    className={`h-8 rounded-lg text-[10px] font-bold uppercase ${resolution === '1080p' ? 'bg-rose-500 hover:bg-rose-600 border-none' : 'border-rose-500/50 text-rose-500 hover:bg-rose-500/10 bg-transparent'}`}
                  >
                    {resolution === '1080p' ? "1080P" : "720P"}
                  </Button>
                </div>
              )}



              {!isAuthenticated ? (
                <AuthModal
                  trigger={
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-2xl shadow-xl aura-glow transition-all active:scale-95" size="lg">
                      <Video className="mr-2 h-5 w-5" />
                      Sign In to Generate
                    </Button>
                  }
                />
              ) : (
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !prompt.trim()}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-2xl shadow-xl aura-glow transition-all active:scale-95"
                  size="lg"
                >
                  {generating ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      <div className="text-left">
                        <div>Rendering Cinema...</div>
                        {generationStatus && (
                          <div className="text-xs opacity-80 mt-0.5">{generationStatus}</div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <Video className="mr-2 h-5 w-5" />
                      Generate Cinematic Asset
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
                  Cinematic Preview
                </h3>
              </div>

              <div className="flex-1 relative rounded-2xl bg-muted/30 border border-border/50 overflow-hidden flex items-center justify-center" style={{ aspectRatio: aspectRatio.replace(':', '/') }}>
                {activeVideo ? (
                  <video
                    src={activeVideo}
                    key={activeVideo}
                    controls
                    autoPlay
                    loop
                    className="w-full h-full object-contain p-4"
                  />
                ) : (
                  <div className="text-center space-y-4 animate-pulse">
                    <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto aura-glow">
                      <Video className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Awaiting Script</p>
                      <p className="text-xs text-muted-foreground/60">Enter a cinematic description to begin video rendering</p>
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
            <h3 className="text-2xl font-bold tracking-tight">Cinematic Archives</h3>
            <div className="bg-muted px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest">
              {results.length} Reels
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((result) => (
              <Card key={result.id} className="glass-card rounded-2xl overflow-hidden group hover:scale-[1.02] transition-all duration-300">
                <div className="relative bg-muted/30 overflow-hidden flex items-center justify-center" style={{ aspectRatio: result.aspectRatio.replace(':', '/') }}>
                  <video
                    src={result.videoUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    onMouseOver={(e) => e.currentTarget.play()}
                    onMouseOut={(e) => {
                      e.currentTarget.pause()
                      e.currentTarget.currentTime = 0
                    }}
                  />
                  <div className="absolute top-2 left-2 flex gap-1">
                    <div className="bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-2 py-0.5 rounded uppercase tracking-wider border border-white/10">
                      {result.duration}
                    </div>
                    <div className="bg-black/60 backdrop-blur-md text-[10px] font-bold text-white px-2 py-0.5 rounded uppercase tracking-wider border border-white/10">
                      {result.aspectRatio}
                    </div>
                  </div>
                  
                  {/* Action Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setActiveVideo(result.videoUrl)
                        previewRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      className="rounded-xl font-bold h-10 w-10 p-0"
                      title="Show in Preview"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPreviewingVideo(result.videoUrl)}
                      className="rounded-xl font-bold h-10 w-10 p-0"
                      title="View Full Size"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleDownload(result.videoUrl)}
                      className="rounded-xl font-bold h-10 w-10 p-0"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                <div className="p-4 space-y-3">
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{result.model}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 italic leading-relaxed">
                      "{result.prompt}"
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-1.5 py-2">
                    {result.rawMode && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                        RAW MODE
                      </span>
                    )}
                    {result.resolution === '1080p' && (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-rose-500/20 text-rose-500 border border-rose-500/30">
                        HI-RES MODE
                      </span>
                    )}
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

      {/* Video Preview Modal */}
      <FullSizeViewer
        mediaUrl={previewingVideo}
        onClose={() => setPreviewingVideo(null)}
        mediaType="video"
        prompt={results.find(r => r.videoUrl === previewingVideo)?.prompt}
        onDownload={() => downloadVideo(previewingVideo || '')}
      />
    </div>
  )
}