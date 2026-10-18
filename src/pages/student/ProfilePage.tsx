import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { useWorkflowAction } from '@/hooks/useMarketplace'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { resolveCollegeId } from '@/lib/colleges'

const profileSchema = z.object({
  display_name: z.string().trim().min(2).max(50),
  college_name: z.string().trim().min(2, 'Enter your college name').max(160, 'College name must be 160 characters or fewer'),
  branch: z.string().max(100).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
})
type ProfileFormInput = z.input<typeof profileSchema>
type ProfileForm = z.output<typeof profileSchema>

export function ProfilePage() {
  const { profile, user, fetchProfile } = useAuthStore()
  const [deleting, setDeleting] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const deactivate = useWorkflowAction()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileFormInput, unknown, ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile ? {
      display_name: profile.display_name,
      college_name: profile.college?.name ?? '',
      branch: profile.branch ?? '',
      semester: profile.semester ?? undefined,
    } : undefined,
  })

  const save = async (values: ProfileForm) => {
    if (!user) return
    let collegeId: string
    try {
      collegeId = await resolveCollegeId(values.college_name)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save college name')
      return
    }
    const { error } = await supabase.from('profiles').update({
      display_name: values.display_name,
      college_id: collegeId,
      branch: values.branch || null,
      semester: values.semester ?? null,
    }).eq('id', user.id)
    if (error) { toast.error(error.message); return }
    await fetchProfile(user.id)
    toast.success('Profile updated')
  }

  const deactivateAccount = async () => {
    if (!user || !window.confirm('Deactivate your account? Your available listings will be hidden and pending requests cancelled. This cannot be undone from the app.')) return
    setDeleting(true)
    try {
      await deactivate.mutateAsync({ action: 'deactivate_account' })
      await supabase.auth.signOut()
      queryClient.clear()
      toast.success('Account deactivated')
      navigate('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not deactivate account')
    } finally { setDeleting(false) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6"><h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1><p className="text-sm text-slate-500 mt-1">Manage the information shown on your student profile.</p></div>
      <Card className="p-6 mb-5">
        <div className="flex items-center gap-4 pb-4 border-b border-slate-100 mb-5"><div className="size-16 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xl flex items-center justify-center">{profile?.display_name?.[0]?.toUpperCase() ?? 'U'}</div><div><h2 className="text-lg font-bold text-slate-900">{profile?.display_name ?? 'Student'}</h2><p className="text-sm text-slate-500">{profile?.college_verified_at ? 'College email verified' : 'College membership is not verified'}</p></div></div>
        <form className="space-y-4" onSubmit={handleSubmit(save)}>
          <Input label="Display name" error={errors.display_name?.message} {...register('display_name')} />
          <div className="flex items-center gap-2 text-xs text-slate-500"><Mail size={14} />Email is used for sign-in and is never shown on public listings.</div>
          <Input label="College" placeholder="Enter your college name" error={errors.college_name?.message} {...register('college_name')} />
          <Input label="Branch / department" error={errors.branch?.message} {...register('branch')} />
          <Select label="Semester" error={errors.semester?.message} {...register('semester')}><option value="">Not specified</option>{Array.from({ length: 12 }, (_, index) => index + 1).map(value => <option key={value} value={value}>Semester {value}</option>)}</Select>
          <Button type="submit" loading={isSubmitting}>Save Profile</Button>
        </form>
      </Card>
      <Card className="p-6 border-red-200">
        <h2 className="font-semibold text-red-700 flex items-center gap-2"><AlertTriangle size={17} /> Deactivate account</h2>
        <p className="text-sm text-slate-600 mt-2 mb-4">Your public profile and available listings will be hidden. Pending requests will be cancelled. Completed transaction records are retained for accountability.</p>
        <Button variant="danger" size="sm" loading={deleting} onClick={deactivateAccount}>Deactivate my account</Button>
      </Card>
    </div>
  )
}
