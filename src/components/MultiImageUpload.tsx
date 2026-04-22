import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Upload, X, Loader2 } from 'lucide-react'
import { blink } from '@/lib/blink'
import { toast } from 'sonner'
import { useAuth } from '@/hooks/use-auth'
import { AuthModal } from '@/components/AuthModal'

export interface UploadedImage {
  id: string
  url: string
  file: File
  timestamp: number
}

interface MultiImageUploadProps {
  onImagesSelect: (images: UploadedImage[]) => void
  maxImages?: number
  acceptedFormats?: string
  disabled?: boolean
  className?: string
}

export function MultiImageUpload({
  onImagesSelect,
  maxImages = 10,
  acceptedFormats = 'image/*',
  disabled = false,
  className = ''
}: MultiImageUploadProps) {
  const { isAuthenticated } = useAuth()
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper for upload with retry
  const uploadWithRetry = async (file: File, attempt = 1, maxAttempts = 3): Promise<string> => {
    try {
      // Use a consistent, safe extension
      const originalExtension = file.name.split('.').pop()?.toLowerCase() || 'png'
      const safeExtension = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic'].includes(originalExtension)
        ? originalExtension
        : 'png'

      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substring(2, 9)

      // Create a completely safe filename for the storage path
      // This avoids any header issues with special characters in filenames
      const safePath = `images/${timestamp}-${randomId}.${safeExtension}`

      // Create a clean File object with a very simple name for the upload
      // Some browsers/servers struggle with non-ASCII characters in FormData headers
      const simpleName = `upload-${timestamp}.${safeExtension}`
      const cleanFile = new File([file], simpleName, { type: file.type })

      const { publicUrl } = await blink.storage.upload(cleanFile, safePath)
      return publicUrl
    } catch (error) {
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s...
        const delay = Math.pow(2, attempt - 1) * 1000
        console.warn(`Upload failed for ${file.name}, retrying in ${delay}ms... (Attempt ${attempt}/${maxAttempts})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return uploadWithRetry(file, attempt + 1, maxAttempts)
      }
      throw error
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    // Check if adding new files would exceed limit
    if (uploadedImages.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed. Currently have ${uploadedImages.length}.`)
      return
    }

    setUploading(true)
    const newImages: UploadedImage[] = []
    const errors: string[] = []

    try {
      const uploadPromises = files.map(async (file) => {
        try {
          const publicUrl = await uploadWithRetry(file)

          return {
            status: 'fulfilled' as const,
            value: {
              id: `img-${Date.now()}-${Math.random()}`,
              url: publicUrl,
              file,
              timestamp: Date.now()
            }
          }
        } catch (error) {
          console.error('Upload error for file:', file.name, error)
          return {
            status: 'rejected' as const,
            reason: error
          }
        }
      })

      const results = await Promise.all(uploadPromises)

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          newImages.push(result.value)
        } else {
          errors.push('Failed to upload a file')
        }
      })

      if (newImages.length > 0) {
        const updatedImages = [...uploadedImages, ...newImages]
        setUploadedImages(updatedImages)
        onImagesSelect(updatedImages)
        toast.success(`${newImages.length} image(s) uploaded successfully`)
      }

      if (errors.length > 0) {
        toast.error(`${errors.length} image(s) failed to upload. Please check your connection and try again.`)
      }
    } catch (error) {
      console.error('Upload batch error:', error)
      toast.error('Failed to upload images')
    } finally {
      setUploading(false)
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const removeImage = (id: string) => {
    const updated = uploadedImages.filter(img => img.id !== id)
    setUploadedImages(updated)
    onImagesSelect(updated)
  }

  const canAddMore = uploadedImages.length < maxImages

  const uploadButton = (
    <Button
      variant="outline"
      onClick={isAuthenticated ? () => fileInputRef.current?.click() : undefined}
      disabled={disabled || uploading || !canAddMore}
      className="w-full h-32 border-dashed border-2 bg-background/30 hover:bg-accent/5 hover:border-primary/50 transition-all group rounded-2xl"
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div className="absolute inset-0 blur-lg bg-primary/20 animate-pulse" />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest animate-pulse">Uploading Assets...</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors">
            <Upload className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
          </div>
          <div className="text-center">
            <span className="block text-sm font-bold">
              {canAddMore ? 'Drop your creative assets here' : 'Limit Reached'}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium mt-1 block">
              {canAddMore ? 'JPG, PNG, WEBP, HEIC (Max 10MB)' : 'Maximum images uploaded'}
            </span>
          </div>
        </div>
      )}
    </Button>
  )

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label htmlFor="multi-image-upload" className="text-sm font-bold tracking-tight">
            Source Images
          </Label>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {uploadedImages.length} / {maxImages}
          </span>
        </div>

        <input
          ref={fileInputRef}
          id="multi-image-upload"
          type="file"
          accept={acceptedFormats}
          multiple
          onChange={handleFileSelect}
          disabled={disabled || uploading || !canAddMore}
          className="hidden"
        />

        {isAuthenticated ? uploadButton : <AuthModal trigger={uploadButton} />}

        {!canAddMore && (
          <p className="text-[10px] text-amber-500 font-bold uppercase tracking-widest text-center bg-amber-500/10 py-1 rounded-lg border border-amber-500/20">
            Maximum {maxImages} images allowed
          </p>
        )}
      </div>

      {/* Image Gallery */}
      {uploadedImages.length > 0 && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-primary" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Current Session Library
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {uploadedImages.map((img) => (
              <div
                key={img.id}
                className="group relative rounded-xl overflow-hidden bg-muted border border-border/50 aspect-square shadow-sm hover:shadow-md transition-all"
              >
                <img
                  src={img.url}
                  alt="Uploaded"
                  className="w-full h-full object-cover transition-transform group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => removeImage(img.id)}
                    className="bg-destructive hover:bg-destructive/90 rounded-xl p-2 shadow-xl transform translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                    title="Remove image"
                  >
                    <X className="h-4 w-4 text-white" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
