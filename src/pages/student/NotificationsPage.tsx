import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Package, MessageSquare } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useNotifications, useWorkflowAction } from '@/hooks/useMarketplace'
import { Button } from '@/components/ui/Button'
import { Card, EmptyState, Skeleton } from '@/components/ui/Card'
import { timeAgo } from '@/lib/utils'

export function NotificationsPage() {
  const { user } = useAuthStore()
  const { data: notifications, isLoading, error } = useNotifications(user?.id)
  const markRead = useWorkflowAction()
  const unread = notifications?.filter(notification => !notification.is_read) ?? []

  const handleRead = async (id: string) => {
    try { await markRead.mutateAsync({ action: 'mark_notification_read', notificationId: id }) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Could not mark notification as read') }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div><h1 className="text-2xl font-bold text-slate-900">Notifications</h1><p className="text-sm text-slate-500 mt-1">{unread.length ? `${unread.length} unread notification${unread.length === 1 ? '' : 's'}` : 'You’re all caught up.'}</p></div>
        {!!unread.length && <Button size="sm" variant="outline" loading={markRead.isPending} onClick={async () => { for (const item of unread) await handleRead(item.id) }}><CheckCheck size={15} /> Mark all read</Button>}
      </div>
      {isLoading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
        : error ? <EmptyState icon={<Bell size={36} />} title="Could not load notifications" description={error.message} />
        : notifications?.length ? <div className="space-y-2">{notifications.map(item => <Card key={item.id} className={`p-4 flex items-start gap-3 ${!item.is_read ? 'border-emerald-200 bg-emerald-50/40' : ''}`}>
          <div className="size-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">{item.related_request_id ? <MessageSquare size={16} /> : <Package size={16} />}</div>
          <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-slate-900">{item.title}</p><p className="text-sm text-slate-600 mt-0.5">{item.message}</p><p className="text-xs text-slate-400 mt-1">{timeAgo(item.created_at)}</p><div className="flex gap-3 mt-2">{item.related_request_id && <Link to={item.request?.requester_id === user?.id ? '/requests/buying' : '/requests/selling'} className="text-xs text-emerald-700 hover:underline">View request</Link>}{item.related_listing_id && <Link to={`/listings/${item.related_listing_id}`} className="text-xs text-emerald-700 hover:underline">View listing</Link>}</div></div>
          {!item.is_read && <button className="text-xs text-emerald-700 hover:underline shrink-0" onClick={() => handleRead(item.id)} disabled={markRead.isPending}>Mark read</button>}
        </Card>)}</div>
        : <EmptyState icon={<Bell size={40} />} title="No notifications yet" description="Updates about your requests and listings will show here." />}
    </div>
  )
}
