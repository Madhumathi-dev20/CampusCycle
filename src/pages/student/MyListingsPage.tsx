import { Link, useNavigate } from 'react-router-dom'
import { PlusCircle, Edit, Archive, Package } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useMyListings } from '@/hooks/useListings'
import { useWorkflowAction } from '@/hooks/useMarketplace'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/Card'
import { formatINR, timeAgo, LISTING_TYPE_LABELS, AVAILABILITY_LABELS, getImageUrl } from '@/lib/utils'
import toast from 'react-hot-toast'

export function MyListingsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: listings, isLoading } = useMyListings(user?.id)
  const archiveListing = useWorkflowAction()
  const restoreListing = useWorkflowAction()

  const handleArchive = async (id: string, title: string) => {
    if (!window.confirm(`Archive "${title}"? It will no longer appear in marketplace discovery; transaction history will be retained.`)) return
    try {
      await archiveListing.mutateAsync({ action: 'archive_listing', listingId: id })
      toast.success('Listing archived')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not archive listing')
    }
  }

  const handleRestore = async (id: string, title: string) => {
    if (!window.confirm(`Restore "${title}" to marketplace discovery?`)) return
    try {
      await restoreListing.mutateAsync({ action: 'restore_listing', listingId: id })
      toast.success('Listing restored')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not restore listing')
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Listings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage everything you've listed on CampusCycle</p>
        </div>
        <Button onClick={() => navigate('/listings/create')}>
          <PlusCircle size={16} /> New Listing
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : listings && listings.length > 0 ? (
        <div className="space-y-3">
          {listings.map(listing => {
            const img = listing.listing_images?.[0]
            return (
              <div key={listing.id} className="bg-white border border-slate-200 rounded-xl flex items-center gap-4 p-4 shadow-sm">
                {/* Thumbnail */}
                <div className="size-14 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={getImageUrl(img?.storage_path)}
                    alt={listing.title}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = '/placeholder-item.svg' }}
                  />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <Link to={`/listings/${listing.id}`} className="text-sm font-semibold text-slate-900 hover:text-emerald-700 line-clamp-1">
                    {listing.title}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {listing.archived_at && <Badge variant="warning">Archived</Badge>}
                    <Badge variant={listing.listing_type as 'sell' | 'donate' | 'borrow'}>
                      {LISTING_TYPE_LABELS[listing.listing_type]}
                    </Badge>
                    <Badge variant={listing.availability_status === 'available' ? 'success' : 'default'}>
                      {AVAILABILITY_LABELS[listing.availability_status]}
                    </Badge>
                    <span className="text-xs text-slate-400">{timeAgo(listing.created_at)}</span>
                  </div>
                </div>
                {/* Price */}
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-bold text-slate-800">
                    {listing.listing_type === 'sell' ? formatINR(listing.sale_price) :
                     listing.listing_type === 'donate' ? 'FREE' : 'Borrow'}
                  </p>
                  <p className="text-xs text-slate-400">{listing.category?.name}</p>
                </div>
                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/listings/${listing.id}/edit`)}
                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit size={16} />
                  </button>
                  {listing.archived_at ? <button
                    onClick={() => void handleRestore(listing.id, listing.title)}
                    disabled={restoreListing.isPending}
                    className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Restore listing"
                  >
                    <Package size={16} />
                  </button> : listing.availability_status !== 'sold' && listing.availability_status !== 'donated' && <button
                    onClick={() => void handleArchive(listing.id, listing.title)}
                    disabled={archiveListing.isPending}
                    className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    title="Archive listing"
                  >
                    <Archive size={16} />
                  </button>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Package size={40} />}
          title="No listings yet"
          description="Start sharing your unused items with fellow students."
          action={<Button onClick={() => navigate('/listings/create')}>List Your First Item</Button>}
        />
      )}
    </div>
  )
}
