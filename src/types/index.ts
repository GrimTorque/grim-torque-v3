export type GenerationType = 'text-to-image' | 'image-to-image' | 'text-to-video' | 'image-to-video'



export type GeneratedContent = {
  id: string
  type: GenerationType
  model: string
  prompt: string
  url: string
  createdAt: number
  sourceImage?: string
}
