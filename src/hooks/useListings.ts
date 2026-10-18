import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ListingFilters, Listing, Category, College, PlatformStats } from '@/types'

// ─── Listings ─────────────────────────────────────────────────────────────────

export function useListings(filters: ListingFilters = {}, page = 0, pageSize = 12) {
  return useQuery({
    queryKey: ['listings', filters, page, pageSize],
    queryFn: async () => {
      const { data: matches, error: searchError } = await supabase.rpc('search_listings', {
        p_search: filters.search?.trim() || null,
        p_listing_type: filters.listing_type || null,
        p_category_id: filters.category_id || null,
        p_college_id: filters.college_name || null,
        p_condition: filters.condition || null,
        p_min_price: filters.min_price === '' ? null : filters.min_price ?? null,
        p_max_price: filters.max_price === '' ? null : filters.max_price ?? null,
        p_sort: filters.sort ?? 'newest',
        p_offset: page * pageSize,
        p_limit: pageSize,
      })
      if (searchError) throw searchError
      const ids = ((matches ?? []) as { id: string }[]).map(item => item.id)
      if (!ids.length) return [] as Listing[]

      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          owner:public_profiles!listings_owner_public_profile_fk(id, display_name, avatar_url, college_id),
          college:colleges(id, name, location),
          category:categories(id, name, icon),
          listing_images(id, storage_path, display_order)
        `)
        .in('id', ids)
      if (error) throw error
      const byId = new Map((data ?? []).map(item => [item.id, item]))
      return ids.map(id => byId.get(id)).filter(Boolean) as Listing[]
    },
  })
}

export function useListing(id: string) {
  return useQuery({
    queryKey: ['listing', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          owner:public_profiles!listings_owner_public_profile_fk(id, display_name, avatar_url, college_id),
          college:colleges(id, name, location),
          category:categories(id, name, icon),
          listing_images(id, storage_path, display_order)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Listing
    },
    enabled: !!id,
  })
}

export function useMyListings(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-listings', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listings')
        .select(`
          *,
          college:colleges(id, name, location),
          category:categories(id, name, icon),
          listing_images(id, storage_path, display_order)
        `)
        .eq('owner_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Listing[]
    },
    enabled: !!userId,
  })
}

export function useRecentListings(limit = 8) {
  return useQuery({
    queryKey: ['recent-listings', limit],
    queryFn: async () => {
      const { data: matches, error: searchError } = await supabase.rpc('search_listings', {
        p_search: null, p_listing_type: null, p_category_id: null, p_college_id: null,
        p_condition: null, p_min_price: null, p_max_price: null, p_sort: 'newest', p_offset: 0, p_limit: limit,
      })
      if (searchError) throw searchError
      const ids = ((matches ?? []) as { id: string }[]).map(item => item.id)
      if (!ids.length) return [] as Listing[]
      const { data, error } = await supabase.from('listings').select(`
        *, owner:public_profiles!listings_owner_public_profile_fk(id, display_name, avatar_url, college_id),
        college:colleges(id, name), category:categories(id, name, icon), listing_images(id, storage_path, display_order)
      `).in('id', ids)
      if (error) throw error
      const byId = new Map((data ?? []).map(item => [item.id, item]))
      return ids.map(id => byId.get(id)).filter(Boolean) as Listing[]
    },
  })
}

export function useFeaturedByType(type: 'donate' | 'borrow', limit = 6) {
  return useQuery({
    queryKey: ['listings-by-type', type, limit],
    queryFn: async () => {
      const { data: matches, error: searchError } = await supabase.rpc('search_listings', {
        p_search: null, p_listing_type: type, p_category_id: null, p_college_id: null,
        p_condition: null, p_min_price: null, p_max_price: null, p_sort: 'newest', p_offset: 0, p_limit: limit,
      })
      if (searchError) throw searchError
      const ids = ((matches ?? []) as { id: string }[]).map(item => item.id)
      if (!ids.length) return [] as Listing[]
      const { data, error } = await supabase.from('listings').select(`
        *, owner:public_profiles!listings_owner_public_profile_fk(id, display_name, avatar_url, college_id),
        college:colleges(id, name), category:categories(id, name, icon), listing_images(id, storage_path, display_order)
      `).in('id', ids)
      if (error) throw error
      const byId = new Map((data ?? []).map(item => [item.id, item]))
      return ids.map(id => byId.get(id)).filter(Boolean) as Listing[]
    },
  })
}

// ─── Categories ───────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return (data ?? []) as Category[]
    },
    staleTime: 1000 * 60 * 10, // 10 min
  })
}

// ─── Colleges ─────────────────────────────────────────────────────────────────

export function useColleges() {
  return useQuery({
    queryKey: ['colleges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('colleges')
        .select('*')
        .order('name')
      if (error) throw error
      return (data ?? []) as College[]
    },
    staleTime: 1000 * 60 * 60,
  })
}

// ─── Platform Stats (real DB values only) ─────────────────────────────────────

export function usePlatformStats() {
  return useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('platform_stats').single()
      if (error) throw error
      const stats = data as unknown as PlatformStats
      return {
        total_listings: stats.total_listings ?? 0,
        total_users: stats.total_users ?? 0,
        total_donations: stats.total_donations ?? 0,
        total_borrows: stats.total_borrows ?? 0,
      }
    },
    staleTime: 1000 * 60 * 5,
  })
}

// ─── Wishlist ─────────────────────────────────────────────────────────────────

export function useWishlist(userId: string | undefined) {
  return useQuery({
    queryKey: ['wishlist', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wishlists')
        .select(`*, listing:listings(*, owner:public_profiles!listings_owner_public_profile_fk(id, display_name, avatar_url, college_id), listing_images(id, storage_path, display_order), category:categories(id, name, icon), college:colleges(id, name))`)
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
    enabled: !!userId,
  })
}

export function useToggleWishlist() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, listingId, inWishlist }: { userId: string; listingId: string; inWishlist: boolean }) => {
      if (inWishlist) {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('user_id', userId)
          .eq('listing_id', listingId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('wishlists')
          .insert({ user_id: userId, listing_id: listingId })
        if (error) throw error
      }
    },
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: ['wishlist', userId] })
    },
  })
}
