import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Calendar, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useListing } from '@/hooks/useListings'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Card'
import { formatINR, getImageUrl } from '@/lib/utils'
import type { RequestType } from '@/types'

const schema = z.object({
  start_date: z.string().optional(),
  return_date: z.string().optional(),
  message: z.string().max(1000).optional(),
}).superRefine((data, ctx) => {
  if (data.start_date || data.return_date) {
    if (!data.start_date) ctx.addIssue({ code: 'custom', path: ['start_date'], message: 'Choose a start date' })
    if (!data.return_date) ctx.addIssue({ code: 'custom', path: ['return_date'], message: 'Choose a return date' })
    if (data.start_date && data.return_date) {
      const start = new Date(`${data.start_date}T00:00:00`)
      const end = new Date(`${data.return_date}T00:00:00`)
      const duration = Math.round((end.getTime() - start.getTime()) / 86_400_000)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (start < today) ctx.addIssue({ code: 'custom', path: ['start_date'], message: 'Start date must be today or later' })
      if (duration <= 0) ctx.addIssue({ code: 'custom', path: ['return_date'], message: 'Return date must be after the start date' })
    }
  }
})

function localDateString(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function RequestFormPage() {
  const [params] = useSearchParams()
  const listingId = params.get('listing') ?? ''
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const { data: listing, isLoading, error } = useListing(listingId)
  const [sending, setSending] = useState(false)
  const [today] = useState(() => new Date())
  const requestType: RequestType | null = useMemo(() => {
    if (!listing) return null
    return listing.listing_type === 'sell' ? 'purchase' : listing.listing_type === 'donate' ? 'donation' : 'borrowing'
  }, [listing])
  const { register, handleSubmit, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
  })

  if (isLoading) return <div className="max-w-xl mx-auto px-4 py-8 space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-60" /></div>
  if (error || !listing || !user || !requestType || listing.owner_id === user.id || listing.availability_status !== 'available') {
    return <div className="max-w-xl mx-auto px-4 py-16 text-center"><h1 className="text-xl font-bold">Request unavailable</h1><p className="text-slate-500 mt-2">This listing can’t be requested right now.</p><Button className="mt-4" onClick={() => navigate('/explore')}>Explore items</Button></div>
  }

  const onSubmit = async (values: FormOutput) => {
    if (requestType === 'borrowing') {
      const start = values.start_date ? new Date(`${values.start_date}T00:00:00`) : null
      const end = values.return_date ? new Date(`${values.return_date}T00:00:00`) : null
      const duration = start && end ? Math.round((end.getTime() - start.getTime()) / 86_400_000) : 0
      const todayFloor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      if (!start || !end || start < todayFloor || !duration || duration < (listing.min_borrow_days ?? 1) || duration > (listing.max_borrow_days ?? Number.MAX_SAFE_INTEGER)) {
        toast.error(`Choose a valid borrowing period between ${listing.min_borrow_days} and ${listing.max_borrow_days} days`)
        return
      }
    }
    setSending(true)
    try {
      const { error: rpcError } = await supabase.rpc('submit_request', {
        p_listing_id: listing.id,
        p_request_type: requestType,
        p_start: requestType === 'borrowing' ? values.start_date ?? null : null,
        p_return: requestType === 'borrowing' ? values.return_date ?? null : null,
        p_message: values.message?.trim() || null,
      })
      if (rpcError) throw rpcError
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['requests', user?.id] }),
        queryClient.invalidateQueries({ queryKey: ['listing', listing.id] }),
      ])
      toast.success('Request sent to the owner')
      navigate('/requests/buying')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send request')
    } finally {
      setSending(false)
    }
  }

  const minStartDate = localDateString(today)

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900">{requestType === 'purchase' ? 'Request to buy' : requestType === 'donation' ? 'Request this donation' : 'Request to borrow'}</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">Your contact details remain private. The owner will see your display name and request.</p>
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4 mb-5">
        <img className="size-20 rounded-lg object-cover bg-slate-100" src={getImageUrl(listing.listing_images?.[0]?.storage_path)} alt={listing.title} />
        <div className="min-w-0"><h2 className="font-semibold text-slate-900 line-clamp-2">{listing.title}</h2><p className="text-sm text-slate-500 mt-1">{listing.owner?.display_name} · {listing.college?.name}</p><p className="font-bold text-emerald-700 mt-1">{requestType === 'donation' ? 'FREE' : requestType === 'purchase' ? formatINR(listing.sale_price) : `${listing.borrowing_fee ? `${formatINR(listing.borrowing_fee)} / day` : 'Free to borrow'}${listing.refundable_deposit ? ` · ${formatINR(listing.refundable_deposit)} refundable deposit` : ''}`}</p></div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        {requestType === 'borrowing' && <>
          <p className="text-sm text-slate-600 flex items-center gap-2"><Calendar size={16} /> Borrowing period: {listing.min_borrow_days}–{listing.max_borrow_days} days</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Input label="Start date" type="date" min={minStartDate} error={errors.start_date?.message} {...register('start_date', { required: 'Choose a start date' })} />
            <Input label="Return date" type="date" min={minStartDate} error={errors.return_date?.message} {...register('return_date', { required: 'Choose a return date' })} />
          </div>
          {listing.borrowing_fee ? <p className="text-xs text-slate-500">The owner’s borrowing fee is arranged directly between you. Any deposit is refundable only as agreed between both parties.</p> : null}
        </>}
        <Textarea label="Message to owner (optional)" rows={4} maxLength={1000} placeholder="Introduce yourself or suggest a convenient campus handover time." error={errors.message?.message} {...register('message')} />
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">Payment, handover, and any refundable deposit are arranged directly between students. CampusCycle does not process payments or guarantee refunds.</div>
        <Button type="submit" size="lg" loading={sending} className="w-full"><MessageCircle size={17} /> Send Request</Button>
      </form>
    </div>
  )
}
