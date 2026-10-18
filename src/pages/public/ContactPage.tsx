import { Info } from 'lucide-react'

export function ContactPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Contact & Feedback</h1>
      <p className="text-slate-500 mb-8">Have a question, bug report, or suggestion? We'd love to hear from you.</p>
      <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900 flex gap-3">
        <Info size={18} className="shrink-0 mt-0.5" />
        <p>Contact message delivery is not configured. No message is collected or sent from this page yet.</p>
      </div>
    </div>
  )
}
