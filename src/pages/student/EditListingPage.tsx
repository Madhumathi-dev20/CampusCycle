import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImagePlus, X, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useCategories, useListing } from '@/hooks/useListings'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Card'
import { getImageUrl } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'
import { resolveCollegeId } from '@/lib/colleges'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const schema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(1000),
  listing_type: z.enum(['sell', 'donate', 'borrow']),
  condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
  category_id: z.string().min(1),
  college_name: z.string().trim().min(2, 'Enter your college name').max(160, 'College name must be 160 characters or fewer'),
  exchange_location: z.string().optional(),
  sale_price: z.coerce.number().min(0).optional(),
  borrowing_fee: z.coerce.number().min(0).optional(),
  refundable_deposit: z.coerce.number().min(0).optional(),
  min_borrow_days: z.coerce.number().min(1).optional(),
  max_borrow_days: z.coerce.number().min(1).optional(),
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
type FormInput = z.input<typeof schema>
type FormOutput = z.output<typeof schema>

export function EditListingPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const { data: listing, isLoading } = useListing(id)
  const { data: categories } = useCategories()
  const fileRef = useRef<HTMLInputElement>(null)
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<FormInput, unknown, FormOutput>({
    resolver: zodResolver(schema),
  })
  const listingType = watch('listing_type')

  useEffect(() => {
    if (!listing) return
    reset({
      title: listing.title, description: listing.description,
      listing_type: listing.listing_type, condition: listing.condition,
      category_id: listing.category_id, college_name: listing.college?.name ?? '',
      exchange_location: listing.exchange_location ?? '',
      sale_price: listing.sale_price ?? undefined,
      borrowing_fee: listing.borrowing_fee ?? undefined,
      refundable_deposit: listing.refundable_deposit ?? undefined,
      min_borrow_days: listing.min_borrow_days ?? undefined,
      max_borrow_days: listing.max_borrow_days ?? undefined,
    })
  }, [listing, reset])

  if (isLoading) return <div className="max-w-2xl mx-auto px-4 py-8 space-y-4"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-96" /></div>
  if (!listing || listing.owner_id !== user?.id) return <div className="max-w-2xl mx-auto px-4 py-16 text-center"><h1 className="font-bold text-xl">Listing unavailable</h1><Button className="mt-4" onClick={() => navigate('/my-listings')}>Back to My Listings</Button></div>
  if (listing.availability_status === 'reserved' || ['sold', 'donated'].includes(listing.availability_status)) return <div className="max-w-2xl mx-auto px-4 py-16 text-center"><h1 className="font-bold text-xl">This listing can’t be edited right now</h1><p className="text-slate-500 mt-2">It has an active or completed transaction.</p><Button className="mt-4" onClick={() => navigate('/my-listings')}>Back to My Listings</Button></div>

  const activeImages = listing.listing_images?.filter(image => !removedImageIds.includes(image.id)) ?? []
  const selectImages = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []).filter(file => {
      if (!ALLOWED_TYPES.includes(file.type) || file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: use JPG, PNG, or WebP up to 5MB`)
        return false
      }
      return true
    })
    const room = Math.max(0, 5 - activeImages.length - newFiles.length)
    const files = [...newFiles, ...picked.slice(0, room)]
    setNewFiles(files)
    setPreviews(files.map(file => URL.createObjectURL(file)))
    event.target.value = ''
  }

  const save = async (data: FormOutput) => {
    if (!user) return
    setSaving(true)
    const uploadedPaths: string[] = []
    try {
      const collegeId = await resolveCollegeId(data.college_name)
      const { error: updateError } = await supabase.from('listings').update({
        title: data.title,
        description: data.description,
        listing_type: data.listing_type,
        condition: data.condition,
        category_id: data.category_id,
        college_id: collegeId,
        exchange_location: data.exchange_location || null,
        sale_price: data.listing_type === 'sell' ? data.sale_price ?? null : data.listing_type === 'donate' ? 0 : null,
        borrowing_fee: data.listing_type === 'borrow' ? data.borrowing_fee ?? null : null,
        refundable_deposit: data.listing_type === 'borrow' ? data.refundable_deposit ?? null : null,
        min_borrow_days: data.listing_type === 'borrow' ? data.min_borrow_days ?? null : null,
        max_borrow_days: data.listing_type === 'borrow' ? data.max_borrow_days ?? null : null,
      }).eq('id', id).eq('owner_id', user.id)
      if (updateError) throw updateError

      for (const imageId of removedImageIds) {
        const { data: image } = await supabase.from('listing_images').select('storage_path').eq('id', imageId).single()
        if (image?.storage_path) await supabase.storage.from('listing-images').remove([image.storage_path])
        const { error } = await supabase.from('listing_images').delete().eq('id', imageId)
        if (error) throw error
      }

      for (let index = 0; index < newFiles.length; index++) {
        const file = newFiles[index]
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const storagePath = `${user.id}/${id}/${crypto.randomUUID()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('listing-images').upload(storagePath, file)
        if (uploadError) throw uploadError
        uploadedPaths.push(storagePath)
        const { error: imageError } = await supabase.from('listing_images').insert({
          listing_id: id, storage_path: storagePath, display_order: activeImages.length + index,
        })
        if (imageError) throw imageError
      }

      const { data: finalImages, error: imageFetchError } = await supabase.from('listing_images').select('id').eq('listing_id', id)
      if (imageFetchError) throw imageFetchError
      if (!finalImages?.length) throw new Error('A listing must have at least one image.')
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['listing', id] }),
        qc.invalidateQueries({ queryKey: ['my-listings', user.id] }),
        qc.invalidateQueries({ queryKey: ['listings'] }),
      ])
      toast.success('Listing updated')
      navigate(`/listings/${id}`)
    } catch (error) {
      if (uploadedPaths.length) await supabase.storage.from('listing-images').remove(uploadedPaths)
      toast.error(error instanceof Error ? error.message : 'Could not update listing')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-1">Edit Listing</h1>
      <p className="text-sm text-slate-500 mb-6">Update your item details and photos.</p>
      <form onSubmit={handleSubmit(save)} className="space-y-5">
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(['sell', 'donate', 'borrow'] as const).map(type => <label key={type} className="cursor-pointer"><input type="radio" value={type} {...register('listing_type')} className="sr-only" /><span className={`block rounded-lg border-2 p-3 text-center text-sm capitalize ${listingType === type ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200'}`}>{type}</span></label>)}
          </div>
          <Input label="Title" error={errors.title?.message} {...register('title')} />
          <Textarea label="Description" rows={4} error={errors.description?.message} {...register('description')} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Select label="Category" error={errors.category_id?.message} {...register('category_id')}><option value="">Select category</option>{categories?.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</Select>
            <Select label="Condition" {...register('condition')}><option value="new">New</option><option value="like_new">Like New</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option></Select>
          </div>
          <Input label="College" placeholder="Enter your college name" error={errors.college_name?.message} {...register('college_name')} />
          <Input label="Exchange location" {...register('exchange_location')} />
        </section>
        {listingType === 'sell' && <section className="bg-white border border-slate-200 rounded-xl p-5"><Input label="Sale price (₹)" type="number" min="0" error={errors.sale_price?.message} {...register('sale_price')} /></section>}
        {listingType === 'borrow' && <section className="bg-white border border-slate-200 rounded-xl p-5 grid sm:grid-cols-2 gap-4"><Input label="Fee per day (₹)" type="number" min="0" {...register('borrowing_fee')} /><Input label="Refundable deposit (₹)" type="number" min="0" {...register('refundable_deposit')} /><Input label="Minimum days" type="number" min="1" {...register('min_borrow_days')} /><Input label="Maximum days" type="number" min="1" {...register('max_borrow_days')} /></section>}
        <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold">Photos <span className="font-normal text-slate-500">(1–5 required)</span></h2>
          <div className="flex flex-wrap gap-3">
            {activeImages.map(image => <div key={image.id} className="relative size-20 rounded-lg overflow-hidden border"><img src={getImageUrl(image.storage_path)} alt="Listing" className="w-full h-full object-cover" /><button type="button" onClick={() => setRemovedImageIds(ids => [...ids, image.id])} className="absolute top-1 right-1 size-5 bg-red-600 text-white rounded-full grid place-items-center" aria-label="Remove image"><X size={12} /></button></div>)}
            {previews.map((src, index) => <div key={src} className="relative size-20 rounded-lg overflow-hidden border"><img src={src} alt={`New upload ${index + 1}`} className="w-full h-full object-cover" /><button type="button" onClick={() => { setNewFiles(files => files.filter((_, i) => i !== index)); setPreviews(items => items.filter((_, i) => i !== index)) }} className="absolute top-1 right-1 size-5 bg-red-600 text-white rounded-full grid place-items-center" aria-label="Remove new image"><X size={12} /></button></div>)}
            {activeImages.length + newFiles.length < 5 && <button type="button" onClick={() => fileRef.current?.click()} className="size-20 rounded-lg border-2 border-dashed grid place-items-center text-slate-500"><ImagePlus size={20} /></button>}
          </div>
          <input ref={fileRef} type="file" accept={ALLOWED_TYPES.join(',')} multiple className="hidden" onChange={selectImages} />
        </section>
        <Button type="submit" size="lg" loading={saving} className="w-full"><Upload size={16} /> Save Changes</Button>
      </form>
    </div>
  )
}
