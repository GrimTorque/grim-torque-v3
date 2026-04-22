import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/hooks/use-auth'
import { AuthModal } from '@/components/AuthModal'
import { useNavigate } from 'react-router-dom'
import { LogOut, Shield, LogIn, Coins } from 'lucide-react'

export function UserNav() {
  const { user, isAuthenticated, logout, loading, isAdmin } = useAuth()
  const navigate = useNavigate()

  if (loading) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
  }

  if (!isAuthenticated) {
    return (
      <AuthModal 
        trigger={
          <Button variant="default" size="sm" className="gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
        }
      />
    )
  }

  const credits = user?.credits ?? 0
  const isUnlimited = user?.isAdmin || user?.username === 'Admin'

  return (
    <div className="flex items-center gap-4">
      <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
        <Coins className="h-3.5 w-3.5" />
        <span className="text-xs font-bold">
          {isUnlimited ? 'UNLIMITED' : `${credits} CREDITS`}
        </span>
      </div>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="relative h-8 w-8 rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarImage src={''} alt={user?.displayName || 'User'} />
              <AvatarFallback>{(user?.displayName || 'U').charAt(0)}</AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="end" forceMount>
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user?.displayName || 'User'}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user?.username}
              </p>
              <div className="flex items-center gap-1 pt-1">
                <Coins className="h-3 w-3 text-primary" />
                <p className="text-xs font-bold text-primary">
                  {isUnlimited ? 'Unlimited Tokens' : `${credits} Credits Remaining`}
                </p>
              </div>
              {isAdmin && (
                <p className="text-xs leading-none text-primary font-semibold pt-1">Administrator</p>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
        {isAdmin && (
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => navigate('/Admin')}>
              <Shield className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>
        )}
        {isAdmin && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={logout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  )
}
