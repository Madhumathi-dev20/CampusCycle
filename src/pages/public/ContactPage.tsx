import { Mail, MessageCircle } from 'lucide-react';

export function ContactPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      {/* Page Heading */}
      <h1 className="text-3xl font-bold text-slate-900 mb-2">
        Contact & Feedback
      </h1>

      <p className="text-slate-500 mb-8">
        Have a question, bug report, or suggestion? We'd love to hear from you.
      </p>

      {/* Contact Information */}
      <div className="grid gap-5 sm:grid-cols-2">

        {/* Email Card */}
        <a
          href="mailto:madhumathi31506@gmail.com"
          className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="rounded-lg bg-emerald-50 p-3">
            <Mail className="h-6 w-6 text-emerald-600" />
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              Email Us
            </h2>

            <p className="mt-2 break-all text-sm text-slate-600">
              madhumathi31506@gmail.com
            </p>

            <p className="mt-2 text-sm text-emerald-700">
              Send us an email →
            </p>
          </div>
        </a>

        {/* LinkedIn Card */}
        <a
          href="https://www.linkedin.com/in/madhumathi-n-92972b371?utm_source=share_via&utm_content=profile&utm_medium=member_android"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <div className="rounded-lg bg-blue-50 p-3">
            <span className="text-xl font-bold text-blue-600">in</span>
          </div>

          <div>
            <h2 className="font-semibold text-slate-900">
              LinkedIn
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Connect with us professionally.
            </p>

            <p className="mt-2 text-sm text-blue-700">
              Visit LinkedIn profile →
            </p>
          </div>
        </a>

      </div>

      {/* Feedback Message */}
      <div className="mt-8 rounded-xl bg-slate-50 p-6">
        <div className="flex items-start gap-3">
          <MessageCircle className="mt-1 h-5 w-5 text-emerald-600" />

          <div>
            <h2 className="font-semibold text-slate-900">
              Have feedback?
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              Found a bug or have an idea to improve CampusCycle?
              Contact us by email. Your suggestions help us make the
              platform better for students.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}