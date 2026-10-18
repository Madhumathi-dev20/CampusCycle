import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { ListingCard, ListingGrid } from '@/components/listings/ListingCard'
import { ListingCardSkeleton, EmptyState } from '@/components/ui/Card'
import { useListings, useCategories, useColleges } from '@/hooks/useListings'
import type { ListingFilters, ListingType, ListingCondition } from '@/types'
import { Package } from 'lucide-react'

const CONDITION_OPTIONS: { value: ListingCondition | ''; label: string }[] = [
  { value: '', label: 'Any Condition' },
  { value: 'new', label: 'New' },
  { value: 'like_new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
]

const TYPE_OPTIONS: { value: ListingType | ''; label: string }[] = [
  { value: '', label: 'All Types' },
  { value: 'sell', label: 'For Sale' },
  { value: 'donate', label: 'Free / Donate' },
  { value: 'borrow', label: 'Borrow' },
]

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

export function ExplorePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showFilters, setShowFilters] = useState(false)
  const syncingFromUrl = useRef(false)
  const lastUrlKey = useRef(searchParams.toString())
  const [page, setPage] = useState(() => {
    const parsed = Number(searchParams.get('page'))
    return Number.isInteger(parsed) && parsed > 1 ? parsed - 1 : 0
  })
  const PAGE_SIZE = 12
  const [filters, setFilters] = useState<ListingFilters>({
    search: searchParams.get('search') ?? '',
    listing_type: (searchParams.get('type') as ListingType) ?? '',
    category_id: searchParams.get('category_id') ?? '',
    college_name: searchParams.get('college_name') ?? searchParams.get('college_id') ?? '',
    condition: (searchParams.get('condition') as ListingCondition) ?? '',
    min_price: searchParams.get('min_price') && Number.isFinite(Number(searchParams.get('min_price'))) ? Number(searchParams.get('min_price')) : '',
    max_price: searchParams.get('max_price') && Number.isFinite(Number(searchParams.get('max_price'))) ? Number(searchParams.get('max_price')) : '',
    sort: (searchParams.get('sort') as ListingFilters['sort']) ?? 'newest',
  })
  const [searchInput, setSearchInput] = useState(filters.search ?? '')

  const { data: categories } = useCategories()
  const { data: colleges } = useColleges()
  const categoryName = searchParams.get('category_name')
  const namedCategoryId = categories?.find(category => category.name === categoryName)?.id
  const categoryFilterId = filters.category_id || namedCategoryId || ''
  const { data: listings, isLoading, error } = useListings({ ...filters, category_id: categoryFilterId }, page, PAGE_SIZE)

  useEffect(() => {
    if (categoryName && categories && !categories.find(c => c.name === categoryName)) {
      toast.error(`Category "${categoryName}" not found`)
      const next = new URLSearchParams(searchParams)
      next.delete('category_name')
      setSearchParams(next, { replace: true })
    }
  }, [categoryName, categories, searchParams, setSearchParams])

  useEffect(() => {
    const urlKey = searchParams.toString()
    if (lastUrlKey.current === urlKey) return
    lastUrlKey.current = urlKey
    const paramsPage = Number(searchParams.get('page'))
    const urlPage = Number.isInteger(paramsPage) && paramsPage > 1 ? paramsPage - 1 : 0
    const urlMin = searchParams.get('min_price')
    const urlMax = searchParams.get('max_price')
    const urlFilters: ListingFilters = {
      search: searchParams.get('search') ?? '',
      listing_type: (searchParams.get('type') as ListingType) ?? '',
      category_id: searchParams.get('category_id') ?? '',
      college_name: searchParams.get('college_name') ?? searchParams.get('college_id') ?? '',
      condition: (searchParams.get('condition') as ListingCondition) ?? '',
      min_price: urlMin !== null && Number.isFinite(Number(urlMin)) ? Number(urlMin) : '',
      max_price: urlMax !== null && Number.isFinite(Number(urlMax)) ? Number(urlMax) : '',
      sort: (searchParams.get('sort') as ListingFilters['sort']) ?? 'newest',
    }
    const paramsCategoryName = searchParams.get('category_name')
    const resolvedCategoryId = categories?.find(category => category.name === paramsCategoryName)?.id
    if (resolvedCategoryId) urlFilters.category_id = resolvedCategoryId
    const currentUrlState = `${JSON.stringify(urlFilters)}:${urlPage}`
    if (currentUrlState !== `${JSON.stringify(filters)}:${page}`) {
      syncingFromUrl.current = true
      setFilters(urlFilters)
      setSearchInput(urlFilters.search ?? '')
      setPage(urlPage)
    }
  }, [categories, filters, page, searchParams])

  useEffect(() => {
    if (syncingFromUrl.current) {
      syncingFromUrl.current = false
      return
    }
    const next = new URLSearchParams(searchParams)
    const setOrDelete = (key: string, value: string | null) => {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setOrDelete('search', filters.search?.trim() || null)
    setOrDelete('page', page > 0 ? String(page + 1) : null)
    setOrDelete('type', filters.listing_type || null)
    setOrDelete('category_id', categoryFilterId || null)
    setOrDelete('college_name', filters.college_name?.trim() || null)
    next.delete('college_id')
    setOrDelete('condition', filters.condition || null)
    setOrDelete('min_price', filters.min_price !== '' && filters.min_price !== undefined ? String(filters.min_price) : null)
    setOrDelete('max_price', filters.max_price !== '' && filters.max_price !== undefined ? String(filters.max_price) : null)
    setOrDelete('sort', filters.sort && filters.sort !== 'newest' ? filters.sort : null)
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true })
  }, [categoryFilterId, filters, page, searchParams, setSearchParams])

  // Line 112: Push for user changes, replace for normalization
  const updateFilter = <K extends keyof ListingFilters>(key: K, value: ListingFilters[K]) => {
    setPage(0)
    setFilters(f => ({ ...f, [key]: value }))
    // The state-to-URL effect will now use push instead of replace for these updates
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilter('search', searchInput)
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    const knownKeys = ['search', 'page', 'type', 'category_id', 'category_name', 'college_name', 'college_id', 'condition', 'min_price', 'max_price', 'sort']
    knownKeys.forEach(key => next.delete(key))
    setSearchParams(next, { replace: true })
    setFilters({ search: '', listing_type: '', category_id: '', college_name: '', condition: '', min_price: '', max_price: '', sort: 'newest' })
    setSearchInput('')
    setPage(0)
  }

  const hasActiveFilters = !!(filters.listing_type || filters.category_id || filters.college_name || filters.condition || filters.min_price || filters.max_price || filters.search)

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Explore Marketplace</h1>
        <p className="text-sm text-slate-500 mt-1">Discover items listed by students in your college</p>
      </div>

      {/* Search + filter toggle */}
      <div className="flex gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search items…"
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <Button type="submit" size="sm">Search</Button>
        </form>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(v => !v)}
          className="gap-1.5"
        >
          <SlidersHorizontal size={15} />
          Filters
          {hasActiveFilters && <span className="size-2 rounded-full bg-emerald-500" />}
        </Button>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X size={14} /> Clear
          </Button>
        )}
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <Select
            value={filters.listing_type ?? ''}
            onChange={e => updateFilter('listing_type', e.target.value as ListingType | '')}
          >
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <Select
            value={categoryFilterId ?? ''}
            onChange={e => updateFilter('category_id', e.target.value)}
          >
            <option value="">All Categories</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>

          <Input
            aria-label="College"
            placeholder="All Colleges"
            value={colleges?.find(college => college.id === filters.college_name)?.name ?? filters.college_name ?? ''}
            onChange={e => updateFilter('college_name', e.target.value)}
          />

          <Select
            value={filters.condition ?? ''}
            onChange={e => updateFilter('condition', e.target.value as ListingCondition | '')}
          >
            {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          <input
            type="number"
            placeholder="Min price (₹)"
            value={filters.min_price ?? ''}
            onChange={e => updateFilter('min_price', e.target.value === '' ? '' : Number(e.target.value))}
            className="h-9 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <input
            type="number"
            placeholder="Max price (₹)"
            value={filters.max_price ?? ''}
            onChange={e => updateFilter('max_price', e.target.value === '' ? '' : Number(e.target.value))}
            className="h-9 rounded-lg border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      )}

      {/* Sort row */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-slate-500">
          {listings ? (
            <>{listings.length} item{listings.length !== 1 ? 's' : ''} found on page {page + 1}</>
          ) : isLoading ? 'Loading…' : ''}
        </p>
        <Select
          value={filters.sort ?? 'newest'}
          onChange={e => updateFilter('sort', e.target.value as ListingFilters['sort'])}
          className="w-auto text-sm h-8"
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </div>

      {/* Listings grid */}
      {isLoading ? (
        <ListingGrid>
          {Array.from({ length: 12 }).map((_, i) => <ListingCardSkeleton key={i} />)}
        </ListingGrid>
      ) : error ? (
        <EmptyState
          title="Failed to load listings"
          description="There was an error connecting to the database. Please check your Supabase configuration."
        />
      ) : listings && listings.length > 0 ? (
        <>
          <ListingGrid>
            {listings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </ListingGrid>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button variant="outline" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Previous</Button>
            <span className="text-sm text-slate-500">Page {page + 1}</span>
            <Button variant="outline" disabled={listings.length < PAGE_SIZE} onClick={() => setPage(value => value + 1)}>Next</Button>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Package size={40} />}
          title="No items found"
          description="Try adjusting your search or filters. New items are listed daily!"
          action={hasActiveFilters ? <Button variant="outline" onClick={clearFilters}>Clear Filters</Button> : undefined}
        />
      )}
    </div>
  )
}
