import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const emailSchema = z.object({ email: z.string().email('Enter a valid email') })
const passwordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(values => values.password === values.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match' })

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) })
  const submit = async ({ email }: z.infer<typeof emailSchema>) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    if (error) { toast.error(error.message); return }
    setSent(true)
  }
  return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12"><div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
    <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1><p className="text-sm text-slate-500 mt-1 mb-6">We’ll email you a secure password reset link.</p>
    {sent ? <div className="text-center py-4"><CheckCircle size={40} className="text-emerald-600 mx-auto mb-3" /><p className="text-sm text-slate-600">If an account exists for that email, a reset link has been sent.</p><Link to="/login" className="text-sm text-emerald-700 inline-block mt-4">Back to login</Link></div> : <form className="space-y-4" onSubmit={handleSubmit(submit)}><Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} /><Button type="submit" loading={isSubmitting} className="w-full">Send reset link</Button></form>}
  </div></div>
}

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [complete, setComplete] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) })
  const submit = async ({ password }: z.infer<typeof passwordSchema>) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { toast.error(error.message); return }
    setComplete(true)
    toast.success('Password updated')
    await supabase.auth.signOut()
  }
  return <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12"><div className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
    {complete ? <div className="text-center"><CheckCircle size={40} className="text-emerald-600 mx-auto mb-3" /><h1 className="text-xl font-bold">Password updated</h1><p className="text-sm text-slate-500 mt-2 mb-4">Sign in with your new password.</p><Button className="w-full" onClick={() => navigate('/login')}>Go to login</Button></div> : <><h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1><p className="text-sm text-slate-500 mt-1 mb-6">Use at least eight characters.</p><form className="space-y-4" onSubmit={handleSubmit(submit)}><Input label="New password" type="password" autoComplete="new-password" error={errors.password?.message} {...register('password')} /><Input label="Confirm password" type="password" autoComplete="new-password" error={errors.confirm_password?.message} {...register('confirm_password')} /><Button type="submit" loading={isSubmitting} className="w-full">Update password</Button></form></>}
  </div></div>
}
