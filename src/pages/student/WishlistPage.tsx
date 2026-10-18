import { Heart } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useWishlist } from '@/hooks/useListings'
import { ListingCard, ListingGrid } from '@/components/listings/ListingCard'
import { EmptyState, ListingCardSkeleton } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { useNavigate } from 'react-router-dom'

export function WishlistPage() {
  const { user } = useAuthStore()
  const { data: wishlist, isLoading } = useWishlist(user?.id)
  const navigate = useNavigate()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">My Wishlist</h1>
        <p className="text-sm text-slate-500 mt-1">Items you've saved for later</p>
      </div>

      {isLoading ? (
        <ListingGrid>
          {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
        </ListingGrid>
      ) : wishlist && wishlist.length > 0 ? (
        <ListingGrid>
          {wishlist.map(w => w.listing && <ListingCard key={w.id} listing={w.listing} />)}
        </ListingGrid>
      ) : (
        <EmptyState
          icon={<Heart size={40} />}
          title="Your wishlist is empty"
          description="Browse the marketplace and save items you're interested in."
          action={<Button onClick={() => navigate('/explore')}>Explore Items</Button>}
        />
      )}
    </div>
  )
}
