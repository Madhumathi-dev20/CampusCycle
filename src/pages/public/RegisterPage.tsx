import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import toast from 'react-hot-toast'
import { Eye, EyeOff, CheckCircle } from 'lucide-react'

const registerSchema = z.object({
  display_name: z.string().min(2, 'Display name must be at least 2 characters').max(50),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string().min(1, 'Please confirm your password'),
  college_name: z.string().trim().min(2, 'Enter your college name').max(160, 'College name must be 160 characters or fewer'),
  branch: z.string().optional(),
  semester: z.coerce.number().min(1).max(8).optional(),
}).refine(data => data.password === data.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})
type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [done, setDone] = useState(false)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.input<typeof registerSchema>, unknown, RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          display_name: data.display_name,
          college_name: data.college_name,
          branch: data.branch ?? '',
          semester: data.semester?.toString() ?? '',
        },
      },
    })
    if (authError) { toast.error(authError.message); return }

    if (!authData.user?.id) { toast.error('Registration failed. Please try again.'); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">Check your email!</h2>
          <p className="text-sm text-slate-500 mb-6">
            We sent a verification link to your email. Click it to activate your account, then log in.
          </p>
          <Button onClick={() => navigate('/login')} className="w-full">Go to Login</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="size-12 bg-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold text-xl">C²</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Join CampusCycle</h1>
          <p className="text-sm text-slate-500 mt-1">Create your free student account</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Display Name"
              placeholder="How others will see you"
              error={errors.display_name?.message}
              {...register('display_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                placeholder="At least 8 characters"
                error={errors.password?.message}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-7 text-slate-400 hover:text-slate-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Input
              label="Confirm Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter your password"
              error={errors.confirm_password?.message}
              {...register('confirm_password')}
            />

            <Input
              label="College"
              placeholder="Enter your college name"
              error={errors.college_name?.message}
              {...register('college_name')}
            />

            <Input
              label="Branch / Department (optional)"
              placeholder="e.g. Computer Engineering"
              {...register('branch')}
            />

            <Select label="Semester (optional)" {...register('semester')}>
              <option value="">Select semester…</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </Select>

            <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
              Create Account
            </Button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-4">
            By signing up, you agree to our{' '}
            <Link to="/terms" className="text-emerald-600 hover:underline">Terms & Community Guidelines</Link>.
          </p>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
