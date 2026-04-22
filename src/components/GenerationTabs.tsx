import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Image, Video, Sparkles, Play } from 'lucide-react'
import { TextToImagePanel } from './panels/TextToImagePanel'
import { ImageToImagePanel } from './panels/ImageToImagePanel'
import { TextToVideoPanel } from './panels/TextToVideoPanel'
import { ImageToVideoPanel } from './panels/ImageToVideoPanel'

export function GenerationTabs() {
  return (
    <Tabs defaultValue="text-to-image" className="w-full">
      <div className="p-1 px-1.5 rounded-2xl bg-muted/30 backdrop-blur-sm border border-border/50">
        <TabsList className="grid w-full grid-cols-4 bg-transparent h-12">
          <TabsTrigger 
            value="text-to-image" 
            className="gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline font-bold">Text to Image</span>
            <span className="sm:hidden font-bold">T2I</span>
          </TabsTrigger>
          <TabsTrigger 
            value="image-to-image" 
            className="gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all"
          >
            <Image className="h-4 w-4" />
            <span className="hidden sm:inline font-bold">Image to Image</span>
            <span className="sm:hidden font-bold">I2I</span>
          </TabsTrigger>
          <TabsTrigger 
            value="text-to-video" 
            className="gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all"
          >
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline font-bold">Text to Video</span>
            <span className="sm:hidden font-bold">T2V</span>
          </TabsTrigger>
          <TabsTrigger 
            value="image-to-video" 
            className="gap-2 rounded-xl data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-lg transition-all"
          >
            <Play className="h-4 w-4" />
            <span className="hidden sm:inline font-bold">Image to Video</span>
            <span className="sm:hidden font-bold">I2V</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="text-to-image" className="mt-6">
        <TextToImagePanel />
      </TabsContent>

      <TabsContent value="image-to-image" className="mt-6">
        <ImageToImagePanel />
      </TabsContent>

      <TabsContent value="text-to-video" className="mt-6">
        <TextToVideoPanel />
      </TabsContent>

      <TabsContent value="image-to-video" className="mt-6">
        <ImageToVideoPanel />
      </TabsContent>
    </Tabs>
  )
}
