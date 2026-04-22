import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { useNavigate } from 'react-router-dom'
import { blink } from '@/lib/blink'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { UserPlus, Edit, Trash2, Loader2, Shield, LogOut, Calendar, Clock, RefreshCw, Palette, Key } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BrandingUpload } from '@/components/BrandingUpload'
import { ProjectCredentials } from '@/components/ProjectCredentials'
import { FUNCTION_URLS, ADMIN_KEY } from '@/lib/api-config'

const ADMIN_API_URL = FUNCTION_URLS.adminApi

interface AppUser {
  id: string
  username: string
  password: string
  displayName: string
  email?: string
  isAdmin: number
  isActive: number
  credits?: number
  createdAt: string
  expirationType?: string
  expirationDate?: string
}

export function AdminPanel() {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()
  const [users, setUsers] = useState<AppUser[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<AppUser | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [branding, setBranding] = useState({
    logoUrl: '/branding/logo.png',
    backgroundUrl: '/branding/background.png'
  })
  
  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    displayName: '',
    email: '',
    isAdmin: false,
    isActive: true,
    credits: 10,
    expirationType: 'permanent',
    expirationMonths: 1
  })

  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
      toast.error('Access denied. Admin privileges required.')
    }
  }, [isAdmin, navigate])

  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
      fetchBranding()
    }
  }, [isAdmin])

  const fetchBranding = async () => {
    try {
      const response = await fetch(`${ADMIN_API_URL}?resource=settings`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      })
      if (!response.ok) throw new Error('Failed to fetch settings')
      const settings = await response.json()
      
      const newBranding = {
        logoUrl: '/branding/logo.png',
        backgroundUrl: '/branding/background.png'
      }
      
      if (settings && Array.isArray(settings)) {
        settings.forEach((row: any) => {
          if (row.key === 'logo_url' && row.value) {
            newBranding.logoUrl = row.value
          }
          if (row.key === 'background_url' && row.value) {
            newBranding.backgroundUrl = row.value
          }
        })
      }

      setBranding(newBranding)
      console.log('Branding loaded from database:', newBranding)
    } catch (error) {
      console.warn('Could not fetch branding settings, using defaults', error)
    }
  }

  const handleBrandingUpdate = async (logoUrl: string | null, backgroundUrl: string | null) => {
    try {
      // Update state immediately with new values, keeping existing ones if not provided
      setBranding(prev => ({
        logoUrl: logoUrl || prev.logoUrl,
        backgroundUrl: backgroundUrl || prev.backgroundUrl
      }))

      // Persist to database using upsert pattern
      // First fetch all settings to find IDs
      const response = await fetch(`${ADMIN_API_URL}?resource=settings`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      })
      const allSettings = response.ok ? await response.json() : []

      if (logoUrl) {
        try {
          const existing = allSettings.find((s: any) => s.key === 'logo_url')
          
          if (existing) {
            // Update existing record
            await fetch(`${ADMIN_API_URL}?resource=settings&id=${existing.id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'x-admin-key': ADMIN_KEY 
              },
              body: JSON.stringify({
                value: logoUrl,
                updatedAt: new Date().toISOString()
              })
            })
          } else {
            // Create new record
            await fetch(`${ADMIN_API_URL}?resource=settings`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-admin-key': ADMIN_KEY 
              },
              body: JSON.stringify({
                key: 'logo_url',
                value: logoUrl
              })
            })
          }
          console.log('Logo URL saved to database:', logoUrl)
        } catch (dbError) {
          console.error('Failed to save logo to database:', dbError)
        }
      }

      if (backgroundUrl) {
        try {
          const existing = allSettings.find((s: any) => s.key === 'background_url')
          
          if (existing) {
            // Update existing record
            await fetch(`${ADMIN_API_URL}?resource=settings&id=${existing.id}`, {
              method: 'PUT',
              headers: { 
                'Content-Type': 'application/json',
                'x-admin-key': ADMIN_KEY 
              },
              body: JSON.stringify({
                value: backgroundUrl,
                updatedAt: new Date().toISOString()
              })
            })
          } else {
            // Create new record
            await fetch(`${ADMIN_API_URL}?resource=settings`, {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'x-admin-key': ADMIN_KEY 
              },
              body: JSON.stringify({
                key: 'background_url',
                value: backgroundUrl
              })
            })
          }
          console.log('Background URL saved to database:', backgroundUrl)
        } catch (dbError) {
          console.error('Failed to save background to database:', dbError)
        }
      }

      toast.success('Branding updated successfully')
    } catch (error) {
      console.error('Error updating branding:', error)
      toast.error('Failed to update branding')
    }
  }

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${ADMIN_API_URL}?resource=users`, {
        headers: { 'x-admin-key': ADMIN_KEY }
      })
      
      if (!response.ok) {
        if (response.status === 401) throw new Error('HTTP 401')
        throw new Error('Failed to fetch users')
      }
      
      const userList = await response.json()
      setUsers(userList || [])
    } catch (error: any) {
      console.error('Error fetching users:', error)
      if (error.message === 'HTTP 401' || error?.code === 'HTTP 401' || error?.status === 401) {
        toast.error('Authentication error. Please ensure database permissions allow public access or you are logged in.')
      } else {
        toast.error('Failed to load users: ' + (error.message || 'Unknown error'))
      }
    } finally {
      setLoading(false)
    }
  }

  const calculateExpirationDate = (type: string, months: number): string | null => {
    if (type === 'permanent') return null
    
    const now = new Date()
    if (type === 'yearly') {
      now.setFullYear(now.getFullYear() + 1)
    } else if (type === 'monthly') {
      now.setMonth(now.getMonth() + months)
    }
    return now.toISOString()
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const expirationDate = calculateExpirationDate(formData.expirationType, formData.expirationMonths)
      
      const response = await fetch(`${ADMIN_API_URL}?resource=users`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY 
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          displayName: formData.displayName,
          email: formData.email || undefined,
          isAdmin: formData.isAdmin ? 1 : 0,
          isActive: formData.isActive ? 1 : 0,
          credits: Number(formData.credits),
          expirationType: formData.expirationType,
          expirationDate: expirationDate
        })
      })

      if (!response.ok) throw new Error('Failed to create user')
      
      toast.success('User added successfully')
      setIsAddDialogOpen(false)
      resetForm()
      fetchUsers()
    } catch (error: any) {
      console.error('Error adding user:', error)
      toast.error('Failed to add user: ' + (error.message || 'Unknown error'))
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      const expirationDate = calculateExpirationDate(formData.expirationType, formData.expirationMonths)
      
      const response = await fetch(`${ADMIN_API_URL}?resource=users&id=${editingUser.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-key': ADMIN_KEY 
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          displayName: formData.displayName,
          email: formData.email || undefined,
          isAdmin: formData.isAdmin ? 1 : 0,
          isActive: formData.isActive ? 1 : 0,
          credits: Number(formData.credits),
          expirationType: formData.expirationType,
          expirationDate: expirationDate
        })
      })

      if (!response.ok) throw new Error('Failed to update user')
      
      toast.success('User updated successfully')
      setIsEditDialogOpen(false)
      setEditingUser(null)
      resetForm()
      fetchUsers()
    } catch (error: any) {
      console.error('Error updating user:', error)
      toast.error('Failed to update user: ' + (error.message || 'Unknown error'))
    }
  }

  const handleRenewAccount = async (user: AppUser) => {
    // Open edit dialog with pre-filled renewal settings
    setEditingUser(user)
    setFormData({
      username: user.username,
      password: user.password,
      displayName: user.displayName,
      email: user.email || '',
      isAdmin: Number(user.isAdmin) === 1,
      isActive: Number(user.isActive) === 1,
      credits: user.credits !== undefined ? Number(user.credits) : 10,
      expirationType: 'monthly',
      expirationMonths: 1
    })
    setIsEditDialogOpen(true)
  }

  const handleDeleteUser = async (userId: string, username: string) => {
    if (userId === 'admin-001') {
      toast.error('Cannot delete the main administrator account')
      return
    }

    try {
      const response = await fetch(`${ADMIN_API_URL}?resource=users&id=${userId}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': ADMIN_KEY }
      })

      if (!response.ok) throw new Error('Failed to delete user')

      toast.success(`User "${username}" deleted successfully`)
      fetchUsers()
    } catch (error: any) {
      console.error('Error deleting user:', error)
      toast.error('Failed to delete user: ' + (error.message || 'Unknown error'))
    }
  }

  const openEditDialog = (user: AppUser) => {
    setEditingUser(user)
    
    // Calculate months from expiration date if it exists
    let expirationMonths = 1
    if (user.expirationDate && user.expirationType === 'monthly') {
      const expDate = new Date(user.expirationDate)
      const now = new Date()
      const diffMonths = Math.round((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30))
      expirationMonths = Math.max(1, diffMonths)
    }
    
    setFormData({
      username: user.username,
      password: user.password,
      displayName: user.displayName,
      email: user.email || '',
      isAdmin: Number(user.isAdmin) === 1,
      isActive: Number(user.isActive) === 1,
      credits: user.credits !== undefined ? Number(user.credits) : 10,
      expirationType: user.expirationType || 'permanent',
      expirationMonths: expirationMonths
    })
    setIsEditDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      displayName: '',
      email: '',
      isAdmin: false,
      isActive: true,
      credits: 10,
      expirationType: 'permanent',
      expirationMonths: 1
    })
  }

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Panel</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Logged in as <strong>{user?.displayName}</strong> (Administrator)
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="branding" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Branding
            </TabsTrigger>
            <TabsTrigger value="credentials" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Credentials
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Add, edit, and remove users from the system</CardDescription>
                  </div>
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New User</DialogTitle>
                    <DialogDescription>Create a new user account</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddUser} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="add-username">Username *</Label>
                      <Input
                        id="add-username"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-password">Password *</Label>
                      <Input
                        id="add-password"
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-displayName">Display Name *</Label>
                      <Input
                        id="add-displayName"
                        value={formData.displayName}
                        onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-email">Email (optional)</Label>
                      <Input
                        id="add-email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="add-credits">Credits</Label>
                      <Input
                        id="add-credits"
                        type="number"
                        value={formData.credits}
                        onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="add-isAdmin"
                        checked={formData.isAdmin}
                        onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="add-isAdmin">Admin privileges</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="add-isActive"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="add-isActive">Active account</Label>
                    </div>
                    
                    <div className="space-y-3 border-t pt-4">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4" />
                        <span>Account Expiration</span>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="add-expirationType">Expiration Type</Label>
                        <Select
                          value={formData.expirationType}
                          onValueChange={(value) => setFormData({ ...formData, expirationType: value })}
                        >
                          <SelectTrigger id="add-expirationType">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="permanent">Permanent (No Expiration)</SelectItem>
                            <SelectItem value="monthly">Monthly (1-12 months)</SelectItem>
                            <SelectItem value="yearly">Yearly (1 year)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      {formData.expirationType === 'monthly' && (
                        <div className="space-y-2">
                          <Label htmlFor="add-expirationMonths">Number of Months</Label>
                          <Select
                            value={formData.expirationMonths.toString()}
                            onValueChange={(value) => setFormData({ ...formData, expirationMonths: parseInt(value) })}
                          >
                            <SelectTrigger id="add-expirationMonths">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                                <SelectItem key={month} value={month.toString()}>
                                  {month} {month === 1 ? 'month' : 'months'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    
                    <Button type="submit" className="w-full">Add User</Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Display Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expiration</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>{user.displayName}</TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{user.email || 'No email'}</div>
                      </TableCell>
                      <TableCell>
                        {Number(user.isAdmin) === 1 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                            <Shield className="h-3 w-3" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">User</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-bold text-primary">
                          {Number(user.isAdmin) === 1 || user.username === 'Admin' ? '∞' : (user.credits ?? 0)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {Number(user.isActive) === 1 ? (
                          <span className="text-green-600 dark:text-green-400">Active</span>
                        ) : (
                          <span className="text-red-600 dark:text-red-400">Inactive</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.expirationType === 'permanent' ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Permanent
                          </span>
                        ) : user.expirationDate ? (
                          (() => {
                            const expDate = new Date(user.expirationDate)
                            const now = new Date()
                            const isExpired = expDate < now
                            const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                            
                            return (
                              <div className="flex flex-col gap-1">
                                <span className={`text-xs font-medium ${isExpired ? 'text-red-600 dark:text-red-400' : daysLeft <= 7 ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
                                  {isExpired ? 'Expired' : expDate.toLocaleDateString()}
                                </span>
                                {!isExpired && (
                                  <span className="text-xs text-muted-foreground">
                                    ({daysLeft} {daysLeft === 1 ? 'day' : 'days'} left)
                                  </span>
                                )}
                              </div>
                            )
                          })()
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {(() => {
                            const isExpired = user.expirationDate && 
                              user.expirationType !== 'permanent' && 
                              new Date(user.expirationDate) < new Date()
                            
                            return isExpired ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRenewAccount(user)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                            ) : null
                          })()}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={user.id === 'admin-001'}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the user "{user.username}". This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.id, user.username)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
              </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Update user account information</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-username">Username *</Label>
                <Input
                  id="edit-username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-password">Password *</Label>
                <Input
                  id="edit-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-displayName">Display Name *</Label>
                <Input
                  id="edit-displayName"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email (optional)</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-credits">Credits</Label>
                <Input
                  id="edit-credits"
                  type="number"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isAdmin"
                  checked={formData.isAdmin}
                  onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                  disabled={editingUser?.id === 'admin-001'}
                />
                <Label htmlFor="edit-isAdmin">Admin privileges</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-isActive">Active account</Label>
              </div>
              
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="h-4 w-4" />
                  <span>Account Expiration</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-expirationType">Expiration Type</Label>
                  <Select
                    value={formData.expirationType}
                    onValueChange={(value) => setFormData({ ...formData, expirationType: value })}
                  >
                    <SelectTrigger id="edit-expirationType">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent">Permanent (No Expiration)</SelectItem>
                      <SelectItem value="monthly">Monthly (1-12 months)</SelectItem>
                      <SelectItem value="yearly">Yearly (1 year)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.expirationType === 'monthly' && (
                  <div className="space-y-2">
                    <Label htmlFor="edit-expirationMonths">Number of Months</Label>
                    <Select
                      value={formData.expirationMonths.toString()}
                      onValueChange={(value) => setFormData({ ...formData, expirationMonths: parseInt(value) })}
                    >
                      <SelectTrigger id="edit-expirationMonths">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((month) => (
                          <SelectItem key={month} value={month.toString()}>
                            {month} {month === 1 ? 'month' : 'months'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <Button type="submit" className="w-full">Update User</Button>
            </form>
          </DialogContent>
        </Dialog>
          </TabsContent>

          {/* Branding Tab */}
          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Upload Branding</CardTitle>
                  <CardDescription>Upload a custom logo and background image for your application</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <BrandingUpload
                  onBrandingUpdate={handleBrandingUpdate}
                  currentLogoUrl={branding.logoUrl}
                  currentBackgroundUrl={branding.backgroundUrl}
                  adminApiUrl={ADMIN_API_URL}
                  adminKey={ADMIN_KEY}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="space-y-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Project Credentials</CardTitle>
                  <CardDescription>Manage your project ID and publishable key for API integrations</CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 space-y-6">
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Click the button below to view and manage your project credentials.
                    </p>
                  </div>
                  <ProjectCredentials />
                  <div className="mt-6 max-w-md space-y-3 text-xs">
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-700 dark:text-red-400">
                      <strong>🔒 Security Notice:</strong> Never commit these credentials to version control or expose them in public code. The Publishable Key is safe to share, but keep your Project ID private.
                    </div>
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded text-amber-700 dark:text-amber-400">
                      <strong>⚠️ Best Practices:</strong> Store these in environment variables (.env.local) and never hardcode them. Use them only on the backend for sensitive operations.
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
