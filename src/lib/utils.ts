import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { ListingCondition, ListingType, AvailabilityStatus, RequestStatus } from '@/types'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format INR currency */
export function formatINR(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return '—'
  if (amount === 0) return 'FREE'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Format relative time */
export function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Human-readable condition labels */
export const CONDITION_LABELS: Record<ListingCondition, string> = {
  new: 'New',
  like_new: 'Like New',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
}

/** Listing type labels */
export const LISTING_TYPE_LABELS: Record<ListingType, string> = {
  sell: 'For Sale',
  donate: 'Free / Donate',
  borrow: 'Borrow',
}

/** Listing type badge colors */
export const LISTING_TYPE_COLORS: Record<ListingType, string> = {
  sell: 'bg-blue-100 text-blue-700',
  donate: 'bg-green-100 text-green-700',
  borrow: 'bg-amber-100 text-amber-700',
}

/** Availability status labels */
export const AVAILABILITY_LABELS: Record<AvailabilityStatus, string> = {
  draft: 'Draft',
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  donated: 'Donated',
  unavailable: 'Unavailable',
}

/** Request status labels */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  handed_over: 'Handed Over',
  return_initiated: 'Return Initiated',
  completed: 'Completed',
  overdue: 'Overdue',
}

/** Get public image URL from Supabase storage path */
export function getImageUrl(storagePath: string | null | undefined): string {
  if (!storagePath) return '/placeholder-item.svg'
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url || url.includes('placeholder')) return '/placeholder-item.svg'
  return `${url}/storage/v1/object/public/listing-images/${storagePath}`
}

/** Truncate text */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength).trimEnd() + '…'
}
