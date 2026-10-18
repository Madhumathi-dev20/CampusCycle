import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useNavigate } from 'react-router-dom'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCategories } from '@/hooks/useListings'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Upload, X, ImagePlus } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { resolveCollegeId } from '@/lib/colleges'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const schema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(120),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  listing_type: z.enum(['sell', 'donate', 'borrow']),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
  category_id: z.string().min(1, 'Select a category'),
  college_name: z.string().trim().min(2, 'Enter your college name').max(160, 'College name must be 160 characters or fewer'),
  exchange_location: z.string().optional(),
  sale_price: z.coerce.number().min(0, 'Price cannot be negative').optional(),
  borrowing_fee: z.coerce.number().min(0, 'Fee cannot be negative').optional(),
  refundable_deposit: z.coerce.number().min(0, 'Deposit cannot be negative').optional(),
  min_borrow_days: z.coerce.number().min(1, 'Minimum duration is one day').optional(),
  max_borrow_days: z.coerce.number().min(1, 'Maximum duration is one day').optional(),
}).superRefine((value, ctx) => {
  if (value.listing_type === 'sell' && value.sale_price === undefined) {
    ctx.addIssue({ code: 'custom', path: ['sale_price'], message: 'Enter a sale price' })
  }
  if (value.listing_type === 'borrow') {
    if (value.min_borrow_days === undefined) ctx.addIssue({ code: 'custom', path: ['min_borrow_days'], message: 'Enter a minimum duration' })
    if (value.max_borrow_days === undefined) ctx.addIssue({ code: 'custom', path: ['max_borrow_days'], message: 'Enter a maximum duration' })
    if (value.min_borrow_days !== undefined && value.max_borrow_days !== undefined && value.max_borrow_days < value.min_borrow_days) {
      ctx.addIssue({ code: 'custom', path: ['max_borrow_days'], message: 'Maximum duration must be at least the minimum' })
    }
  }
})
type CreateListingForm = z.output<typeof schema>

export function CreateListingPage() {
  const navigate = useNavigate()
  const { user, profile } = useAuthStore()
  const qc = useQueryClient()
  const { data: categories } = useCategories()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<z.input<typeof schema>, unknown, CreateListingForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      listing_type: 'sell',
      condition: 'good',
      college_name: profile?.college?.name ?? '',
    },
  })

  const listingType = watch('listing_type')

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) { toast.error(`${f.name}: only JPG, PNG, WebP allowed`); return false }
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name}: max 5MB per image`); return false }
      return true
    })
    const total = [...imageFiles, ...valid].slice(0, 5)
    setImageFiles(total)
    setImagePreviews(total.map(f => URL.createObjectURL(f)))
  }

  const removeImage = (i: number) => {
    setImageFiles(prev => prev.filter((_, idx) => idx !== i))
    setImagePreviews(prev => prev.filter((_, idx) => idx !== i))
  }

  const onSubmit = async (data: CreateListingForm) => {
    if (!user) return
    setUploading(true)

    let listingId: string | null = null
    const uploadedPaths: string[] = []

    try {
      const collegeId = await resolveCollegeId(data.college_name)
      // 1. Insert draft listing
      const { data: listing, error: listingError } = await supabase
        .from('listings')
        .insert({
          owner_id: user.id,
          college_id: collegeId,
          category_id: data.category_id,
          title: data.title,
          description: data.description,
          listing_type: data.listing_type,
          condition: data.condition,
          sale_price: data.listing_type === 'sell' ? (data.sale_price ?? null) : data.listing_type === 'donate' ? 0 : null,
          borrowing_fee: data.listing_type === 'borrow' ? (data.borrowing_fee ?? null) : null,
          refundable_deposit: data.listing_type === 'borrow' ? (data.refundable_deposit ?? null) : null,
          min_borrow_days: data.listing_type === 'borrow' ? (data.min_borrow_days ?? null) : null,
          max_borrow_days: data.listing_type === 'borrow' ? (data.max_borrow_days ?? null) : null,
          exchange_location: data.exchange_location ?? null,
          availability_status: 'draft',
        })
        .select()
        .single()

      if (listingError) throw listingError
      listingId = listing.id

      // 2. Upload images with rollback tracking
      if (imageFiles.length < 1) throw new Error('Upload at least one item image before publishing.')

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${user.id}/${listing.id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(path, file)
        if (uploadError) throw uploadError
        uploadedPaths.push(path)
        const { error: imageRowError } = await supabase.from('listing_images').insert({
          listing_id: listing.id,
          storage_path: path,
          display_order: i,
        })
        if (imageRowError) throw imageRowError
      }

      // 3. Publish
      const { error: publishError } = await supabase.rpc('publish_listing', { p_listing_id: listing.id })
      if (publishError) throw publishError

      qc.invalidateQueries({ queryKey: ['my-listings', user.id] })
      qc.invalidateQueries({ queryKey: ['listings'] })
      toast.success('Listing created!')
      navigate(`/listings/${listing.id}`)
    } catch (e: unknown) {
      // Rollback: remove uploaded storage files, then delete the draft listing
      if (uploadedPaths.length) {
        await supabase.storage.from('listing-images').remove(uploadedPaths)
      }
      if (listingId) {
        await supabase.from('listing_images').delete().eq('listing_id', listingId)
        await supabase.from('listings').delete().eq('id', listingId).eq('availability_status', 'draft')
      }
      toast.error(e instanceof Error ? e.message : 'Failed to create listing')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">List an Item</h1>
        <p className="text-sm text-slate-500 mt-1">Share your unused item with fellow students</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Type */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Listing Type</h2>
          <div className="grid grid-cols-3 gap-3">
            {(['sell', 'donate', 'borrow'] as const).map(type => (
              <label key={type} className="cursor-pointer">
                <input type="radio" value={type} {...register('listing_type')} className="sr-only" />
                <div className={`rounded-xl border-2 p-3 text-center transition-all ${listingType === type ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}>
                  <p className="text-sm font-semibold text-slate-800 capitalize">{type === 'sell' ? '💰 Sell' : type === 'donate' ? '🎁 Donate' : '🔄 Lend'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{type === 'sell' ? 'Set a price' : type === 'donate' ? 'Give for free' : 'Lend temporarily'}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Basic Info */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Item Details</h2>
          <Input label="Title" placeholder="e.g. Engineering Maths – S.K. Kachot (SEM 3)" error={errors.title?.message} {...register('title')} />
          <Textarea label="Description" rows={4} placeholder="Describe the item's condition, edition, what's included, etc." error={errors.description?.message} {...register('description')} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Category" error={errors.category_id?.message} {...register('category_id')}>
              <option value="">Select category…</option>
              {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Select label="Condition" error={errors.condition?.message} {...register('condition')}>
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
            </Select>
          </div>
          <Input label="College" placeholder="Enter your college name" error={errors.college_name?.message} {...register('college_name')} />
          <Input label="Exchange Location (optional)" placeholder="e.g. Library entrance, Canteen, Gate 2" {...register('exchange_location')} />
        </div>

        {/* Sell fields */}
        {listingType === 'sell' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Pricing</h2>
            <Input
              label="Sale Price (₹)"
              type="number"
              min="0"
              placeholder="0"
              error={errors.sale_price?.message}
              {...register('sale_price')}
            />
          </div>
        )}

        {/* Borrow fields */}
        {listingType === 'borrow' && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Borrowing Terms</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Borrowing Fee per day (₹, optional)" type="number" min="0" placeholder="0 = free" {...register('borrowing_fee')} />
              <Input label="Refundable Deposit (₹, optional)" type="number" min="0" placeholder="0" {...register('refundable_deposit')} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Input label="Minimum Borrow Days" type="number" min="1" placeholder="1" error={errors.min_borrow_days?.message} {...register('min_borrow_days')} />
              <Input label="Maximum Borrow Days" type="number" min="1" placeholder="30" error={errors.max_borrow_days?.message} {...register('max_borrow_days')} />
            </div>
          </div>
        )}

        {/* Images */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Photos <span className="text-slate-400 font-normal">(up to 5)</span></h2>
          <div className="flex flex-wrap gap-3">
            {imagePreviews.map((src, i) => (
              <div key={i} className="relative size-24 rounded-xl overflow-hidden border border-slate-200">
                <img src={src} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => removeImage(i)}
                  className="absolute top-1 right-1 size-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <X size={10} />
                </button>
              </div>
            ))}
            {imagePreviews.length < 5 && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="size-24 rounded-xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition-colors"
              >
                <ImagePlus size={20} />
                <span className="text-xs">Add Photo</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            multiple
            className="hidden"
            onChange={handleImageSelect}
          />
          <p className="text-xs text-slate-400">JPG, PNG or WebP · Max 5MB each · Up to 5 photos</p>
        </div>

        {/* Submit */}
        <Button type="submit" size="lg" loading={isSubmitting || uploading} className="w-full">
          <Upload size={18} /> Publish Listing
        </Button>
      </form>
    </div>
  )
}
