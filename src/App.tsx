import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ProtectedRoute } from '@/components/layout/ProtectedRoute'

// Public pages
import { HomePage } from '@/pages/public/HomePage'
import { ExplorePage } from '@/pages/public/ExplorePage'
import { ListingDetailPage } from '@/pages/public/ListingDetailPage'
import { LoginPage } from '@/pages/public/LoginPage'
import { RegisterPage } from '@/pages/public/RegisterPage'
import { AboutPage } from '@/pages/public/AboutPage'
import { ContactPage } from '@/pages/public/ContactPage'
import { TermsPage } from '@/pages/public/TermsPage'
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/public/PasswordResetPages'

// Student pages
import { DashboardPage } from '@/pages/student/DashboardPage'
import { MyListingsPage } from '@/pages/student/MyListingsPage'
import { CreateListingPage } from '@/pages/student/CreateListingPage'
import { EditListingPage } from '@/pages/student/EditListingPage'
import { WishlistPage } from '@/pages/student/WishlistPage'
import { NotificationsPage } from '@/pages/student/NotificationsPage'
import { ProfilePage } from '@/pages/student/ProfilePage'
import { RequestFormPage } from '@/pages/student/RequestFormPage'
import { RequestsPage } from '@/pages/student/RequestsPage'
import { TransactionsPage } from '@/pages/student/TransactionsPage'
import { AdminPage } from '@/pages/admin/AdminPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

function AppRoutes() {
  const initialize = useAuthStore(state => state.initialize)

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            {/* Public */}
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/listings/:id" element={<ListingDetailPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Protected Student Routes */}
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/my-listings" element={<ProtectedRoute><MyListingsPage /></ProtectedRoute>} />
            <Route path="/listings/create" element={<ProtectedRoute><CreateListingPage /></ProtectedRoute>} />
            <Route path="/listings/:id/edit" element={<ProtectedRoute><EditListingPage /></ProtectedRoute>} />
            <Route path="/wishlist" element={<ProtectedRoute><WishlistPage /></ProtectedRoute>} />
            <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/requests/new" element={<ProtectedRoute><RequestFormPage /></ProtectedRoute>} />
            <Route path="/requests/buying" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
            <Route path="/requests/selling" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute><TransactionsPage /></ProtectedRoute>} />
            <Route path="/admin/*" element={<ProtectedRoute adminOnly><AdminPage /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
      <Toaster position="top-right" />
    </BrowserRouter>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRoutes />
    </QueryClientProvider>
  )
}
