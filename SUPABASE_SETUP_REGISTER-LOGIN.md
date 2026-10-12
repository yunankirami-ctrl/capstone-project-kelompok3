# Supabase Setup untuk Register dan Login

## 1. Isi Environment Variable

Buka file `.env`, lalu masukkan URL dan Anon Key dari Supabase.

ambil datanya di **Supabase Dashboard → Project Settings → API**.

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=ANON_KEY_DARI_SUPABASE
```

Simpan file `.env` dan restart server Vite supaya perubahan konfigurasinya terbaca.

## 2. Buat Tabel Profiles

Membuat tabel `profiles` untuk menyimpan data tambahan user, seperti username, nama lengkap, role, dan poin.

Buka **Supabase Dashboard → SQL Editor → New query**, lalu jalankan kode SQL berikut.

```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  role text not null default 'murid' check (role in ('murid', 'guru', 'admin')),
  points integer not null default 0
);
```

Tabel ini nantinya terhubung dengan data user yang ada di Supabase Auth. Jadi, data login dan password tetap dikelola oleh Supabase, sedangkan data tambahan user disimpan di tabel `profiles`.

## 3. Buat Profile Otomatis Setelah Register

Supaya kita nggak perlu membuat profile secara manual setiap ada user baru, kita bisa menggunakan trigger di Supabase.

Trigger ini akan otomatis membuat data profile setelah user berhasil melakukan Register. Username dan nama lengkap akan diambil dari metadata saat proses `signUp()`.

Jalankan kode berikut di SQL Editor.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, role, points)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'murid',
    0
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

Dengan cara ini, setiap user baru akan mendapatkan profile secara otomatis, termasuk ketika konfirmasi email masih aktif.

Role awalnya akan menjadi `murid` dan poinnya dimulai dari `0`.

## 4. Aktifkan Row Level Security (RLS)

Berikutnya, kita perlu mengaktifkan RLS supaya akses ke tabel `profiles` bisa dibatasi sesuai hak akses masing-masing user.

Jalankan kode berikut di SQL Editor.

```sql
alter table public.profiles enable row level security;

-- Fungsi untuk mengecek apakah user memiliki role admin.
-- Dibuat terpisah supaya pengecekan admin tidak terkena recursion policy profiles.

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create policy "user dapat membaca profile sendiri atau admin membaca semua"
on public.profiles for select
to authenticated
using (auth.uid() = id or public.is_admin());

create policy "admin dapat mengubah profile"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());
```

Penjelasan singkatnya:

* User biasa hanya bisa membaca profile miliknya sendiri.
* Admin bisa membaca semua profile.
* Hanya admin yang bisa mengubah data profile melalui policy update ini.

## 5. Atur Konfirmasi Email

Sekarang kita atur bagian email supaya proses Register dan Login bisa diuji.

Buka **Supabase Dashboard → Authentication → Providers → Email**.

* Aktifkan Email provider.
* Kalau di testing lokal, konfirmasi email bisa dimatikan dulu sementara untuk lebih mudah menguji Register dan Login.
* Kalau aplikasi sudah digunakan sungguhan, konfirmasi email sebaiknya diaktifkan.


## 6. Jalankan dan Tes Aplikasi

Kalau semua konfigurasi sudah selesai, jalankan aplikasi dengan perintah berikut.

```bash
npm run dev
```

Setelah aplikasinya berjalan, lakukan pengujian dengan urutan berikut:

1. Coba Register menggunakan akun baru.
2. Cek apakah user sudah masuk ke **Supabase Dashboard → Authentication → Users**.
3. Cek apakah profile otomatis dibuat di tabel `profiles`.
4. Kalau konfirmasi email aktif, konfirmasi email terlebih dahulu.
5. Coba Login menggunakan akun yang sudah terdaftar.

Kalau semua langkah berhasil, berarti koneksi Register dan Login ke Supabase sudah berjalan sesuai konfigurasi.

## Catatan Migrasi Akun Lama

Password lama yang sebelumnya disimpan di tabel `profiles` sudah tidak digunakan lagi untuk proses Login. Sekarang, autentikasi ditangani oleh Supabase Auth.

Untuk akun guru dan admin, sebaiknya pembuatan akun dilakukan manual melalui Supabase Dashboard → Authentication → Users atau melalui Edge Function di sisi server.

Setelah akun dibuat, role-nya bisa diubah menjadi `guru` atau `admin` di tabel `profiles` oleh pihak yang berwenang.

