// ─── Core Domain Types ───────────────────────────────────────────────────────

export type AccountStatus = 'active' | 'suspended' | 'deactivated';

export type ListingType = 'sell' | 'donate' | 'borrow';
export type ListingCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type AvailabilityStatus = 'draft' | 'available' | 'reserved' | 'sold' | 'donated' | 'unavailable';

export type RequestType = 'purchase' | 'donation' | 'borrowing';
export type RequestStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'cancelled'
  | 'handed_over'
  | 'return_initiated'
  | 'completed'
  | 'overdue';

export type TransactionType = 'sale' | 'donation' | 'borrowing';
export type HandoverStatus = 'pending' | 'completed';
export type CompletionStatus = 'pending' | 'completed';

export type NotificationType =
  | 'new_request'
  | 'request_accepted'
  | 'request_rejected'
  | 'request_cancelled'
  | 'handover_confirmed'
  | 'return_initiated'
  | 'return_confirmed'
  | 'item_overdue'
  | 'listing_moderated'
  | 'completion_update'
  | 'account_update';

export type ReportStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';

// ─── Database Row Types ───────────────────────────────────────────────────────

export interface College {
  id: string;
  name: string;
  location: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  display_name: string;
  college_id: string | null;
  branch: string | null;
  semester: number | null;
  avatar_url: string | null;
  account_status: AccountStatus;
  college_verified_at: string | null;
  created_at: string;
  college?: College;
}

export interface PublicProfile {
  id: string;
  display_name: string;
  college_id: string | null;
  avatar_url: string | null;
  college?: College;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string;
  display_order: number;
}

export interface Listing {
  id: string;
  owner_id: string;
  college_id: string;
  category_id: string;
  title: string;
  description: string;
  listing_type: ListingType;
  condition: ListingCondition;
  sale_price: number | null;
  borrowing_fee: number | null;
  refundable_deposit: number | null;
  min_borrow_days: number | null;
  max_borrow_days: number | null;
  availability_status: AvailabilityStatus;
  moderation_status?: 'active' | 'removed';
  archived_at?: string | null;
  exchange_location: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  owner?: PublicProfile;
  college?: College;
  category?: Category;
  listing_images?: ListingImage[];
}

export interface Request {
  id: string;
  listing_id: string;
  requester_id: string;
  owner_id: string;
  request_type: RequestType;
  requested_start_date: string | null;
  requested_return_date: string | null;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  // Relations
  listing?: Listing;
  requester?: Profile;
  owner?: Profile;
}

export interface Transaction {
  id: string;
  listing_id: string;
  request_id: string;
  buyer_or_borrower_id: string;
  owner_id: string;
  transaction_type: TransactionType;
  agreed_price: number | null;
  handover_status: HandoverStatus;
  completion_status: CompletionStatus;
  completed_at: string | null;
  owner_completion_confirmed: boolean;
  requester_completion_confirmed: boolean;
  created_at: string;
  // Relations
  listing?: Listing;
  request?: Request;
  buyer_or_borrower?: Profile;
  owner?: Profile;
}

export interface Wishlist {
  id: string;
  user_id: string;
  listing_id: string;
  created_at: string;
  listing?: Listing;
}

export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_listing_id: string | null;
  related_request_id: string | null;
  is_read: boolean;
  created_at: string;
  request?: Pick<Request, 'requester_id' | 'owner_id'> | null;
}

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  listing_id: string | null;
  reason: string;
  description: string | null;
  status: ReportStatus;
  created_at: string;
  reporter?: Profile;
  reported_user?: Profile;
  listing?: Listing;
}

// ─── UI / Form Types ──────────────────────────────────────────────────────────

export interface ListingFilters {
  search?: string;
  listing_type?: ListingType | '';
  category_id?: string;
  college_name?: string;
  condition?: ListingCondition | '';
  min_price?: number | '';
  max_price?: number | '';
  sort?: 'newest' | 'price_asc' | 'price_desc';
}

export interface PlatformStats {
  total_listings: number;
  total_users: number;
  total_donations: number;
  total_borrows: number;
}
