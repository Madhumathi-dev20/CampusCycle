import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AccountStatus, Category, College, Listing, ListingOwnerContact, PublicProfile, Request, Transaction, Notification, Report } from '@/types'

type AdminUserRow = {
  id: string
  display_name: string
  college_id: string | null
  account_status: AccountStatus
  created_at: string
  college: Pick<College, 'name'>
}

type AdminListingRow = Listing & {
  moderation_status: 'active' | 'removed'
  owner?: Pick<PublicProfile, 'id' | 'display_name'>
}

type AdminReportRow = Report & {
  reporter?: Pick<PublicProfile, 'id' | 'display_name'>
  reported_user?: Pick<PublicProfile, 'id' | 'display_name'>
  listing?: Pick<Listing, 'id' | 'title'>
}

export function useMyRequests(userId: string | undefined, side: 'requester' | 'owner') {
  const column = side === 'requester' ? 'requester_id' : 'owner_id'
  return useQuery({
    queryKey: ['requests', userId, side],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('requests').select(`
        *, listing:listings(*, listing_images(id, storage_path, display_order), category:categories(id, name), college:colleges(id, name)),
        requester:public_profiles!requests_requester_public_profile_fk(id, display_name, avatar_url, college_id),
        owner:public_profiles!requests_owner_public_profile_fk(id, display_name, avatar_url, college_id)
      `).eq(column, userId!).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Request[]
    },
  })
}

export function useTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: ['transactions', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select(`
        *, listing:listings(*, listing_images(id, storage_path, display_order), category:categories(id, name)),
        request:requests(requested_start_date, requested_return_date, status)
      `).or(`owner_id.eq.${userId},buyer_or_borrower_id.eq.${userId}`).order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Transaction[]
    },
  })
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('notifications').select('*, request:requests(requester_id, owner_id)').eq('recipient_id', userId!).order('created_at', { ascending: false }).limit(100)
      if (error) throw error
      return (data ?? []) as Notification[]
    },
  })
}

export function useListingOwnerContact(listingId: string | undefined, viewerId: string | undefined) {
  return useQuery({
    queryKey: ['listing-owner-contact', listingId, viewerId],
    enabled: Boolean(listingId && viewerId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_listing_owner_contact', {
        p_listing_id: listingId!,
      })
      if (error) {
        if (import.meta.env.DEV) {
          console.error('[Marketplace] Failed to load listing owner contact', {
            message: error.message,
            code: error.code,
            details: error.details,
            hint: error.hint,
          })
        }
        throw error
      }
      return ((data ?? []) as ListingOwnerContact[])[0] ?? null
    },
  })
}

export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-users'], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('id, display_name, college_id, account_status, created_at, college:colleges(name)').order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []) as unknown as AdminUserRow[]
    },
  })
}

export function useAdminListings(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-listings'], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('listings').select('*, owner:public_profiles!listings_owner_public_profile_fk(id, display_name), college:colleges(name), category:categories(name)').order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []) as unknown as AdminListingRow[]
    },
  })
}

export function useAdminReports(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-reports'], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('reports').select(`*, reporter:public_profiles!reports_reporter_public_profile_fk(id, display_name), reported_user:public_profiles!reports_reported_user_public_profile_fk(id, display_name), listing:listings(id, title)`).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []) as unknown as AdminReportRow[]
    },
  })
}

export type WorkflowAction =
  | { action: 'respond_to_request'; requestId: string; accept: boolean }
  | { action: 'cancel_request'; requestId: string }
  | { action: 'confirm_handover'; transactionId: string }
  | { action: 'confirm_completion'; transactionId: string }
  | { action: 'initiate_return'; transactionId: string }
  | { action: 'confirm_return'; transactionId: string }
  | { action: 'report_overdue'; requestId: string; description?: string }
  | { action: 'mark_notification_read'; notificationId: string }
  | { action: 'admin_moderate_listing'; listingId: string; remove: boolean }
  | { action: 'admin_set_account_status'; userId: string; status: 'active' | 'suspended' | 'deactivated' }
  | { action: 'admin_update_report'; reportId: string; status: 'open' | 'under_review' | 'resolved' | 'dismissed' }
  | { action: 'deactivate_account' }
  | { action: 'archive_listing'; listingId: string }
  | { action: 'restore_listing'; listingId: string }

export function useWorkflowAction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (workflow: WorkflowAction) => {
      let functionName: string
      let args: Record<string, unknown>
      switch (workflow.action) {
        case 'respond_to_request': functionName = workflow.action; args = { p_request_id: workflow.requestId, p_accept: workflow.accept }; break
        case 'cancel_request': functionName = workflow.action; args = { p_request_id: workflow.requestId }; break
        case 'confirm_handover':
        case 'confirm_completion':
        case 'initiate_return':
        case 'confirm_return': functionName = workflow.action; args = { p_transaction_id: workflow.transactionId }; break
        case 'report_overdue': functionName = workflow.action; args = { p_request_id: workflow.requestId, p_description: workflow.description ?? null }; break
        case 'mark_notification_read': functionName = workflow.action; args = { p_notification_id: workflow.notificationId }; break
        case 'admin_moderate_listing': functionName = workflow.action; args = { p_listing_id: workflow.listingId, p_remove: workflow.remove }; break
        case 'admin_set_account_status': functionName = workflow.action; args = { p_user_id: workflow.userId, p_status: workflow.status }; break
        case 'admin_update_report': functionName = workflow.action; args = { p_report_id: workflow.reportId, p_status: workflow.status }; break
        case 'deactivate_account': functionName = workflow.action; args = {}; break
        case 'archive_listing': functionName = workflow.action; args = { p_listing_id: workflow.listingId }; break
        case 'restore_listing': functionName = workflow.action; args = { p_listing_id: workflow.listingId }; break
      }
      const { data, error } = await supabase.rpc(functionName as never, args as never)
      if (error) throw error
      return data
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['requests'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['my-listings'] }),
        qc.invalidateQueries({ queryKey: ['listing'] }),
        qc.invalidateQueries({ queryKey: ['notifications'] }),
        qc.invalidateQueries({ queryKey: ['listings'] }),
        qc.invalidateQueries({ queryKey: ['admin-users'] }),
        qc.invalidateQueries({ queryKey: ['admin-listings'] }),
        qc.invalidateQueries({ queryKey: ['admin-reports'] }),
        qc.invalidateQueries({ queryKey: ['unread-notifications'] }),
        qc.invalidateQueries({ queryKey: ['platform-stats'] }),
      ])
    },
  })
}

export function useUnreadNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ['unread-notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', userId!).eq('is_read', false)
      if (error) throw error
      return count ?? 0
    },
  })
}

// ─── Admin Category Management ───────────────────────────────────────────────

export function useAdminCategories(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-categories'], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name')
      if (error) throw error
      return (data ?? []) as Category[]
    },
  })
}

export function useAdminCategoryMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: Partial<Category> & { id?: string }) => {
      if (id) {
        const { error } = await supabase.from('categories').update(fields).eq('id', id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('categories').insert(fields as { name: string })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-categories'] })
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
}

// ─── Admin Transaction Overview ──────────────────────────────────────────────

type AdminTransactionRow = Transaction & {
  listing?: Pick<Listing, 'id' | 'title'>
  buyer_or_borrower?: Pick<PublicProfile, 'id' | 'display_name'>
  owner?: Pick<PublicProfile, 'id' | 'display_name'>
}

export function useAdminTransactions(enabled: boolean) {
  return useQuery({
    queryKey: ['admin-transactions'], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('transactions').select(`
        *,
        listing:listings(id, title),
        buyer_or_borrower:public_profiles!transactions_buyer_or_borrower_id_fkey(id, display_name),
        owner:public_profiles!transactions_owner_id_fkey(id, display_name)
      `).order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return (data ?? []) as unknown as AdminTransactionRow[]
    },
  })
}
