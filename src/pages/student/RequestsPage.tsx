import { useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Check, Clock3, RotateCcw, X, ClipboardList } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useMyRequests, useTransactions, useWorkflowAction } from '@/hooks/useMarketplace'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, EmptyState, Skeleton } from '@/components/ui/Card'
import { getImageUrl, LISTING_TYPE_LABELS, REQUEST_STATUS_LABELS, formatINR } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { Request, RequestStatus } from '@/types'
import { ReportListingButton } from '@/pages/student/ReportListingButton'

const statusVariant: Record<RequestStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  pending: 'warning', accepted: 'info', rejected: 'danger', cancelled: 'default',
  handed_over: 'info', return_initiated: 'warning', completed: 'success', overdue: 'danger',
}

export function RequestsPage() {
  const location = useLocation()
  const [params] = useSearchParams()
  const side = location.pathname.endsWith('/selling') || params.get('view') === 'incoming' ? 'owner' : 'requester'
  const { user } = useAuthStore()
  const { data: requests, isLoading, error } = useMyRequests(user?.id, side)
  const { data: transactions, isLoading: transactionsLoading, error: transactionsError } = useTransactions(user?.id)
  const action = useWorkflowAction()

  const runAction = async (work: Parameters<typeof action.mutateAsync>[0], success: string) => {
    try { await action.mutateAsync(work); toast.success(success) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Action could not be completed') }
  }
  const transactionFor = (requestId: string) => transactions?.find(transaction => transaction.request_id === requestId)

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">{side === 'requester' ? 'My Requests' : 'Requests for My Listings'}</h1><p className="text-sm text-slate-500 mt-1">Review requests and coordinate campus handovers.</p></div>
        <div className="flex gap-2">
          <Link to="/requests/buying"><Button size="sm" variant={side === 'requester' ? 'primary' : 'outline'}>Sent by me</Button></Link>
          <Link to="/requests/selling"><Button size="sm" variant={side === 'owner' ? 'primary' : 'outline'}>For my listings</Button></Link>
        </div>
      </div>
      {isLoading || transactionsLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}</div>
        : error ? <EmptyState icon={<ClipboardList size={36} />} title="Could not load requests" description={error.message} />
        : transactionsError ? <EmptyState icon={<ClipboardList size={36} />} title="Could not load transaction details" description={`Some request actions depend on transaction data. ${transactionsError.message}`} action={<Button variant="outline" onClick={() => window.location.reload()}>Retry</Button>} />
        : requests?.length ? <div className="space-y-3">{requests.map(request => <RequestCard key={request.id} request={request} side={side} transaction={transactionFor(request.id)} busy={action.isPending} runAction={runAction} />)}</div>
        : <EmptyState icon={<ClipboardList size={40} />} title={side === 'requester' ? 'No requests sent yet' : 'No requests for your listings'} description={side === 'requester' ? 'Find an item you like and send a request to its owner.' : 'Requests from students will appear here.'} action={side === 'requester' ? <Link to="/explore"><Button>Explore Items</Button></Link> : undefined} />}
    </div>
  )
}

function RequestCard({ request, side, transaction, busy, runAction }: {
  request: Request
  side: 'requester' | 'owner'
  transaction?: { id: string; handover_status: string; completion_status: string; owner_completion_confirmed: boolean; requester_completion_confirmed: boolean }
  busy: boolean
  runAction: (work: Parameters<ReturnType<typeof useWorkflowAction>['mutateAsync']>[0], success: string) => Promise<void>
}) {
  const listing = request.listing
  const isBorrow = request.request_type === 'borrowing'
  const partyConfirmed = side === 'owner' ? transaction?.owner_completion_confirmed : transaction?.requester_completion_confirmed
  const otherConfirmed = side === 'owner' ? transaction?.requester_completion_confirmed : transaction?.owner_completion_confirmed
  const [today] = useState(() => {
    const date = new Date()
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  })
  const isPastDue = !!request.requested_return_date && request.requested_return_date < today

  return (
    <Card className="p-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <Link to={`/listings/${request.listing_id}`} className="size-20 shrink-0 rounded-lg overflow-hidden bg-slate-100">
          <img src={getImageUrl(listing?.listing_images?.[0]?.storage_path)} alt={listing?.title ?? 'Requested item'} className="w-full h-full object-cover" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 items-center mb-1"><Link to={`/listings/${request.listing_id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{listing?.title ?? 'Listing'}</Link><Badge variant={statusVariant[request.status]}>{REQUEST_STATUS_LABELS[request.status]}</Badge><Badge variant={listing?.listing_type ?? 'default'}>{listing ? LISTING_TYPE_LABELS[listing.listing_type] : request.request_type}</Badge></div>
          <p className="text-sm text-slate-500">{side === 'requester' ? `Owner: ${request.owner?.display_name ?? 'Student'}` : `Requested by: ${request.requester?.display_name ?? 'Student'}`}</p>
          {request.message && <p className="text-sm text-slate-600 mt-2">“{request.message}”</p>}
          {isBorrow && <p className="text-sm text-slate-600 mt-2">Requested period: {request.requested_start_date} – {request.requested_return_date}</p>}
          {!isBorrow && listing?.listing_type === 'sell' && <p className="text-sm font-medium text-slate-700 mt-2">{formatINR(listing.sale_price)}</p>}
          <p className="text-xs text-slate-400 mt-2">Sent {new Date(request.created_at).toLocaleDateString()}</p>
          {transaction && transaction.completion_status !== 'completed' && (transaction.owner_completion_confirmed || transaction.requester_completion_confirmed) && <p className="text-xs text-emerald-700 mt-2">{partyConfirmed ? 'You confirmed' : otherConfirmed ? 'The other party confirmed' : ''} {isBorrow ? 'the return' : 'completion'}. {otherConfirmed && !partyConfirmed ? 'Confirm to finish.' : !otherConfirmed ? 'Waiting for the other party.' : ''}</p>}
        </div>
        <div className="flex sm:flex-col flex-wrap gap-2 sm:items-stretch sm:min-w-40">
          {side === 'owner' && request.status === 'pending' && <>
            <Button size="sm" onClick={() => runAction({ action: 'respond_to_request', requestId: request.id, accept: true }, 'Request accepted')} disabled={busy}><Check size={14} /> Accept</Button>
            <Button size="sm" variant="outline" onClick={() => runAction({ action: 'respond_to_request', requestId: request.id, accept: false }, 'Request declined')} disabled={busy}><X size={14} /> Decline</Button>
          </>}
          {side === 'requester' && request.status === 'pending' && <>
            <Button size="sm" variant="outline" onClick={() => runAction({ action: 'cancel_request', requestId: request.id }, 'Request cancelled')} disabled={busy}><X size={14} /> Cancel request</Button>
            <ReportListingButton listingId={request.listing_id} reportedUserId={request.owner_id} />
          </>}
          {transaction && request.status === 'accepted' && side === 'owner' && transaction.handover_status === 'pending' && <Button size="sm" onClick={() => runAction({ action: 'confirm_handover', transactionId: transaction.id }, 'Handover recorded')} disabled={busy}><Check size={14} /> Mark handed over</Button>}
          {transaction && request.status === 'handed_over' && !isBorrow && transaction.completion_status !== 'completed' && !partyConfirmed && <Button size="sm" onClick={() => runAction({ action: 'confirm_completion', transactionId: transaction.id }, 'Your completion confirmation was recorded')} disabled={busy}><Check size={14} /> Confirm complete</Button>}
          {transaction && isBorrow && ['handed_over','overdue'].includes(request.status) && side === 'owner' && request.requested_return_date && isPastDue && request.status === 'handed_over' && <Button size="sm" variant="outline" onClick={() => runAction({ action: 'report_overdue', requestId: request.id }, 'Overdue report submitted')} disabled={busy}><Clock3 size={14} /> Report overdue</Button>}
          {transaction && isBorrow && ['handed_over','overdue'].includes(request.status) && <Button size="sm" variant="outline" onClick={() => runAction({ action: 'initiate_return', transactionId: transaction.id }, 'Return confirmation started')} disabled={busy}><RotateCcw size={14} /> Initiate return</Button>}
          {transaction && isBorrow && request.status === 'return_initiated' && !partyConfirmed && <Button size="sm" onClick={() => runAction({ action: 'confirm_return', transactionId: transaction.id }, 'Return confirmation recorded')} disabled={busy}><Check size={14} /> Confirm returned</Button>}
          {transaction && isBorrow && transaction.completion_status !== 'completed' && request.status === 'return_initiated' && (transaction.owner_completion_confirmed || transaction.requester_completion_confirmed) && <p className="text-xs text-slate-500 text-center">Waiting for {partyConfirmed ? 'the other party' : 'your confirmation'} to confirm return.</p>}
        </div>
      </div>
    </Card>
  )
}
