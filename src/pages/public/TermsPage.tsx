export function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 prose prose-slate">
      <h1 className="text-3xl font-bold text-slate-900 mb-2">Terms & Community Guidelines</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-3">1. Platform Purpose</h2>
        <p className="text-slate-600 leading-relaxed">CampusCycle is a peer-to-peer marketplace for students to exchange academic and campus resources within their college community. The platform does not take payment for transactions and is not responsible for the condition, quality, or delivery of any listed item.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-3">2. Eligibility</h2>
        <p className="text-slate-600 leading-relaxed">CampusCycle is intended for currently enrolled or recently graduated students and faculty. By registering, you represent that you are part of a legitimate educational institution.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-3">3. Prohibited Items</h2>
        <ul className="list-disc list-inside space-y-1 text-slate-600">
          <li>Stolen or counterfeit items</li>
          <li>Controlled substances, alcohol, or tobacco products</li>
          <li>Weapons of any kind</li>
          <li>Exam question papers or other academic dishonesty material</li>
          <li>Pirated software, books, or media</li>
          <li>Any item prohibited by law or college policy</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-3">4. Community Standards</h2>
        <ul className="list-disc list-inside space-y-1 text-slate-600">
          <li>Be honest about an item's condition</li>
          <li>Honor accepted requests and agreed exchange arrangements</li>
          <li>Treat all other students with respect</li>
          <li>Return borrowed items by the agreed date</li>
          <li>Report suspicious listings or behavior</li>
          <li>Do not share another student's personal contact information without consent</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-3">5. Liability Disclaimer</h2>
        <p className="text-slate-600 leading-relaxed">CampusCycle provides a platform for peer discovery only. All transactions are conducted directly between students. CampusCycle is not responsible for item quality, disputes, loss of payment, or any harm arising from interactions arranged through the platform. Exercise appropriate caution when meeting others on campus.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-3">6. Account Suspension</h2>
        <p className="text-slate-600 leading-relaxed">Accounts found to be in violation of these guidelines may be suspended or permanently removed. Repeated offences or serious violations will result in immediate account termination.</p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-slate-800 mb-3">7. Privacy</h2>
        <p className="text-slate-600 leading-relaxed">CampusCycle displays only the display name you choose. Your email address and other personal details are not shown to other users. Contact requests are handled within the platform. See our contact page to request data deletion.</p>
      </section>

      <div className="mt-10 p-5 bg-amber-50 border border-amber-200 rounded-xl">
        <p className="text-amber-800 text-sm font-medium">These terms are subject to change. Continued use of the platform after updates constitutes acceptance of the revised terms.</p>
      </div>
    </div>
  )
}
