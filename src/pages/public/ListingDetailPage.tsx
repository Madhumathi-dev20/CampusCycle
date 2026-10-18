import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Heart, MapPin, Calendar, Clock, AlertCircle, MessageCircle, Phone, Mail } from 'lucide-react'
import { useListing, useToggleWishlist, useWishlist } from '@/hooks/useListings'
import { useListingOwnerContact } from '@/hooks/useMarketplace'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Card'
import {
  formatINR, timeAgo, getImageUrl,
  LISTING_TYPE_LABELS, CONDITION_LABELS, AVAILABILITY_LABELS
} from '@/lib/utils'
import { useState } from 'react'
import type { ListingType } from '@/types'
import { ReportListingButton } from '@/pages/student/ReportListingButton'

const TYPE_BADGE: Record<ListingType, 'sell' | 'donate' | 'borrow'> = {
  sell: 'sell', donate: 'donate', borrow: 'borrow',
}

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: listing, isLoading, error } = useListing(id!)
  const { data: ownerContact, isLoading: contactLoading, error: contactError } = useListingOwnerContact(id, user?.id)
  const { data: wishlist } = useWishlist(user?.id)
  const toggleWishlist = useToggleWishlist()
  const [activeImage, setActiveImage] = useState(0)

  const inWishlist = wishlist?.some(w => w.listing_id === id) ?? false
  const isOwner = user?.id === listing?.owner_id

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-2 gap-8">
        <Skeleton className="h-96 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    )
  }

  if (error || !listing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <AlertCircle size={40} className="mx-auto text-slate-400 mb-3" />
        <h2 className="text-lg font-semibold text-slate-700">Listing not found</h2>
        <p className="text-slate-500 text-sm mt-1 mb-4">This item may have been removed or is unavailable.</p>
        <Button variant="outline" onClick={() => navigate('/explore')}>← Back to Explore</Button>
      </div>
    )
  }

  const images = listing.listing_images ?? []
  const displayImage = images.length > 0
    ? getImageUrl(images[activeImage]?.storage_path)
    : '/placeholder-item.svg'

  const isAvailable = listing.availability_status === 'available'
  const contact = ownerContact?.owner_id === listing.owner_id ? ownerContact : null
  const phone = contact?.phone?.trim() ?? ''
  const normalizedPhone = phone.replace(/[()\s-]/g, '')
  const phoneHref = /^\+?\d{7,20}$/.test(normalizedPhone) ? normalizedPhone : ''
  const email = contact?.contact_email?.trim() ?? ''
  const emailMatch = email.match(/^([^@\s]+)@([a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/i)
  const emailHref = emailMatch
    ? `mailto:${encodeURIComponent(emailMatch[1])}@${emailMatch[2]}`
    : ''

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 mb-6 transition-colors">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Images */}
        <div>
          <div className="aspect-square rounded-xl overflow-hidden bg-slate-100 mb-3">
            <img
              src={displayImage}
              alt={listing.title}
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).src = '/placeholder-item.svg' }}
            />
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(i)}
                  className={`shrink-0 size-16 rounded-lg overflow-hidden border-2 transition-colors ${activeImage === i ? 'border-emerald-500' : 'border-transparent'}`}
                >
                  <img src={getImageUrl(img.storage_path)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {/* Badges */}
          <div className="flex gap-2 flex-wrap mb-3">
            <Badge variant={TYPE_BADGE[listing.listing_type]}>{LISTING_TYPE_LABELS[listing.listing_type]}</Badge>
            <Badge variant={isAvailable ? 'success' : 'danger'}>{AVAILABILITY_LABELS[listing.availability_status]}</Badge>
            <Badge variant="default">{CONDITION_LABELS[listing.condition]}</Badge>
          </div>

          <h1 className="text-xl font-bold text-slate-900 mb-3">{listing.title}</h1>

          {/* Price */}
          <div className="mb-4">
            {listing.listing_type === 'donate' && (
              <span className="text-3xl font-extrabold text-green-600">FREE</span>
            )}
            {listing.listing_type === 'sell' && (
              <span className="text-3xl font-extrabold text-slate-900">{formatINR(listing.sale_price)}</span>
            )}
            {listing.listing_type === 'borrow' && (
              <div>
                <span className="text-2xl font-bold text-amber-700">
                  {listing.borrowing_fee ? `${formatINR(listing.borrowing_fee)} / day` : 'Free to Borrow'}
                </span>
                {listing.refundable_deposit && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    + {formatINR(listing.refundable_deposit)} refundable deposit
                  </p>
                )}
                {(listing.min_borrow_days || listing.max_borrow_days) && (
                  <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                    <Calendar size={13} />
                    {listing.min_borrow_days && `Min ${listing.min_borrow_days} day${listing.min_borrow_days > 1 ? 's' : ''}`}
                    {listing.min_borrow_days && listing.max_borrow_days && ' · '}
                    {listing.max_borrow_days && `Max ${listing.max_borrow_days} days`}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-1">Description</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{listing.description}</p>
          </div>

          {/* Meta info */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2.5 mb-5 text-sm">
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-medium w-28 shrink-0">Category</span>
              <span>{listing.category?.name ?? '—'}</span>
            </div>
            {listing.college && (
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-medium w-28 shrink-0">College</span>
                <span className="flex items-center gap-1"><MapPin size={12} />{listing.college.name}</span>
              </div>
            )}
            {listing.exchange_location && (
              <div className="flex items-center gap-2 text-slate-600">
                <span className="font-medium w-28 shrink-0">Exchange Point</span>
                <span>{listing.exchange_location}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-600">
              <span className="font-medium w-28 shrink-0">Listed</span>
              <span className="flex items-center gap-1"><Clock size={12} />{timeAgo(listing.created_at)}</span>
            </div>
          </div>

          {/* Owner and Contact Information */}
          <div className="p-4 border border-slate-200 rounded-xl mb-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="size-10 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center">{listing.owner?.display_name?.[0]?.toUpperCase() ?? '?'}</div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{listing.owner?.display_name ?? 'Unknown'}</p>
                <p className="text-xs text-slate-400">Item owner</p>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-3 space-y-3">
              <p className="text-sm font-semibold text-slate-700">Contact Information</p>
              {!user ? (
                <p className="text-sm text-slate-500">
                  <Link to="/login" className="text-emerald-700 hover:underline">Log in</Link> to view seller contact information.
                </p>
              ) : contactLoading ? (
                <p className="text-sm text-slate-500">Loading contact information…</p>
              ) : contactError ? (
                <p className="text-sm text-slate-500">Unable to load contact information.</p>
              ) : contact ? (
                <>
                  {phoneHref ? (
                    <a href={`tel:${phoneHref}`} className="flex items-center gap-2 text-sm text-emerald-700 hover:underline">
                      <Phone size={15} /><span>{phone}</span>
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-slate-500">
                      <Phone size={15} /><span>Phone number not provided</span>
                    </p>
                  )}
                  {emailHref ? (
                    <a href={emailHref} className="flex items-center gap-2 text-sm text-emerald-700 hover:underline">
                      <Mail size={15} /><span>{email}</span>
                    </a>
                  ) : (
                    <p className="flex items-center gap-2 text-sm text-slate-500">
                      <Mail size={15} /><span>Contact email not provided</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">Seller contact information is unavailable.</p>
              )}
            </div>
          </div>

          {/* Actions */}
          {!isOwner && (
            <div className="flex gap-3">
              {isAvailable ? (
                user ? (
                  <Button
                    size="lg"
                    className="flex-1"
                    onClick={() => navigate(`/requests/new?listing=${listing.id}`)}
                  >
                    <MessageCircle size={18} />
                    {listing.listing_type === 'sell' ? 'Request to Buy' :
                      listing.listing_type === 'donate' ? 'Request Donation' :
                        'Request to Borrow'}
                  </Button>
                ) : (
                  <Link to="/login" className="flex-1">
                    <Button size="lg" className="w-full">Log in to Request</Button>
                  </Link>
                )
              ) : (
                <Button size="lg" disabled className="flex-1">Not Available</Button>
              )}

              {user && (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => toggleWishlist.mutate({ userId: user.id, listingId: listing.id, inWishlist })}
                  className={inWishlist ? 'text-red-500 border-red-200' : ''}
                >
                  <Heart size={18} fill={inWishlist ? 'currentColor' : 'none'} />
                </Button>
              )}
            </div>
          )}

          {isOwner && (
            <div className="flex gap-3">
              <Button variant="outline" size="lg" className="flex-1" onClick={() => navigate(`/listings/${listing.id}/edit`)}>
                Edit Listing
              </Button>
              <Button variant="ghost" size="lg" onClick={() => navigate('/my-listings')}>
                My Listings
              </Button>
            </div>
          )}

          {user && !isOwner && <ReportListingButton listingId={listing.id} reportedUserId={listing.owner_id} />}

          {/* Disclaimer */}
          <p className="text-xs text-slate-400 mt-4 flex items-start gap-1.5">
            <AlertCircle size={11} className="mt-0.5 shrink-0" />
            CampusCycle facilitates campus handovers. Payment and item exchange are arranged directly between students. Exercise appropriate caution.
          </p>
        </div>
      </div>
    </div>
  )
}
