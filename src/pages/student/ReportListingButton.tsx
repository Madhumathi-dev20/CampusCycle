import { useState } from 'react'
import { Flag } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Select, Textarea } from '@/components/ui/Input'

const reasons = [
  ['fraud', 'Fraud or scam'],
  ['prohibited_item', 'Prohibited item'],
  ['misleading_listing', 'Misleading listing'],
  ['harassment', 'Harassment'],
  ['other', 'Other'],
] as const

export function ReportListingButton({ listingId, reportedUserId }: { listingId: string; reportedUserId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<(typeof reasons)[number][0]>('misleading_listing')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async () => {
    setSubmitting(true)
    try {
      const { error } = await supabase.rpc('submit_report', {
        p_listing_id: listingId,
        p_reported_user_id: reportedUserId,
        p_reason: reason,
        p_description: description.trim() || null,
      })
      if (error) throw error
      toast.success('Report submitted for review')
      setOpen(false)
      setDescription('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not submit report')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="mt-4">
    {!open ? <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}><Flag size={14} /> Report listing</Button> : <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3">
      <p className="text-sm font-medium text-slate-800">Report this listing</p>
      <Select label="Reason" value={reason} onChange={event => setReason(event.target.value as typeof reason)}>{reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
      <Textarea label="Details (optional)" rows={3} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} />
      <div className="flex gap-2"><Button type="button" size="sm" loading={submitting} onClick={submit}>Submit report</Button><Button type="button" size="sm" variant="outline" disabled={submitting} onClick={() => setOpen(false)}>Cancel</Button></div>
    </div>}
  </div>
}
