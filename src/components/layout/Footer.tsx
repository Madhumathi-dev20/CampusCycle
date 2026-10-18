import { Link } from 'react-router-dom'

const FOOTER_LINKS = {
  Platform: [
    { to: '/explore', label: 'Explore Items' },
    { to: '/explore?type=donate', label: 'Free Donations' },
    { to: '/explore?type=borrow', label: 'Borrow Items' },
    { to: '/listings/create', label: 'List an Item' },
  ],
  Support: [
    { to: '/about', label: 'About Us' },
    { to: '/contact', label: 'Contact / Feedback' },
    { to: '/terms', label: 'Terms & Guidelines' },
  ],
  Account: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/my-listings', label: 'My Listings' },
    { to: '/wishlist', label: 'Wishlist' },
    { to: '/profile', label: 'Profile Settings' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="size-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">C²</span>
              </div>
              <span className="font-bold text-white text-lg">CampusCycle</span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              A student marketplace for buying, borrowing, and donating campus resources. Give useful items a second life.
            </p>
          </div>

          {/* Links */}
          {Object.entries(FOOTER_LINKS).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-sm font-semibold text-white mb-3">{group}</h4>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-slate-400 hover:text-white transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 pt-6 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {new Date().getFullYear()} CampusCycle. Built for students, by students.</p>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
            <Link to="/contact" className="hover:text-slate-300 transition-colors">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
