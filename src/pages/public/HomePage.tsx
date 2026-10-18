import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, BookOpen, Calculator, Laptop, FlaskConical,
  Ruler, Home as HomeIcon, Package, ArrowRight,
  ShoppingBag, Gift, RefreshCw, Users, Layers
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Section, EmptyState, ListingCardSkeleton } from '@/components/ui/Card'
import { ListingCard, ListingGrid } from '@/components/listings/ListingCard'
import { useRecentListings, useFeaturedByType, usePlatformStats } from '@/hooks/useListings'
import { cn } from '@/lib/utils'

// ─── Category Cards ─────────────────────────────────────────────────────────

const DEFAULT_CATEGORIES = [
  { name: 'Books & Textbooks', icon: BookOpen, color: 'bg-blue-50 text-blue-600', slug: 'books' },
  { name: 'Academic Notes', icon: Layers, color: 'bg-violet-50 text-violet-600', slug: 'notes' },
  { name: 'Calculators', icon: Calculator, color: 'bg-amber-50 text-amber-600', slug: 'calculators' },
  { name: 'Electronics', icon: Laptop, color: 'bg-sky-50 text-sky-600', slug: 'electronics' },
  { name: 'Lab Equipment', icon: FlaskConical, color: 'bg-emerald-50 text-emerald-600', slug: 'lab' },
  { name: 'Drawing Instruments', icon: Ruler, color: 'bg-pink-50 text-pink-600', slug: 'drawing' },
  { name: 'Hostel Essentials', icon: HomeIcon, color: 'bg-orange-50 text-orange-600', slug: 'hostel' },
  { name: 'Other Resources', icon: Package, color: 'bg-slate-50 text-slate-600', slug: '' },
]

// ─── How It Works ─────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    icon: Search,
    title: 'Browse & Discover',
    desc: 'Search thousands of student-listed items by category, course, or college.',
  },
  {
    icon: ShoppingBag,
    title: 'Buy, Borrow, or Get Free',
    desc: 'Choose to purchase at student prices, borrow for a semester, or grab free donations.',
  },
  {
    icon: RefreshCw,
    title: 'Safe Campus Handover',
    desc: 'Arrange a convenient exchange on campus. No shipping, no hassle.',
  },
]

// ─── Hero Illustration ──────────────────────────────────────────────────────

function HeroIllustration() {
  return (
    <svg viewBox="0 0 480 380" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
      {/* Background circles */}
      <circle cx="240" cy="190" r="160" fill="#ecfdf5" opacity="0.7" />
      <circle cx="240" cy="190" r="120" fill="#d1fae5" opacity="0.5" />

      {/* Desk */}
      <rect x="100" y="260" width="280" height="14" rx="7" fill="#94a3b8" />
      <rect x="140" y="274" width="12" height="50" rx="4" fill="#94a3b8" />
      <rect x="328" y="274" width="12" height="50" rx="4" fill="#94a3b8" />

      {/* Stack of books */}
      <rect x="130" y="220" width="80" height="14" rx="3" fill="#3b82f6" />
      <rect x="134" y="206" width="76" height="14" rx="3" fill="#60a5fa" />
      <rect x="138" y="192" width="72" height="14" rx="3" fill="#93c5fd" />

      {/* Laptop */}
      <rect x="235" y="210" width="110" height="50" rx="5" fill="#1e293b" />
      <rect x="240" y="215" width="100" height="40" rx="3" fill="#0ea5e9" opacity="0.8" />
      <rect x="245" y="220" width="90" height="30" rx="2" fill="#38bdf8" opacity="0.6" />
      <rect x="225" y="260" width="130" height="5" rx="2.5" fill="#334155" />

      {/* Calculator */}
      <rect x="355" y="215" width="36" height="48" rx="5" fill="#f59e0b" />
      <rect x="360" y="220" width="26" height="12" rx="2" fill="#fef3c7" />
      {[0, 1, 2].map(row => [0, 1, 2].map(col => (
        <rect key={`${row}-${col}`} x={361 + col * 9} y={237 + row * 9} width="6" height="6" rx="1.5" fill="#fef3c7" opacity="0.7" />
      )))}

      {/* Person 1 (left) */}
      <circle cx="165" cy="155" r="22" fill="#fde68a" />
      <rect x="143" y="175" width="44" height="55" rx="10" fill="#10b981" />
      <rect x="130" y="185" width="16" height="35" rx="8" fill="#10b981" />
      <rect x="174" y="185" width="16" height="35" rx="8" fill="#10b981" />

      {/* Person 2 (right) */}
      <circle cx="315" cy="145" r="22" fill="#fcd5b4" />
      <rect x="293" y="165" width="44" height="55" rx="10" fill="#6366f1" />
      <rect x="280" y="175" width="16" height="35" rx="8" fill="#6366f1" />
      <rect x="324" y="175" width="16" height="35" rx="8" fill="#6366f1" />

      {/* Exchange arrow */}
      <path d="M195 200 Q240 170 280 200" stroke="#10b981" strokeWidth="2.5" fill="none" strokeDasharray="5,3" markerEnd="url(#arrow)" />
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="#10b981" />
        </marker>
      </defs>

      {/* Labels */}
      <text x="240" y="340" textAnchor="middle" fill="#64748b" fontSize="13" fontFamily="sans-serif">Students sharing resources on campus</text>
    </svg>
  )
}

// ─── Search Bar ───────────────────────────────────────────────────────────────

function HeroSearchBar() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/explore?search=${encodeURIComponent(query.trim())}`)
    else navigate('/explore')
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-xl">
      <div className="relative flex-1">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search textbooks, calculators, electronics…"
          className="w-full h-11 pl-9 pr-4 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
        />
      </div>
      <Button type="submit" size="lg" className="shrink-0">Search</Button>
    </form>
  )
}

// ─── Stats Block ──────────────────────────────────────────────────────────────

function StatsBlock() {
  const { data: stats, isLoading } = usePlatformStats()

  if (isLoading) return null
  if (!stats || (stats.total_listings === 0 && stats.total_users === 0)) return null

  const items = [
    { label: 'Items Listed', value: stats.total_listings, icon: Package },
    { label: 'Students Joined', value: stats.total_users, icon: Users },
    { label: 'Free Donations', value: stats.total_donations, icon: Gift },
    { label: 'Borrowing Items', value: stats.total_borrows, icon: RefreshCw },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-10 border-y border-slate-200 my-10">
      {items.map(item => (
        <div key={item.label} className="text-center">
          <item.icon size={20} className="mx-auto mb-1 text-emerald-600" />
          <p className="text-2xl font-bold text-slate-900">{item.value.toLocaleString('en-IN')}</p>
          <p className="text-xs text-slate-500">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── HomePage ─────────────────────────────────────────────────────────────────

export function HomePage() {
  const navigate = useNavigate()
  const { data: recent, isLoading: recentLoading } = useRecentListings(8)
  const { data: donations, isLoading: donationsLoading } = useFeaturedByType('donate', 4)
  const { data: borrows, isLoading: borrowsLoading } = useFeaturedByType('borrow', 4)

  return (
    <div>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-emerald-50 via-white to-teal-50 pt-14 pb-16 px-4">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 bg-emerald-100 text-emerald-700 text-xs font-medium px-3 py-1 rounded-full mb-5">
              🎓 Built for campus communities
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-4">
              Your Campus Has<br />
              <span className="text-emerald-600">What You Need.</span>
            </h1>
            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
              Buy, borrow, and discover affordable resources from students in your college. Give useful items a second life.
            </p>
            <div className="flex flex-wrap gap-3 mb-8">
              <Button size="lg" onClick={() => navigate('/explore')}>
                <Search size={18} /> Explore Items
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/listings/create')}>
                List an Item
              </Button>
            </div>
            <HeroSearchBar />
          </div>
          <div className="hidden md:block h-80">
            <HeroIllustration />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ── Stats ─────────────────────────────────────────────────────────── */}
        <StatsBlock />

        {/* ── Categories ────────────────────────────────────────────────────── */}
        <Section title="Browse by Category" subtitle="Find exactly what you need">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {DEFAULT_CATEGORIES.map(cat => (
              <Link
                key={cat.slug}
                to={cat.slug ? `/explore?category_name=${encodeURIComponent(cat.name)}` : '/explore'}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-center group"
              >
                <div className={cn('size-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110', cat.color)}>
                  <cat.icon size={22} />
                </div>
                <span className="text-xs font-medium text-slate-700 leading-tight">{cat.name}</span>
              </Link>
            ))}
          </div>
        </Section>

        {/* ── Recently Listed ───────────────────────────────────────────────── */}
        <Section
          title="Recently Listed"
          subtitle="Fresh items from your campus"
          action={<Link to="/explore" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">View all <ArrowRight size={14} /></Link>}
        >
          {recentLoading ? (
            <ListingGrid>
              {Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)}
            </ListingGrid>
          ) : recent && recent.length > 0 ? (
            <ListingGrid>
              {recent.map(listing => <ListingCard key={listing.id} listing={listing} />)}
            </ListingGrid>
          ) : (
            <EmptyState
              icon={<Package size={40} />}
              title="No listings yet"
              description="Be the first to list an item on CampusCycle!"
              action={<Button onClick={() => navigate('/listings/create')}>List an Item</Button>}
            />
          )}
        </Section>

        {/* ── Free Donations ───────────────────────────────────────────────── */}
        <Section
          title="Free Donations 🎁"
          subtitle="Items students are giving away for free"
          action={<Link to="/explore?type=donate" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">See all <ArrowRight size={14} /></Link>}
        >
          {donationsLoading ? (
            <ListingGrid>
              {Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)}
            </ListingGrid>
          ) : donations && donations.length > 0 ? (
            <ListingGrid>
              {donations.map(listing => <ListingCard key={listing.id} listing={listing} />)}
            </ListingGrid>
          ) : (
            <EmptyState
              icon={<Gift size={36} />}
              title="No donations listed yet"
              description="Students will list items for free here. Check back soon!"
            />
          )}
        </Section>

        {/* ── Borrow Items ─────────────────────────────────────────────────── */}
        <Section
          title="Available to Borrow 🔄"
          subtitle="Temporarily use items from other students"
          action={<Link to="/explore?type=borrow" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1">See all <ArrowRight size={14} /></Link>}
        >
          {borrowsLoading ? (
            <ListingGrid>
              {Array.from({ length: 4 }).map((_, i) => <ListingCardSkeleton key={i} />)}
            </ListingGrid>
          ) : borrows && borrows.length > 0 ? (
            <ListingGrid>
              {borrows.map(listing => <ListingCard key={listing.id} listing={listing} />)}
            </ListingGrid>
          ) : (
            <EmptyState
              icon={<RefreshCw size={36} />}
              title="No borrowing listings yet"
              description="Students will list items for borrowing here. Check back soon!"
            />
          )}
        </Section>

        {/* ── How It Works ─────────────────────────────────────────────────── */}
        <Section title="How CampusCycle Works">
          <div className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="flex flex-col items-start p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
                <div className="size-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
                  <step.icon size={20} />
                </div>
                <span className="text-xs font-semibold text-emerald-600 mb-1">Step {i + 1}</span>
                <h3 className="font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* ── Benefits ─────────────────────────────────────────────────────── */}
        <Section>
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white p-8 md:p-12 text-center">
            <h2 className="text-2xl md:text-3xl font-extrabold mb-3">Why Reuse Campus Resources?</h2>
            <p className="text-emerald-100 max-w-xl mx-auto mb-8 text-sm leading-relaxed">
              Textbooks cost thousands of rupees. A single calculator can serve five students across semesters.
              By sharing resources, the entire campus saves money and reduces waste together.
            </p>
            <div className="grid sm:grid-cols-3 gap-6 mb-8">
              {[
                { emoji: '💸', text: 'Save on expensive academic resources' },
                { emoji: '♻️', text: 'Reduce waste by reusing items' },
                { emoji: '🤝', text: 'Help fellow students succeed' },
              ].map(b => (
                <div key={b.text} className="bg-white/10 rounded-xl p-4">
                  <div className="text-2xl mb-2">{b.emoji}</div>
                  <p className="text-sm text-emerald-100">{b.text}</p>
                </div>
              ))}
            </div>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => navigate('/listings/create')}
              className="bg-white text-emerald-700 hover:bg-emerald-50"
            >
              Start Listing Today
            </Button>
          </div>
        </Section>
      </div>
    </div>
  )
}
