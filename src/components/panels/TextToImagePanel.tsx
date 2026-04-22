import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Sparkles, Download, Trash2, Copy, X, Image as ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import { generateImageWithRetry } from '@/lib/ai-retry'
import { useAuth } from '@/hooks/use-auth'
import { AuthModal } from '@/components/AuthModal'
import { downloadImage } from '@/lib/download'
import { FullSizeViewer } from '@/components/FullSizeViewer'
import { useProgress } from '@/hooks/use-progress'
import { getImageEstimatedTime, getImageProgressStages, createProgressUpdater } from '@/lib/progress-estimation'

import { getSDKModel, IMAGE_MODELS, ASPECT_RATIOS, getAspectRatioSize } from '@/lib/models'

interface GeneratedResult {
  id: string
  imageUrl: string
  prompt: string
  model: string
  aspectRatio: string
  createdAt: Date
}

export function TextToImagePanel() {
  const { isAuthenticated, user, refreshUser } = useAuth()
  const { startProgress, updateProgress, updateFinalizingProgress, completeProgress, resetProgress } = useProgress()
  const previewRef = useRef<HTMLDivElement>(null)
  const abortProgressRef = useRef<(() => void) | null>(null)
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('nano-banana-pro') // Default to Nano Banana Pro for quality
  const [aspectRatio, setAspectRatio] = useState('16:9')
  const [quantity, setQuantity] = useState(1)
  const [useRaw, setUseRaw] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [results, setResults] = useState<GeneratedResult[]>([])
  const [previewingImage, setPreviewingImage] = useState<string | null>(null)

  // Cleanup progress updater on unmount
  useEffect(() => {
    return () => {
      if (abortProgressRef.current) {
        abortProgressRef.current()
      }
    }
  }, [])

  const handleModelChange = (newModel: string) => {
    setModel(newModel)
    const m = IMAGE_MODELS.find(item => item.id === newModel)
    if (m && !m.supportsQuantity && quantity > 1) {
      setQuantity(1)
    }
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt')
      return
    }

    // Credit check
    const isUnlimited = user?.isAdmin || user?.username === 'Admin'
    if (!isUnlimited && (user?.credits ?? 0) <= 0) {
      toast.error('Insufficient credits. Please contact administrator to top up.')
      return
    }

    const currentModel = IMAGE_MODELS.find(m => m.id === model)
    const effectiveQuantity = currentModel?.supportsQuantity ? quantity : 1

    setGenerating(true)
    
    // Start progress tracking
    const estimatedTime = getImageEstimatedTime(model)
    const progressStages = getImageProgressStages(estimatedTime)
    startProgress('Initializing image generation...', estimatedTime, {
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
      const sdkModel = getSDKModel(model, 'image')
      
      const newGeneratedResults: GeneratedResult[] = []
      
      // Image generation parameters
      // The Blink SDK only accepts: prompt, model, n, size, aspect_ratio
      // Advanced features like raw mode can be included in the prompt as instructions
      const generationParams: any = {
        prompt: useRaw && currentModel?.supportsRaw ? `${prompt} --raw` : prompt,
        model: sdkModel,
        n: effectiveQuantity,
        aspect_ratio: aspectRatio
      }

      // Include size as fallback for models that don't support aspect_ratio parameter
      // but all engines should attempt aspect_ratio first
      const fallbackSize = getAspectRatioSize(aspectRatio)
      if (fallbackSize) {
        generationParams.size = fallbackSize
      }

      const { data } = await generateImageWithRetry(generationParams)

      if (data && data.length > 0) {
        data.forEach((result, index) => {
          newGeneratedResults.push({
            id: `image-${Date.now()}-${index}`,
            imageUrl: result.url,
            prompt,
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
        toast.success(`${newGeneratedResults.length} image(s) generated successfully!`)
        completeProgress()
        
        // Refresh user to update credit balance
        refreshUser()
      }
    } catch (error: any) {
      console.error('Generation error:', error)
      resetProgress()
      
      const errorMessage = error?.message || 'Failed to generate image'
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


              <div className="space-y-3">
                <Label htmlFor="model" className="text-sm font-bold tracking-tight">Image Engine</Label>
                <Select value={model} onValueChange={handleModelChange}>
                  <SelectTrigger className="bg-background/30 rounded-xl border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {IMAGE_MODELS.map((m) => (
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

              {IMAGE_MODELS.find(m => m.id === model)?.supportsRaw && (
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
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt" className="text-sm font-bold tracking-tight">Creative Direction</Label>
                </div>
                <Textarea
                  id="prompt"
                  placeholder="Describe the masterpiece you want to bring to life... (No content restrictions)"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="resize-none bg-background/30 rounded-2xl border-border/50 focus:border-primary/50 transition-colors"
                />
                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    No censorship • Unlimited tokens • All features unlocked
                  </p>
                </div>
              </div>

              {!isAuthenticated ? (
                <AuthModal
                  trigger={
                    <Button className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-14 rounded-2xl shadow-xl aura-glow transition-all active:scale-95" size="lg">
                      <Sparkles className="mr-2 h-5 w-5" />
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
                      Synthesizing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-5 w-5" />
                      Generate Masterpiece
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
                      <Sparkles className="h-3 w-3 mr-2" />
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
                      alt="Generated"
                      className="w-full h-full object-contain p-4"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <p className="text-white font-bold uppercase tracking-widest text-sm translate-y-4 group-hover:translate-y-0 transition-transform">
                        High Fidelity Preview
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-4 animate-pulse">
                    <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto aura-glow">
                      <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Awaiting Prompt</p>
                      <p className="text-xs text-muted-foreground/60">Enter a creative description to begin image synthesis</p>
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
                    alt="Generated"
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
                      <Sparkles className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPreviewingImage(result.imageUrl)}
                      className="rounded-xl font-bold h-10 w-10 p-0"
                      title="View Full Size"
                    >
                      <ImageIcon className="h-4 w-4" />
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
                  <div className="flex flex-col">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">{result.model}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 italic leading-relaxed">
                      "{result.prompt}"
                    </p>
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
