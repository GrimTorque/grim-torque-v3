import { useState } from 'react'
import { Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface BrandingUploadProps {
  onBrandingUpdate: (logoUrl: string | null, backgroundUrl: string | null) => void
  currentLogoUrl?: string
  currentBackgroundUrl?: string
  adminApiUrl: string
  adminKey: string
}

export function BrandingUpload({
  onBrandingUpdate,
  currentLogoUrl,
  currentBackgroundUrl,
  adminApiUrl,
  adminKey
}: BrandingUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewLogo, setPreviewLogo] = useState<string | null>(currentLogoUrl || null)
  const [previewBackground, setPreviewBackground] = useState<string | null>(currentBackgroundUrl || null)

  const uploadImage = async (file: File, type: 'logo' | 'background'): Promise<string> => {
    try {
      const timestamp = Date.now()
      const safeExtension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const safePath = `branding/${type}-${timestamp}.${safeExtension}`

      const formData = new FormData()
      formData.append('file', file)
      formData.append('path', safePath)

      const response = await fetch(`${adminApiUrl}?resource=upload`, {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const { publicUrl } = await response.json()
      return publicUrl
    } catch (error) {
      console.error(`Failed to upload ${type}:`, error)
      throw error
    }
  }

  const handleImageSelect = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'background'
  ) => {
    const files = e.currentTarget.files
    if (!files || files.length === 0) return

    const file = files[0]

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(`Please select an image file for ${type}`)
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB')
      return
    }

    setUploading(true)

    try {
      // Create preview immediately
      const reader = new FileReader()
      reader.onload = (event) => {
        const preview = event.target?.result as string
        if (type === 'logo') {
          setPreviewLogo(preview)
        } else {
          setPreviewBackground(preview)
        }
      }
      reader.readAsDataURL(file)

      // Upload to storage
      const publicUrl = await uploadImage(file, type)

      // Update preview with uploaded URL
      if (type === 'logo') {
        setPreviewLogo(publicUrl)
      } else {
        setPreviewBackground(publicUrl)
      }

      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`)

      // Call callback with the updated URL for the uploaded image type
      if (type === 'logo') {
        onBrandingUpdate(publicUrl, null)
      } else {
        onBrandingUpdate(null, publicUrl)
      }
    } catch (error) {
      console.error(`Upload error for ${type}:`, error)
      toast.error(`Failed to upload ${type}`)
      // Reset preview on error
      if (type === 'logo') {
        setPreviewLogo(currentLogoUrl || null)
      } else {
        setPreviewBackground(currentBackgroundUrl || null)
      }
    } finally {
      setUploading(false)
    }
  }

  const resetLogo = () => {
    setPreviewLogo(currentLogoUrl || null)
  }

  const resetBackground = () => {
    setPreviewBackground(currentBackgroundUrl || null)
  }

  return (
    <div className="space-y-8">
      {/* Logo Upload */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Upload Logo</Label>
        
        {previewLogo && (
          <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-border bg-secondary/50 flex items-center justify-center">
            <img
              src={previewLogo}
              alt="Logo Preview"
              className="h-full w-full object-contain"
            />
            <button
              onClick={resetLogo}
              className="absolute top-2 right-2 p-1 bg-destructive rounded-full text-white hover:bg-destructive/90 transition-colors"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="relative">
          <input
            type="file"
            id="logo-upload"
            accept="image/*"
            onChange={(e) => handleImageSelect(e, 'logo')}
            disabled={uploading}
            className="hidden"
          />
          <Label
            htmlFor="logo-upload"
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest animate-pulse">
                  Uploading Logo...
                </span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-bold">Click to upload logo</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, HEIC (Max 10MB)</p>
                </div>
              </>
            )}
          </Label>
        </div>
      </div>

      {/* Background Upload */}
      <div className="space-y-4">
        <Label className="text-base font-semibold">Upload Background</Label>
        
        {previewBackground && (
          <div className="relative w-full h-48 rounded-lg overflow-hidden border border-border bg-secondary/50 flex items-center justify-center">
            <img
              src={previewBackground}
              alt="Background Preview"
              className="h-full w-full object-cover"
            />
            <button
              onClick={resetBackground}
              className="absolute top-2 right-2 p-1 bg-destructive rounded-full text-white hover:bg-destructive/90 transition-colors"
              disabled={uploading}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="relative">
          <input
            type="file"
            id="background-upload"
            accept="image/*"
            onChange={(e) => handleImageSelect(e, 'background')}
            disabled={uploading}
            className="hidden"
          />
          <Label
            htmlFor="background-upload"
            className={`flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              uploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary'
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-xs font-bold uppercase tracking-widest animate-pulse">
                  Uploading Background...
                </span>
              </>
            ) : (
              <>
                <Upload className="h-6 w-6 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-bold">Click to upload background</p>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, HEIC (Max 10MB)</p>
                </div>
              </>
            )}
          </Label>
        </div>
      </div>
    </div>
  )
}