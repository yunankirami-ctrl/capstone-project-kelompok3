import { createClient } from '@supabase/supabase-js'

// [TIM] KONEKSI SUPABASE - satunya tempat bikin client (singleton).
// Rekan-rekan, jangan bikin createClient baru di komponen lain ya. Semua page/file
// cukup `import { supabase } from '.../supabase.js'` biar cuma ada SATU klien Auth+DB
// se-apply dan session-nya konsisten.
// URL & anon key kita baca dari .env. Anon key memang boleh public (keamanannya
// dijaga RLS di database). YANG DILARANG keras: service_role key masuk ke kode frontend.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// [TIM] Validasi dini: kalau ada yang lupa isi .env, kita langsung kasih pesan yang
// JELAS di sini, bukan nanti error misterius "fetch failed" pas aplikasi udah jalan.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Konfigurasi Supabase belum lengkap. Cek VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di file .env, lalu restart server dev.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
