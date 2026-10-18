import { Link } from 'react-router-dom'
import { Heart, MapPin, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn, formatINR, timeAgo, getImageUrl, LISTING_TYPE_LABELS, CONDITION_LABELS, AVAILABILITY_LABELS } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { useToggleWishlist, useWishlist } from '@/hooks/useListings'
import type { Listing, ListingType } from '@/types'

interface ListingCardProps {
  listing: Listing
  className?: string
}

const TYPE_BADGE: Record<ListingType, 'sell' | 'donate' | 'borrow'> = {
  sell: 'sell',
  donate: 'donate',
  borrow: 'borrow',
}

export function ListingCard({ listing, className }: ListingCardProps) {
  const { user } = useAuthStore()
  const { data: wishlist } = useWishlist(user?.id)
  const toggleWishlist = useToggleWishlist()

  const inWishlist = wishlist?.some(w => w.listing_id === listing.id) ?? false
  const firstImage = listing.listing_images?.find(i => i.display_order === 0) ?? listing.listing_images?.[0]
  const imageUrl = getImageUrl(firstImage?.storage_path)
  const isAvailable = listing.availability_status === 'available'

  const handleWishlist = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) return
    toggleWishlist.mutate({ userId: user.id, listingId: listing.id, inWishlist })
  }

  return (
    <Link to={`/listings/${listing.id}`} className={cn('group block', className)}>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 group-hover:shadow-md group-hover:-translate-y-0.5">
        {/* Image */}
        <div className="relative h-48 bg-slate-100 overflow-hidden">
          <img
            src={imageUrl}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={e => { (e.target as HTMLImageElement).src = '/placeholder-item.svg' }}
          />
          {/* Badges */}
          <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
            <Badge variant={TYPE_BADGE[listing.listing_type]}>
              {LISTING_TYPE_LABELS[listing.listing_type]}
            </Badge>
            {!isAvailable && (
              <Badge variant="danger">{AVAILABILITY_LABELS[listing.availability_status]}</Badge>
            )}
          </div>
          {/* Wishlist */}
          {user && (
            <button
              onClick={handleWishlist}
              className={cn(
                'absolute top-2 right-2 size-8 rounded-full flex items-center justify-center transition-all',
                inWishlist
                  ? 'bg-red-500 text-white'
                  : 'bg-white/80 text-slate-500 hover:bg-white hover:text-red-500 backdrop-blur-sm'
              )}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={14} fill={inWishlist ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-xs text-slate-400 mb-1">{listing.category?.name ?? 'Uncategorized'}</p>
          <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 mb-2 group-hover:text-emerald-700 transition-colors">
            {listing.title}
          </h3>

          {/* Price */}
          <div className="mb-3">
            {listing.listing_type === 'donate' && (
              <span className="text-lg font-bold text-green-600">FREE</span>
            )}
            {listing.listing_type === 'sell' && (
              <span className="text-lg font-bold text-slate-900">{formatINR(listing.sale_price)}</span>
            )}
            {listing.listing_type === 'borrow' && (
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-amber-700">
                  {listing.borrowing_fee ? `${formatINR(listing.borrowing_fee)}/day` : 'Free to Borrow'}
                </span>
                {listing.refundable_deposit ? (
                  <span className="text-xs text-slate-500">+ {formatINR(listing.refundable_deposit)} deposit (refundable)</span>
                ) : null}
              </div>
            )}
          </div>

          {/* Meta */}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1">
              <div className="size-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-semibold text-[9px]">
                {listing.owner?.display_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <span className="truncate max-w-20">{listing.owner?.display_name ?? 'Unknown'}</span>
            </div>
            <Badge variant="default" className="text-[10px]">{CONDITION_LABELS[listing.condition]}</Badge>
          </div>

          {/* College + Time */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            {listing.college && (
              <span className="flex items-center gap-0.5 truncate">
                <MapPin size={10} /> {listing.college.name}
              </span>
            )}
            <span className="flex items-center gap-0.5 shrink-0">
              <Clock size={10} /> {timeAgo(listing.created_at)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}

// Grid wrapper
export function ListingGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5', className)}>
      {children}
    </div>
  )
}
