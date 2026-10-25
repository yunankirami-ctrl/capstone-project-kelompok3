<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/supabase.js'
import { toast } from '../composables/useToast.js'
import { ROLE_OPTIONS, ROLES } from '../data/roles.js'

const props = defineProps({
  user: { type: Object, required: true } // Admin yang lagi login, dipakai biar nggak turunin role diri sendiri pas login.
})

const allUsers = ref([])
const loading = ref(true)
const errorMessage = ref('')

// Ambil daftar semua user.
const fetchAllUsers = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('username', { ascending: true })

    if (error) throw error
    allUsers.value = data || []
  } catch (err) {
    errorMessage.value = 'Gagal memuat daftar pengguna: ' + err.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchAllUsers)

// Huruf awal untuk avatar inisial di kartu pengguna.
const userInitials = (u) => {
  const name = (u.full_name || u.username || '?').trim()
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

// Ganti role pengguna. tapi admin gabisa ganti role diri sendiri
// biar nggak gak dikunci keluar dari panel admin tanpa sengaja.
const updateUserRole = async (userId, newRole) => {
  if (userId === props.user.id && newRole !== ROLES.ADMIN) {
    toast.error('Anda tidak bisa menurunkan role diri sendiri. Gunakan akun admin lain.')
    return
  }

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error

    toast.success('Role berhasil diperbarui!')
    await fetchAllUsers()
  } catch (err) {
    toast.error('Gagal mengubah role: ' + err.message)
  }
}
</script>

<template>
  <div class="dashboard-card admin-card">
    <h2>Kelola Role Pengguna</h2>

    <!-- Daftar Pengguna + ganti role -->
    <div class="sub-panel">
      <div class="list-header">
        <h3>Daftar Pengguna</h3>
        <button class="btn-nav" @click="fetchAllUsers" :disabled="loading"><span v-if="loading" class="btn-spinner" aria-hidden="true"></span>{{ loading ? 'Memuat...' : 'Muat Ulang' }}</button>
      </div>

      <div v-if="loading" class="state-text">Memuat data...</div>
      <p v-else-if="errorMessage" class="state-text error">{{ errorMessage }}</p>

      <!-- Daftar pengguna versi kartu: tanpa scroll horizontal di HP, rapi di desktop. -->
      <ul v-else-if="allUsers.length > 0" class="user-list">
        <li v-for="u in allUsers" :key="u.id" class="user-row">
          <span class="avatar-initials avatar-sm" aria-hidden="true">{{ userInitials(u) }}</span>
          <div class="user-meta">
            <strong>{{ u.username }}</strong>
            <span>{{ u.full_name || 'Nama belum diisi' }}</span>
          </div>
          <span :class="['role-tag', u.role]">{{ u.role }}</span>
          <!-- Dropdown role; nilai current di-binding biar tetep sesuai data terbaru abis fetch ulang. -->
          <select
            :value="u.role"
            :title="'Ubah role ' + u.username"
            @change="e => updateUserRole(u.id, e.target.value)"
          >
            <option v-for="r in ROLE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
          </select>
        </li>
      </ul>

      <p v-else class="empty-state">Belum ada pengguna terdaftar.</p>
    </div>
  </div>
</template>

<style scoped>
/* Style khusus panel admin; kelas form/tabel umum udah ada di style.css global. */
.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.list-header h3 {
  margin: 0;
}

.state-text {
  text-align: center;
  color: #6b7280;
  padding: 16px 0;
}

.state-text.error {
  color: #ef4444;
}

/* Kartu daftar pengguna */
.user-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--radius-card);
  padding: 12px 14px;
}

.user-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.user-meta strong {
  color: #1e293b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-meta span {
  font-size: 0.82rem;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-row select {
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: white;
  font-family: inherit;
  font-size: 0.9rem;
  color: #334155;
  cursor: pointer;
}

.user-row select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}

@media (max-width: 640px) {
  .user-row {
    flex-wrap: wrap;
    row-gap: 10px;
  }

  /* Baris 1: avatar + nama; baris 2: role tag + dropdown melebar. */
  .user-meta {
    flex: 1 1 calc(100% - 56px);
  }

  .user-row .role-tag {
    order: 3;
  }

  .user-row select {
    order: 4;
    flex: 1;
    min-width: 0;
  }
}
</style>
