export const ROLES = {
  MURID: 'murid',
  GURU: 'guru',
  ADMIN: 'admin'
}

// Opsi role di panel admin.
export const ROLE_OPTIONS = [
  { value: ROLES.MURID, label: 'Murid' },
  { value: ROLES.GURU, label: 'Guru' },
  { value: ROLES.ADMIN, label: 'Administrator' }
]

// Kalau user boleh buka panel bikin kuis.
export const isStaff = (user) => user?.role === ROLES.GURU || user?.role === ROLES.ADMIN

// Kalau user boleh buka panel kelola pengguna.
export const isAdmin = (user) => user?.role === ROLES.ADMIN
