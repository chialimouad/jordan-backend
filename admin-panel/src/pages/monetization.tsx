import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Loader2, Crown, CreditCard, TrendingUp, Star, Zap, Gift, Plus, Edit2, Trash2 } from 'lucide-react'
import type { DashboardStats } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

const ALL_FEATURES = [
  'unlimited_likes', 'advanced_filters', 'see_who_liked', 'super_like',
  'profile_boost', 'read_receipts', 'priority_matching', 'rewind',
  'invisible_mode', 'compliment_credits', 'rematch', 'premium_badge',
  'hide_ads', 'passport_mode', 'improved_visits'
];

export default function MonetizationPage() {
  const { t } = useTranslation()
  const [plans, setPlans] = useState<any[]>([])
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Plan Edit State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<any>(null)
  const [formData, setFormData] = useState<any>({
    name: '', price: 0, durationDays: 30, isActive: true, features: [],
    dailyLikesLimit: 10, dailySuperLikesLimit: 0, dailyComplimentsLimit: 0,
    monthlyRewindsLimit: 2, weeklyBoostsLimit: 0
  })

  const load = async () => {
    setLoading(true)
    try {
      const [plansRes, statsRes] = await Promise.allSettled([
        adminApi.getPlans(),
        adminApi.getStats(),
      ])
      if (plansRes.status === 'fulfilled') {
        setPlans(plansRes.value.data || [])
      }
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleOpenModal = (plan = null) => {
    if (plan) {
      setEditingPlan(plan)
      setFormData(plan)
    } else {
      setEditingPlan(null)
      setFormData({
        name: '', price: 0, durationDays: 30, isActive: true, features: [],
        dailyLikesLimit: 10, dailySuperLikesLimit: 0, dailyComplimentsLimit: 0,
        monthlyRewindsLimit: 2, weeklyBoostsLimit: 0
      })
    }
    setIsModalOpen(true)
  }

  const handleSavePlan = async () => {
    try {
      if (editingPlan) {
        await adminApi.updatePlan(editingPlan.id, formData)
      } else {
        await adminApi.createPlan(formData)
      }
      setIsModalOpen(false)
      load()
    } catch (err) {
      console.error('Error saving plan', err)
    }
  }

  const handleDeletePlan = async (id: string) => {
    if (!window.confirm('Delete this plan?')) return
    try {
      await adminApi.deletePlan(id)
      load()
    } catch (err) {
      console.error('Error deleting plan', err)
    }
  }

  const toggleFeature = (feat: string) => {
    setFormData((prev: any) => ({
      ...prev,
      features: prev.features.includes(feat) 
        ? prev.features.filter((f: string) => f !== feat)
        : [...prev.features, feat]
    }))
  }

  if (loading && plans.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  const planIcons: Record<string, any> = { FREE: Gift, BASIC: Gift, PREMIUM: Star, GOLD: Crown, PLATINUM: Crown }
  const planColors: Record<string, string> = {
    FREE: 'bg-slate-100 text-slate-600',
    BASIC: 'bg-slate-100 text-slate-600',
    PREMIUM: 'bg-purple-100 text-purple-600',
    GOLD: 'bg-amber-100 text-amber-600',
    PLATINUM: 'bg-gray-800 text-gray-100',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('monetization.title')}</h1>
          <p className="text-muted-foreground">{t('monetization.subtitle')}</p>
        </div>
        <Button onClick={() => handleOpenModal()} className="gap-2">
          <Plus className="h-4 w-4" /> Create Plan
        </Button>
      </div>

      {/* Revenue Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-amber-50 p-3">
              <Crown className="h-6 w-6 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('monetization.premiumUsers')}</p>
              <p className="text-2xl font-bold">{stats?.revenue?.premiumUsers ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-lg bg-emerald-50 p-3">
              <TrendingUp className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('monetization.conversionRate')}</p>
              <p className="text-2xl font-bold">{stats?.revenue?.conversionRate ?? '0%'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Plans */}
      <div>
        <h2 className="text-lg font-semibold mb-4">{t('monetization.subscriptionPlans')}</h2>
        {plans.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {t('monetization.noPlans')}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan: any) => {
              const planKey = (plan.name || '').toUpperCase()
              const Icon = planIcons[planKey] || Star
              const colorClass = planColors[planKey] || 'bg-gray-100 text-gray-600'

              return (
                <Card key={plan.id} className={`relative overflow-hidden ${!plan.isActive ? 'opacity-50 grayscale' : ''}`}>
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2.5 ${colorClass}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-lg uppercase">{plan.name}</CardTitle>
                        <p className="text-2xl font-bold mt-1">
                          ${plan.price}<span className="text-sm text-muted-foreground font-normal">/{plan.durationDays}d</span>
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4 h-64 overflow-y-auto">
                    <div className="text-xs text-muted-foreground mb-2 grid grid-cols-2 gap-1">
                      <p>Likes: {plan.dailyLikesLimit === -1 ? 'Unlimited' : plan.dailyLikesLimit}/d</p>
                      <p>Rewinds: {plan.monthlyRewindsLimit}/mo</p>
                      <p>S-Likes: {plan.dailySuperLikesLimit}/d</p>
                      <p>Boosts: {plan.weeklyBoostsLimit}/wk</p>
                    </div>
                    {plan.features && (
                      <ul className="space-y-2 mt-4">
                        {plan.features.map((feat: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm capitalize">
                            <span className="text-emerald-500 mt-0.5">&#10003;</span>
                            <span>{feat.replace(/_/g, ' ')}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-between bg-muted/20 border-t p-3">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenModal(plan)} className="text-blue-500">
                      <Edit2 className="h-4 w-4 mr-2" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeletePlan(plan.id)} className="text-red-500">
                      <Trash2 className="h-4 w-4 mr-2" /> Delete
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Plan Edit Modal */}
      {isModalOpen && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingPlan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Basic Info</h3>
                <div>
                  <label className="text-sm font-medium">Plan Name</label>
                  <Input value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g. PLATINUM" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Price ($)</label>
                    <Input type="number" value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Duration (Days)</label>
                    <Input type="number" value={formData.durationDays} onChange={e => setFormData({...formData, durationDays: Number(e.target.value)})} />
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Switch checked={formData.isActive} onCheckedChange={(v) => setFormData({...formData, isActive: v})} />
                  <label className="text-sm">Active (Visible to users)</label>
                </div>

                <h3 className="font-semibold border-b pb-2 mt-6">Limits (-1 for unlimited)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs">Daily Likes</label>
                    <Input type="number" value={formData.dailyLikesLimit} onChange={e => setFormData({...formData, dailyLikesLimit: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-xs">Daily Super Likes</label>
                    <Input type="number" value={formData.dailySuperLikesLimit} onChange={e => setFormData({...formData, dailySuperLikesLimit: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-xs">Monthly Rewinds</label>
                    <Input type="number" value={formData.monthlyRewindsLimit} onChange={e => setFormData({...formData, monthlyRewindsLimit: Number(e.target.value)})} />
                  </div>
                  <div>
                    <label className="text-xs">Weekly Boosts</label>
                    <Input type="number" value={formData.weeklyBoostsLimit} onChange={e => setFormData({...formData, weeklyBoostsLimit: Number(e.target.value)})} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold border-b pb-2">Features</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[400px] overflow-y-auto">
                  {ALL_FEATURES.map(feat => (
                    <div key={feat} className="flex items-center space-x-2 border p-2 rounded-md">
                      <Switch 
                        checked={formData.features.includes(feat)} 
                        onCheckedChange={() => toggleFeature(feat)} 
                      />
                      <label className="text-xs capitalize flex-1 cursor-pointer" onClick={() => toggleFeature(feat)}>
                        {feat.replace(/_/g, ' ')}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSavePlan}>Save Plan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
