import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Menu, X, Bell, Heart, PlusCircle, ChevronDown, LogOut, User, LayoutDashboard, Package, MessageSquareText, Inbox, History } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUnreadNotifications } from '@/hooks/useMarketplace'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { to: '/explore', label: 'Explore' },
  { to: '/explore?category_name=Books%20%26%20Textbooks', label: 'Books' },
  { to: '/explore?category_name=Electronics', label: 'Electronics' },
  { to: '/explore?type=donate', label: 'Donate' },
  { to: '/explore?type=borrow', label: 'Borrow' },
]

export function Navbar() {
  const { user, profile, isAdmin, signOut } = useAuthStore()
  const navigate = useNavigate()
  const { data: unreadCount } = useUnreadNotifications(user?.id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
    setDropdownOpen(false)
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <div className="size-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">C²</span>
            </div>
            <span className="font-bold text-lg text-slate-900 hidden sm:block">CampusCycle</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn('px-3 py-1.5 text-sm rounded-md transition-colors',
                    isActive ? 'text-emerald-700 bg-emerald-50 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                }
              >
                {link.label}
              </NavLink>
            ))}
            {user && (
              <NavLink
                to="/my-listings"
                className={({ isActive }) =>
                  cn('px-3 py-1.5 text-sm rounded-md transition-colors',
                    isActive ? 'text-emerald-700 bg-emerald-50 font-medium' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100')
                }
              >
                My Listings
              </NavLink>
            )}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Notifications */}
                <Link to="/notifications" className="relative p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
                  <Bell size={18} />
                  {!!unreadCount && <span className="absolute -right-0.5 -top-0.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </Link>
                {/* Wishlist */}
                <Link to="/wishlist" className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors hidden sm:flex">
                  <Heart size={18} />
                </Link>
                {/* List an item */}
                <Button size="sm" onClick={() => navigate('/listings/create')} className="hidden sm:flex">
                  <PlusCircle size={15} />
                  List an Item
                </Button>
                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setDropdownOpen(v => !v)}
                    className="flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <div className="size-7 rounded-full bg-emerald-100 text-emerald-700 font-semibold flex items-center justify-center text-xs">
                      {profile?.display_name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <span className="hidden sm:block text-slate-700 max-w-24 truncate">{profile?.display_name ?? 'Me'}</span>
                    <ChevronDown size={14} className="text-slate-400" />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-slate-200 shadow-lg py-1 z-50">
                      <Link to="/dashboard" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <LayoutDashboard size={15} /> Dashboard
                      </Link>
                      <Link to="/my-listings" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <Package size={15} /> My Listings
                      </Link>
                      <Link to="/profile" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <User size={15} /> Profile
                      </Link>
                      <Link to="/requests/buying" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <MessageSquareText size={15} /> My Requests
                      </Link>
                      <Link to="/requests/selling" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <Inbox size={15} /> Incoming Requests
                      </Link>
                      <Link to="/transactions" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <History size={15} /> Transactions
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-50">
                          <LayoutDashboard size={15} /> Admin Panel
                        </Link>
                      )}
                      <hr className="my-1 border-slate-100" />
                      <button onClick={handleSignOut} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 w-full">
                        <LogOut size={15} /> Sign Out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="outline" size="sm">Log In</Button>
                </Link>
                <Link to="/register" className="hidden sm:block">
                  <Button size="sm">Sign Up</Button>
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
              onClick={() => setMenuOpen(v => !v)}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-100 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                cn('block px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-700 hover:bg-slate-50')
              }
            >
              {link.label}
            </NavLink>
          ))}
          {user && (
            <>
              <NavLink to="/my-listings" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">My Listings</NavLink>
              <NavLink to="/wishlist" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Wishlist</NavLink>
              <NavLink to="/notifications" onClick={() => setMenuOpen(false)} className="block px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50">Notifications</NavLink>
              <button onClick={() => { navigate('/listings/create'); setMenuOpen(false) }} className="w-full text-left px-3 py-2 rounded-lg text-sm text-emerald-700 font-medium hover:bg-emerald-50">
                + List an Item
              </button>
            </>
          )}
        </div>
      )}
    </header>
  )
}
