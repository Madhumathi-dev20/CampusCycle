export function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">About CampusCycle</h1>
      <p className="text-slate-600 leading-relaxed mb-6">
        CampusCycle is a student-first marketplace built to solve a simple but costly problem: university students
        spend thousands of rupees every semester on textbooks, calculators, lab equipment, and other academic resources
        — items that are often used for just one semester and then left to collect dust.
      </p>
      <p className="text-slate-600 leading-relaxed mb-6">
        By connecting students who have unused items with those who need them, CampusCycle enables affordable
        buying, free donations, and flexible borrowing — all within the safety of a college campus.
      </p>
      <h2 className="text-xl font-bold text-slate-900 mb-3 mt-8">Our Mission</h2>
      <p className="text-slate-600 leading-relaxed mb-6">
        To make campus resources accessible to every student, regardless of their financial situation, by creating
        a trusted, community-driven sharing economy at the college level.
      </p>
      <h2 className="text-xl font-bold text-slate-900 mb-3 mt-8">How It Works</h2>
      <ol className="list-decimal list-inside space-y-2 text-slate-600">
        <li>Register with your email and select your college.</li>
        <li>Browse listings from other students in your college.</li>
        <li>Send a request to buy, borrow, or claim a donation.</li>
        <li>Arrange a safe campus handover with the owner.</li>
        <li>Confirm completion and leave the item for the next student.</li>
      </ol>
      <div className="mt-10 p-6 bg-emerald-50 rounded-xl border border-emerald-200">
        <p className="text-emerald-800 font-medium">
          CampusCycle is currently in early access. Features are being added continuously. If you encounter any issues,
          please use the Contact / Feedback page.
        </p>
      </div>
    </div>
  )
}
