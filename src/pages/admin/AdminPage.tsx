import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRightLeft, Flag, FolderOpen, Package, Search, ShieldCheck, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Skeleton } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import {
  useAdminListings, useAdminReports, useAdminUsers, useWorkflowAction,
  useAdminCategories, useAdminCategoryMutation, useAdminTransactions,
} from '@/hooks/useMarketplace'
import { formatINR, LISTING_TYPE_LABELS, timeAgo } from '@/lib/utils'
import type { AccountStatus, ReportStatus, Category, TransactionType } from '@/types'

type AdminTab = 'reports' | 'listings' | 'users' | 'categories' | 'transactions'

const accountStatusVariant: Record<AccountStatus, 'success' | 'warning' | 'default'> = {
  active: 'success', suspended: 'warning', deactivated: 'default',
}
const reportStatusVariant: Record<ReportStatus, 'danger' | 'warning' | 'success' | 'default'> = {
  open: 'danger', under_review: 'warning', resolved: 'success', dismissed: 'default',
}

export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>('reports')
  const [search, setSearch] = useState('')
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'all'>('open')
  const [txTypeFilter, setTxTypeFilter] = useState<TransactionType | 'all'>('all')
  const usersQuery = useAdminUsers(tab === 'users')
  const listingsQuery = useAdminListings(tab === 'listings')
  const reportsQuery = useAdminReports(tab === 'reports')
  const categoriesQuery = useAdminCategories(tab === 'categories')
  const transactionsQuery = useAdminTransactions(tab === 'transactions')
  const action = useWorkflowAction()
  const categoryMutation = useAdminCategoryMutation()

  // Category form
  const [editingCategory, setEditingCategory] = useState<Partial<Category> | null>(null)

  const matchingUsers = useMemo(() => (usersQuery.data ?? []).filter(user =>
    `${user.display_name} ${user.id} ${user.college?.name ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())
  ), [usersQuery.data, search])
  const matchingListings = useMemo(() => (listingsQuery.data ?? []).filter(listing =>
    `${listing.title} ${listing.owner?.display_name ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())
  ), [listingsQuery.data, search])
  const matchingReports = useMemo(() => (reportsQuery.data ?? []).filter(report => {
    const matchesStatus = reportFilter === 'all' || report.status === reportFilter
    const matchesText = `${report.reason} ${report.reporter?.display_name ?? ''} ${report.reported_user?.display_name ?? ''} ${report.listing?.title ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())
    return matchesStatus && matchesText
  }), [reportsQuery.data, reportFilter, search])
  const matchingTransactions = useMemo(() => (transactionsQuery.data ?? []).filter(tx => {
    const matchesType = txTypeFilter === 'all' || tx.transaction_type === txTypeFilter
    const matchesText = `${tx.listing?.title ?? ''} ${tx.buyer_or_borrower?.display_name ?? ''} ${tx.owner?.display_name ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())
    return matchesType && matchesText
  }), [transactionsQuery.data, txTypeFilter, search])

  const perform = async (work: Parameters<typeof action.mutateAsync>[0], successMessage: string) => {
    try {
      await action.mutateAsync(work)
      toast.success(successMessage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Administrative action failed')
    }
  }

  const changeAccountStatus = (userId: string, name: string, status: AccountStatus) => {
    if (status !== 'active' && !window.confirm(`Set ${name}'s account to ${status}?`)) return
    void perform({ action: 'admin_set_account_status', userId, status }, 'Account status updated')
  }

  const moderateListing = (listingId: string, title: string, remove: boolean) => {
    const message = remove ? `Remove "${title}" from the marketplace?` : `Restore "${title}" to active moderation?`
    if (!window.confirm(message)) return
    void perform({ action: 'admin_moderate_listing', listingId, remove }, remove ? 'Listing removed' : 'Listing restored')
  }

  const updateReport = (reportId: string, status: ReportStatus) => {
    void perform({ action: 'admin_update_report', reportId, status }, 'Report status updated')
  }

  const saveCategory = async () => {
    if (!editingCategory?.name?.trim()) { toast.error('Category name is required'); return }
    try {
      await categoryMutation.mutateAsync({
        id: editingCategory.id,
        name: editingCategory.name.trim(),
        description: editingCategory.description?.trim() || null,
        icon: editingCategory.icon?.trim() || null,
        is_active: editingCategory.is_active ?? true,
      })
      toast.success(editingCategory.id ? 'Category updated' : 'Category created')
      setEditingCategory(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save category')
    }
  }

  const tabs: { id: AdminTab; label: string; icon: typeof Flag }[] = [
    { id: 'reports', label: 'Reports', icon: Flag },
    { id: 'listings', label: 'Listings', icon: Package },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'categories', label: 'Categories', icon: FolderOpen },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="text-emerald-700" size={23} /><h1 className="text-2xl font-bold text-slate-900">Admin moderation</h1></div>
          <p className="text-sm text-slate-500 mt-1">Review reports, moderate listings, manage categories, and oversee transactions.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {tabs.map(({ id, label, icon: Icon }) => <Button key={id} size="sm" variant={tab === id ? 'primary' : 'outline'} onClick={() => { setTab(id); setSearch('') }}><Icon size={15} />{label}</Button>)}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${tab}…`} className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        {tab === 'reports' && <Select aria-label="Filter reports by status" className="sm:w-48" value={reportFilter} onChange={event => setReportFilter(event.target.value as ReportStatus | 'all')}>
          <option value="open">Open reports</option><option value="under_review">Under review</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="all">All statuses</option>
        </Select>}
        {tab === 'transactions' && <Select aria-label="Filter transactions by type" className="sm:w-48" value={txTypeFilter} onChange={event => setTxTypeFilter(event.target.value as TransactionType | 'all')}>
          <option value="all">All types</option><option value="sale">Sales</option><option value="donation">Donations</option><option value="borrowing">Borrowings</option>
        </Select>}
      </div>

      {/* ── Reports Tab ─────────────────────────────────────────────── */}
      {tab === 'reports' && <AdminSection isLoading={reportsQuery.isLoading} error={reportsQuery.error} count={reportsQuery.data?.length ?? 0} title="reports" emptyTitle="No reports found" emptyDescription="There are no reports matching this filter." limitNote="Showing the latest 200 reports at most.">
        {matchingReports.map(report => <Card key={report.id} className="p-4">
          <div className="flex flex-col md:flex-row gap-4 md:items-start">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap"><Badge variant={reportStatusVariant[report.status]}>{report.status.replace('_', ' ')}</Badge><Badge>{report.reason.replace(/_/g, ' ')}</Badge><span className="text-xs text-slate-400">{timeAgo(report.created_at)}</span></div>
              <p className="font-semibold text-slate-900 mt-2">{report.listing?.title ?? (report.reported_user ? `User report: ${report.reported_user.display_name}` : 'Report')}</p>
              <p className="text-sm text-slate-500 mt-1">Reported by {report.reporter?.display_name ?? 'Unavailable profile'}{report.reported_user && ` · About ${report.reported_user.display_name}`}</p>
              {report.description && <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{report.description}</p>}
              <p className="text-xs text-slate-400 mt-2">Report ID: {report.id}</p>
            </div>
            <div className="flex gap-2 flex-wrap md:justify-end">
              {report.status === 'open' && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => updateReport(report.id, 'under_review')}>Review</Button>}
              {report.status !== 'resolved' && <Button size="sm" disabled={action.isPending} onClick={() => updateReport(report.id, 'resolved')}>Resolve</Button>}
              {report.status !== 'dismissed' && <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => updateReport(report.id, 'dismissed')}>Dismiss</Button>}
            </div>
          </div>
        </Card>)}
      </AdminSection>}

      {/* ── Listings Tab ────────────────────────────────────────────── */}
      {tab === 'listings' && <AdminSection isLoading={listingsQuery.isLoading} error={listingsQuery.error} count={listingsQuery.data?.length ?? 0} title="listings" emptyTitle="No listings found" emptyDescription="No listings match your search." limitNote="Showing the latest 200 listings at most.">
        {matchingListings.map(listing => <Card key={listing.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 truncate">{listing.title}</p><Badge variant={listing.moderation_status === 'active' ? 'success' : 'danger'}>{listing.moderation_status}</Badge><Badge variant={listing.listing_type}>{LISTING_TYPE_LABELS[listing.listing_type]}</Badge></div>
            <p className="text-sm text-slate-500 mt-1">Owner: {listing.owner?.display_name ?? 'Unavailable profile'} · {Array.isArray(listing.college) ? listing.college[0]?.name ?? 'College not set' : listing.college?.name ?? 'College not set'} · {listing.availability_status}</p>
            <p className="text-xs text-slate-400 mt-1">{listing.listing_type === 'sell' ? formatINR(listing.sale_price) : listing.listing_type === 'donate' ? 'Free' : `${formatINR(listing.borrowing_fee)} / day`}</p>
          </div>
          {listing.moderation_status === 'active'
            ? <Button size="sm" variant="danger" disabled={action.isPending} onClick={() => moderateListing(listing.id, listing.title, true)}>Remove listing</Button>
            : <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => moderateListing(listing.id, listing.title, false)}>Restore listing</Button>}
        </Card>)}
      </AdminSection>}

      {/* ── Users Tab ───────────────────────────────────────────────── */}
      {tab === 'users' && <AdminSection isLoading={usersQuery.isLoading} error={usersQuery.error} count={usersQuery.data?.length ?? 0} title="users" emptyTitle="No users found" emptyDescription="No accounts match your search." limitNote="Showing the latest 200 accounts at most. Administrator role assignments are intentionally not available here.">
        {matchingUsers.map(user => <Card key={user.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900">{user.display_name}</p><Badge variant={accountStatusVariant[user.account_status]}>{user.account_status}</Badge></div>
            <p className="text-sm text-slate-500 mt-1">{user.college?.name ?? 'College not set'} · Joined {new Date(user.created_at).toLocaleDateString()}</p>
            <p className="text-xs text-slate-400 mt-1">User ID: {user.id}</p>
          </div>
          <div className="flex items-center gap-2"><AlertTriangle size={15} className="text-amber-600" /><Select aria-label={`Account status for ${user.display_name}`} className="w-40" value={user.account_status} disabled={action.isPending} onChange={event => changeAccountStatus(user.id, user.display_name, event.target.value as AccountStatus)}>
            <option value="active">Active</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option>
          </Select></div>
        </Card>)}
      </AdminSection>}

      {/* ── Categories Tab ──────────────────────────────────────────── */}
      {tab === 'categories' && <>
        <div className="mb-4">
          <Button size="sm" onClick={() => setEditingCategory({ name: '', description: '', icon: '', is_active: true })}>+ New Category</Button>
        </div>
        {editingCategory && (
          <Card className="p-4 mb-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">{editingCategory.id ? 'Edit Category' : 'New Category'}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Name" value={editingCategory.name ?? ''} onChange={e => setEditingCategory(c => c ? { ...c, name: e.target.value } : c)} placeholder="e.g. Electronics" />
              <Input label="Lucide Icon Name" value={editingCategory.icon ?? ''} onChange={e => setEditingCategory(c => c ? { ...c, icon: e.target.value } : c)} placeholder="e.g. laptop" />
            </div>
            <Input label="Description" value={editingCategory.description ?? ''} onChange={e => setEditingCategory(c => c ? { ...c, description: e.target.value } : c)} placeholder="Short description of the category" />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={editingCategory.is_active ?? true} onChange={e => setEditingCategory(c => c ? { ...c, is_active: e.target.checked } : c)} className="rounded" />
                Active
              </label>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" variant="outline" onClick={() => setEditingCategory(null)}>Cancel</Button>
                <Button size="sm" loading={categoryMutation.isPending} onClick={() => void saveCategory()}>Save</Button>
              </div>
            </div>
          </Card>
        )}
        <AdminSection isLoading={categoriesQuery.isLoading} error={categoriesQuery.error} count={categoriesQuery.data?.length ?? 0} title="categories" emptyTitle="No categories found" emptyDescription="Create your first category to get started." limitNote="All categories are shown.">
          {(categoriesQuery.data ?? []).filter(c => `${c.name} ${c.description ?? ''}`.toLowerCase().includes(search.toLowerCase().trim())).map(cat => <Card key={cat.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900">{cat.name}</p>
                <Badge variant={cat.is_active ? 'success' : 'default'}>{cat.is_active ? 'Active' : 'Inactive'}</Badge>
                {cat.icon && <span className="text-xs text-slate-400">Icon: {cat.icon}</span>}
              </div>
              {cat.description && <p className="text-sm text-slate-500 mt-1">{cat.description}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setEditingCategory({ ...cat })}>Edit</Button>
              <Button size="sm" variant={cat.is_active ? 'danger' : 'primary'} loading={categoryMutation.isPending} onClick={() => {
                void categoryMutation.mutateAsync({ id: cat.id, is_active: !cat.is_active }).then(() => toast.success(`Category ${cat.is_active ? 'deactivated' : 'activated'}`)).catch(e => toast.error(e instanceof Error ? e.message : 'Failed'))
              }}>{cat.is_active ? 'Deactivate' : 'Activate'}</Button>
            </div>
          </Card>)}
        </AdminSection>
      </>}

      {/* ── Transactions Tab ────────────────────────────────────────── */}
      {tab === 'transactions' && <AdminSection isLoading={transactionsQuery.isLoading} error={transactionsQuery.error} count={transactionsQuery.data?.length ?? 0} title="transactions" emptyTitle="No transactions found" emptyDescription="No transactions match your filters." limitNote="Showing the latest 200 transactions at most. This is a read-only overview.">
        {matchingTransactions.map(tx => <Card key={tx.id} className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold text-slate-900 truncate">{tx.listing?.title ?? 'Unknown listing'}</p>
                <Badge variant={tx.transaction_type === 'sale' ? 'sell' : tx.transaction_type === 'donation' ? 'donate' : 'borrow'}>{tx.transaction_type}</Badge>
                <Badge variant={tx.completion_status === 'completed' ? 'success' : 'warning'}>{tx.completion_status}</Badge>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                Owner: {tx.owner?.display_name ?? 'N/A'} → Buyer/Borrower: {tx.buyer_or_borrower?.display_name ?? 'N/A'}
              </p>
              <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-slate-400">
                {tx.agreed_price !== null && <span>Price: {formatINR(tx.agreed_price)}</span>}
                <span>Handover: {tx.handover_status}</span>
                <span>{timeAgo(tx.created_at)}</span>
                {tx.completed_at && <span>Completed: {new Date(tx.completed_at).toLocaleDateString()}</span>}
              </div>
            </div>
          </div>
        </Card>)}
      </AdminSection>}
    </div>
  )
}

function AdminSection({
  isLoading, error, count, title, emptyTitle, emptyDescription, limitNote, children,
}: {
  isLoading: boolean
  error: Error | null
  count: number
  title: string
  emptyTitle: string
  emptyDescription: string
  limitNote: string
  children: React.ReactNode
}) {
  if (isLoading) return <div className="space-y-3">{[0, 1, 2].map(index => <Skeleton key={index} className="h-28 rounded-xl" />)}</div>
  if (error) return <EmptyState icon={<AlertTriangle size={36} />} title={`Could not load ${title}`} description={error.message} />
  if (count === 0 || !children || (Array.isArray(children) && children.length === 0)) return <EmptyState icon={<Flag size={36} />} title={emptyTitle} description={emptyDescription} />
  return <div className="space-y-3"><p className="text-xs text-slate-500">{limitNote}</p>{children}</div>
}
