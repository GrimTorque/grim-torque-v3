import { ThemeProvider } from 'next-themes'
import { Toaster } from '@/components/ui/sonner'
import { ThemeToggle } from '@/components/ThemeToggle'
import { GenerationTabs } from '@/components/GenerationTabs'
import { UserNav } from '@/components/UserNav'
import { ProgressProvider } from '@/contexts/ProgressContext'
import { ProgressBar } from '@/components/ProgressBar'
import { Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'

const ADMIN_API_URL = 'https://zfan3glq--admin-api.functions.blink.new'

function AppContent() {
  const { isAuthenticated } = useAuth()
  const [branding, setBranding] = useState({
    logoUrl: '/branding/logo.png',
    backgroundUrl: '/branding/background.png'
  })

  useEffect(() => {
    const fetchBranding = async () => {
      try {
        // Fetch from public branding endpoint (no auth required)
        const response = await fetch(`${ADMIN_API_URL}?resource=branding`)
        if (!response.ok) throw new Error('Failed to fetch branding')
        
        const data = await response.json()
        setBranding({
          logoUrl: data.logoUrl || '/branding/logo.png',
          backgroundUrl: data.backgroundUrl || '/branding/background.png'
        })
      } catch (error) {
        // Fallback silently to defaults if fetch fails
        console.warn('Could not fetch branding settings, using defaults', error)
      }
    }

    // Fetch branding on mount
    fetchBranding()

    // Set up a polling interval to check for branding changes (every 30 seconds)
    const interval = setInterval(fetchBranding, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <ThemeProvider attribute="class" defaultTheme="dark">
      <div 
        className="min-h-screen bg-background bg-contain bg-center bg-no-repeat bg-fixed relative flex flex-col noise-bg"
        style={{ backgroundImage: `url(${branding.backgroundUrl})` }}
      >
        {/* Overlay to ensure text readability */}
        <div className="absolute inset-0 bg-background/80 dark:bg-background/90 z-0" />

        {/* Header */}
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto flex h-16 items-center justify-between px-4">
            <div className="flex items-center gap-3 group cursor-pointer">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl overflow-hidden aura-glow transition-transform group-hover:scale-110">
                <img src={branding.logoUrl} alt="Grim Torque Logo" className="h-full w-full object-contain" />
              </div>
              <div className="flex flex-col">
                <h1 className="text-xl font-bold tracking-tight text-gradient">
                  Grim Torque
                </h1>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  AI Powerhouse
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-[10px] uppercase tracking-wider bg-primary/10 text-primary px-3 py-1.5 rounded-full border border-primary/20 font-bold">
                <Sparkles className="h-3 w-3" />
                <span>Premium Unlocked</span>
              </div>
              <div className="h-8 w-[1px] bg-border mx-2 hidden sm:block" />
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <UserNav />
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-12 relative z-10 flex-1">
          <div className="max-w-6xl mx-auto space-y-16">
            {/* Hero Section */}
            <div className="text-center space-y-6 animate-slide-up">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-xs font-bold border border-primary/20 mb-4 aura-glow">
                <Sparkles className="h-4 w-4" />
                <span>THE FUTURE OF CREATIVE AI IS HERE</span>
              </div>
              
              <h2 className="text-5xl sm:text-7xl font-bold tracking-tighter leading-tight max-w-4xl mx-auto">
                Unlimited <span className="text-gradient">Creative Power</span> At Your Fingertips
              </h2>
              
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Generate high-fidelity images and cinematic videos with the world's most advanced AI models. No limits, no censorship, pure imagination.
              </p>
              
              {/* Model Badges */}
              <div className="flex flex-wrap justify-center gap-3 pt-6">
                {[
                  { name: 'Veo 3.1', icon: '🎬', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
                  { name: 'Kling 2.6', icon: '🧠', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
                  { name: 'Sora 2 Pro', icon: '🎥', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
                  { name: 'Nano Banana Pro', icon: '🍌', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' }
                ].map((model, i) => (
                  <div
                    key={i}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all hover:scale-105 cursor-default ${model.color}`}
                  >
                    <span>{model.icon}</span>
                    <span>{model.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Generation Interface */}
            <div className="glass-card rounded-3xl p-1 aura-glow animate-fade-in">
              <GenerationTabs />
            </div>

            {/* Features */}
            <div className="grid sm:grid-cols-3 gap-6 pt-12">
              {[
                { 
                  title: 'No Restrictions', 
                  desc: 'Generate any content without NSFW filters or censorship limitations. Your imagination is the only limit.',
                  icon: <Sparkles className="h-6 w-6 text-primary" />,
                  delay: '0ms'
                },
                { 
                  title: 'Unlimited Tokens', 
                  desc: 'No token limits or usage caps. Generate as much as you want, whenever you want. Pure creative freedom.',
                  icon: <span className="text-3xl font-bold text-primary">∞</span>,
                  delay: '100ms'
                },
                { 
                  title: 'Premium Models', 
                  desc: 'Access the full suite of elite AI models including Recraft, Nano Banana Pro, and Sora.',
                  icon: <span className="text-3xl">👑</span>,
                  delay: '200ms'
                }
              ].map((feature, i) => (
                <div 
                  key={i}
                  className="glass-card rounded-2xl p-8 space-y-4 hover:scale-[1.02] transition-transform duration-300 animate-slide-up"
                  style={{ animationDelay: feature.delay }}
                >
                  <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center aura-glow">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-bold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t mt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center text-sm text-muted-foreground">
              <p>Powered by cutting-edge AI technology</p>
              <p className="mt-2">
                Supporting: Nano Banana Pro, Sora, Veo, Kling
              </p>
            </div>
          </div>
        </footer>

        <Toaster position="bottom-right" richColors />
        <ProgressBar />
      </div>
    </ThemeProvider>
  )
}

function App() {
  return (
    <ProgressProvider>
      <AppContent />
    </ProgressProvider>
  )
}

export default App
