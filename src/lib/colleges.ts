import { supabase } from '@/lib/supabase'

export async function resolveCollegeId(name: string): Promise<string> {
  const { data, error } = await supabase.rpc('resolve_college_id', {
    p_name: name.trim(),
  })
  if (error) throw error
  if (typeof data !== 'string') throw new Error('Could not resolve the college name')
  return data
}
