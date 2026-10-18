import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  profile: Profile | null
  isAdmin: boolean
  session: Session | null
  loading: boolean
  initialized: boolean
  setSession: (session: Session | null) => void
  setProfile: (profile: Profile | null) => void
  fetchProfile: (userId: string) => Promise<void>
  signOut: () => Promise<void>
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isAdmin: false,
  session: null,
  loading: true,
  initialized: false,

  setSession: (session) => {
    set({ session, user: session?.user ?? null })
  },

  setProfile: (profile) => set({ profile }),

  fetchProfile: async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, college:colleges(id, name, location)')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('[Auth] Failed to fetch profile:', error.message)
      set({ profile: null, isAdmin: false })
      return
    }
    const { data: isAdmin, error: roleError } = await supabase.rpc('is_admin')
    if (roleError) console.error('[Auth] Failed to resolve administrator status:', roleError.message)
    set({ profile: data as Profile, isAdmin: isAdmin === true })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null, isAdmin: false, session: null })
  },

  initialize: async () => {
    // Get existing session
    const { data: { session } } = await supabase.auth.getSession()
    set({ session, user: session?.user ?? null })

    if (session?.user) {
      await get().fetchProfile(session.user.id)
    }

    // Listen for auth state changes
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, user: session?.user ?? null })
      if (session?.user) {
        await get().fetchProfile(session.user.id)
      } else {
        set({ profile: null, isAdmin: false })
      }
    })

    set({ loading: false, initialized: true })
  },
}))
