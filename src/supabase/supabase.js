import { createClient } from '@supabase/supabase-js'
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Validasi .env supabase
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Konfigurasi Supabase belum lengkap. Cek VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env, lalu restart server dev.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
