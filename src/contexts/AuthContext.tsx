import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { blink } from '@/lib/blink'
import { toast } from 'sonner'
import { FUNCTION_URLS, ADMIN_KEY } from '@/lib/api-config'

export interface AppUser {
  id: string
  username: string
  displayName: string
  email?: string
  isAdmin: boolean
  isActive: boolean
  credits: number
}

interface AuthContextType {
  user: AppUser | null
  isAuthenticated: boolean
  isAdmin: boolean
  loading: boolean
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  hasRole: (role: 'admin' | 'user') => boolean
  refreshUser: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedUser = localStorage.getItem('app_user')
  let initialUser: AppUser | null = null
  if (storedUser) {
    try {
      initialUser = JSON.parse(storedUser)
    } catch (error) {
      localStorage.removeItem('app_user')
    }
  }

  const [user, setUser] = useState<AppUser | null>(initialUser)
  const [loading, setLoading] = useState(false)

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      // Hardcoded administrator account
      if (username === 'Admin' && password === 'Dj@4747') {
        const adminUser: AppUser = {
          id: 'admin-hardcoded',
          username: 'Admin',
          displayName: 'Administrator',
          email: 'admin@grimtorque.ai',
          isAdmin: true,
          isActive: true
        }

        setUser(adminUser)
        localStorage.setItem('app_user', JSON.stringify(adminUser))
        toast.success(`Welcome, ${adminUser.displayName}! (Administrator)`)
        return true
      }

      // Call login edge function
      let dbUser: any = null;
      try {
        const response = await fetch('https://zfan3glq--login.functions.blink.new', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        if (response.ok) {
          const data = await response.json();
          dbUser = data.user;
        } else if (response.status === 401) {
          // Invalid credentials
          toast.error('Invalid username or password');
          return false;
        } else {
          throw new Error(`Login failed with status: ${response.status}`);
        }
      } catch (err) {
        console.error('Edge function login error:', err);
        // Fallback to local admin check or re-throw
        throw err;
      }

      if (dbUser) {
        
        // Check if account has expired
        if (dbUser.expirationType !== 'permanent' && dbUser.expirationDate) {
          const expirationDate = new Date(dbUser.expirationDate)
          const now = new Date()
          
          if (expirationDate < now) {
            toast.error('Your account has expired. Please contact the administrator for renewal.')
            return false
          }
        }
        
        const appUser: AppUser = {
          id: dbUser.id,
          username: dbUser.username,
          displayName: dbUser.displayName || dbUser.username,
          email: dbUser.email,
          isAdmin: Number(dbUser.isAdmin) === 1,
          isActive: Number(dbUser.isActive) === 1,
          credits: Number(dbUser.credits || 0)
        }

        setUser(appUser)
        localStorage.setItem('app_user', JSON.stringify(appUser))
        
        const roleLabel = appUser.isAdmin ? 'Administrator' : 'User'
        toast.success(`Welcome, ${appUser.displayName}! (${roleLabel})`)
        return true
      } else {
        toast.error('Invalid username or password')
        return false
      }
    } catch (error: any) {
      console.error('Login error:', error)
      toast.error('Login failed. Please try again.')
      return false
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('app_user')
    toast.success('Logged out successfully')
  }

  const refreshUser = async () => {
    if (!user) return
    try {
      const response = await fetch(`${FUNCTION_URLS.adminApi}?resource=users&id=${user.id}`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      })
      if (response.ok) {
        const dbUsers = await response.json()
        const dbUser = Array.isArray(dbUsers) ? dbUsers.find((u: any) => u.id === user.id) : dbUsers
        
        if (dbUser) {
          const updatedUser: AppUser = {
            ...user,
            displayName: dbUser.displayName || dbUser.username,
            email: dbUser.email,
            isAdmin: Number(dbUser.isAdmin) === 1,
            isActive: Number(dbUser.isActive) === 1,
            credits: Number(dbUser.credits || 0)
          }
          setUser(updatedUser)
          localStorage.setItem('app_user', JSON.stringify(updatedUser))
        }
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error)
    }
  }

  const hasRole = (role: 'admin' | 'user'): boolean => {
    if (!user) return false
    if (role === 'admin') return user.isAdmin
    if (role === 'user') return !user.isAdmin
    return false
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && user.isActive,
        isAdmin: !!user && user.isAdmin,
        loading,
        login,
        logout,
        hasRole,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}