// [TIM] ROLE USER (murid / guru / admin) - dipakai buat ngatur hak akses menu/tab.
// App.vue dan panel-panel cek lewat helper di bawah ini. NILAI-NYA WAJIB SAMA dengan
// check constraint role di tabel profiles Supabase ('murid', 'guru', 'admin').

export const ROLES = {
  MURID: 'murid',
  GURU: 'guru',
  ADMIN: 'admin'
}

// [TIM] Opsi role buat dropdown "ubah role" di panel admin.
export const ROLE_OPTIONS = [
  { value: ROLES.MURID, label: 'Murid' },
  { value: ROLES.GURU, label: 'Guru' },
  { value: ROLES.ADMIN, label: 'Administrator' }
]

// [TIM] isStaff = true kalau user boleh buka panel bikin kuis (guru ATAU admin).
export const isStaff = (user) => user?.role === ROLES.GURU || user?.role === ROLES.ADMIN

// [TIM] isAdmin = true kalau user boleh buka panel kelola pengguna.
export const isAdmin = (user) => user?.role === ROLES.ADMIN
