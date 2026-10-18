import { Link, useNavigate } from 'react-router-dom'
import { Package, PlusCircle, ShoppingBag, Heart, Bell, RefreshCw, TrendingUp, Inbox } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useMyListings } from '@/hooks/useListings'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatINR, timeAgo, LISTING_TYPE_LABELS, AVAILABILITY_LABELS } from '@/lib/utils'

export function DashboardPage() {
  const { profile, user } = useAuthStore()
  const navigate = useNavigate()
  const { data: myListings, isLoading } = useMyListings(user?.id)

  const activeListings = myListings?.filter(l => l.availability_status === 'available') ?? []
  const totalListings = myListings?.length ?? 0

  const quickLinks = [
    { icon: PlusCircle, label: 'List an Item', to: '/listings/create', color: 'bg-emerald-50 text-emerald-700' },
    { icon: ShoppingBag, label: 'My Listings', to: '/my-listings', color: 'bg-blue-50 text-blue-700' },
    { icon: Heart, label: 'Wishlist', to: '/wishlist', color: 'bg-pink-50 text-pink-700' },
    { icon: Bell, label: 'Notifications', to: '/notifications', color: 'bg-amber-50 text-amber-700' },
    { icon: RefreshCw, label: 'My Requests', to: '/requests/buying', color: 'bg-violet-50 text-violet-700' },
    { icon: Inbox, label: 'Incoming Requests', to: '/requests/selling', color: 'bg-indigo-50 text-indigo-700' },
    { icon: TrendingUp, label: 'Transaction History', to: '/transactions', color: 'bg-slate-50 text-slate-700' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {profile?.display_name ?? 'Student'} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {profile?.college?.name ?? 'Your campus marketplace'}
          </p>
        </div>
        <Button onClick={() => navigate('/listings/create')}>
          <PlusCircle size={16} /> List an Item
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Listings', value: totalListings, icon: Package },
          { label: 'Active Listings', value: activeListings.length, icon: TrendingUp },
          { label: 'Wishlist Items', value: '—', icon: Heart },
          { label: 'Pending Requests', value: '—', icon: RefreshCw },
        ].map(stat => (
          <Card key={stat.label} className="p-4">
            <stat.icon size={18} className="text-emerald-600 mb-2" />
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Quick links */}
      <div className="mb-8">
        <h2 className="text-base font-semibold text-slate-800 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickLinks.map(link => (
            <Link key={link.to} to={link.to}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:shadow-sm hover:-translate-y-0.5 transition-all text-center"
            >
              <div className={`size-10 rounded-xl flex items-center justify-center ${link.color}`}>
                <link.icon size={18} />
              </div>
              <span className="text-xs font-medium text-slate-700 leading-tight">{link.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent listings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-slate-800">My Recent Listings</h2>
          <Link to="/my-listings" className="text-sm text-emerald-600 hover:text-emerald-700">View all</Link>
        </div>
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : myListings && myListings.length > 0 ? (
          <div className="space-y-2">
            {myListings.slice(0, 5).map(listing => (
              <Card key={listing.id} className="flex items-center gap-4 p-4 hover:shadow-sm transition-shadow">
                <div className="size-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <Package size={18} className="text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{listing.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant={listing.listing_type as 'sell' | 'donate' | 'borrow'} className="text-[10px]">
                      {LISTING_TYPE_LABELS[listing.listing_type]}
                    </Badge>
                    <span className="text-xs text-slate-400">{timeAgo(listing.created_at)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-slate-800">
                    {listing.listing_type === 'sell' ? formatINR(listing.sale_price) : listing.listing_type === 'donate' ? 'FREE' : 'Borrow'}
                  </p>
                  <p className="text-xs text-slate-400">{AVAILABILITY_LABELS[listing.availability_status]}</p>
                </div>
                <Link to={`/listings/${listing.id}/edit`} className="text-xs text-emerald-600 hover:text-emerald-700 shrink-0">Edit</Link>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <Package size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 mb-4">You haven't listed anything yet.</p>
            <Button onClick={() => navigate('/listings/create')} size="sm">List your first item</Button>
          </Card>
        )}
      </div>
    </div>
  )
}
