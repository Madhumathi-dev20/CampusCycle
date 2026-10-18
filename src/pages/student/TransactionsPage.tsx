import { Link } from 'react-router-dom'
import { ArrowRightLeft, CheckCircle, Clock3 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useTransactions } from '@/hooks/useMarketplace'
import { Card, EmptyState, Skeleton } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatINR, getImageUrl } from '@/lib/utils'

export function TransactionsPage() {
  const { user } = useAuthStore()
  const { data: transactions, isLoading, error } = useTransactions(user?.id)

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Transaction History</h1><p className="text-sm text-slate-500 mt-1">Your accepted purchases, donations, and borrowing records.</p></div>
      {isLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        : error ? <EmptyState icon={<ArrowRightLeft size={36} />} title="Could not load history" description={error.message} />
        : transactions?.length ? <div className="space-y-3">{transactions.map(transaction => {
          const isOwner = transaction.owner_id === user?.id
          const completed = transaction.completion_status === 'completed'
          return <Card key={transaction.id} className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center">
            <img src={getImageUrl(transaction.listing?.listing_images?.[0]?.storage_path)} alt={transaction.listing?.title ?? 'Item'} className="size-16 rounded-lg object-cover bg-slate-100" />
            <div className="flex-1 min-w-0"><Link to={`/listings/${transaction.listing_id}`} className="font-semibold text-slate-900 hover:text-emerald-700">{transaction.listing?.title ?? 'Item listing'}</Link>
              <p className="text-sm text-slate-500 mt-0.5">{isOwner ? 'You listed this item' : 'Requested by you'} · {new Date(transaction.created_at).toLocaleDateString()}</p>
              <p className="text-sm text-slate-600 mt-1">{transaction.transaction_type === 'sale' ? `Agreed price: ${formatINR(transaction.agreed_price)}` : transaction.transaction_type === 'donation' ? 'Donation · no payment handled on CampusCycle' : `Borrowing · ${transaction.request?.requested_start_date ?? '—'} to ${transaction.request?.requested_return_date ?? '—'}`}</p>
            </div>
            <div className="flex sm:flex-col items-center sm:items-end gap-2"><Badge variant={completed ? 'success' : 'warning'}>{completed ? 'Completed' : 'In progress'}</Badge>{transaction.handover_status === 'completed' ? <span className="text-xs text-slate-500">Handover recorded</span> : <span className="text-xs text-slate-500 flex items-center gap-1"><Clock3 size={12} /> Handover pending</span>}{completed && <CheckCircle size={16} className="text-emerald-600" />}</div>
          </Card>
        })}</div>
        : <EmptyState icon={<ArrowRightLeft size={40} />} title="No transactions yet" description="Accepted requests will appear here. All payment and handover arrangements are made directly between students." action={<Link to="/explore"><Button>Explore items</Button></Link>} />}
    </div>
  )
}
