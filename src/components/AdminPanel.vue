<script setup>
// [TIM] PANEL ADMIN - khusus ngatur ROLE pengguna (Tab "Kelola Role").
// Fungsinya:
//   - Nampilin daftar semua pengguna (cuma admin yang boleh baca semua profile,
//     aturannya lewat RLS policy di Supabase).
//   - Ganti role murid/guru/admin lewat dropdown -> update tabel `profiles`.
// NOTE: bikin akun baru SENGAJA nggak diurus di halaman ini (itu urusan Supabase
// Dashboard), jadi panel aku fokusin 100% ke manajemen role.

import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/supabase.js'
import { toast } from '../composables/useToast.js'
import { ROLE_OPTIONS, ROLES } from '../data/roles.js'

const props = defineProps({
  user: { type: Object, required: true } // [TIM] Admin yang lagi login, dipakai biar nggak turunin role diri sendiri.
})

const allUsers = ref([])
const loading = ref(true)
const errorMessage = ref('')

// [TIM] Ambil daftar semua user (policy RLS "admin membaca semua profile").
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

// [TIM] Ganti role pengguna. Proteksinya: admin nggak boleh turunin role dirinya sendiri
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

    <!-- [TIM] Daftar Pengguna + ganti role -->
    <div class="sub-panel">
      <div class="list-header">
        <h3>Daftar Pengguna</h3>
        <button class="btn-nav" @click="fetchAllUsers" :disabled="loading"><span v-if="loading" class="btn-spinner" aria-hidden="true"></span>{{ loading ? 'Memuat...' : 'Muat Ulang' }}</button>
      </div>

      <div v-if="loading" class="state-text">Memuat data...</div>
      <p v-else-if="errorMessage" class="state-text error">{{ errorMessage }}</p>

      <!-- [TIM] Wrapper .table-scroll: di layar HP tabelnya bisa digeser horizontal,
           bukan malah gepes/meleber keluar. Rantai v-else-if ikut dipindah ke sini. -->
      <div v-else-if="allUsers.length > 0" class="table-scroll">
        <table class="styled-table">
        <thead>
          <tr>
            <th>Nama</th>
            <th>Username</th>
            <th>Role</th>
            <th>Aksi Ubah Role</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in allUsers" :key="u.id">
            <td>{{ u.full_name || '-' }}</td>
            <td><strong>{{ u.username }}</strong></td>
            <td><span :class="['role-tag', u.role]">{{ u.role }}</span></td>
            <td>
              <!-- [TIM] Dropdown role; nilai current di-binding biar tetep sesuai data terbaru abis fetch ulang. -->
              <select :value="u.role" @change="e => updateUserRole(u.id, e.target.value)">
                <option v-for="r in ROLE_OPTIONS" :key="r.value" :value="r.value">{{ r.label }}</option>
              </select>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <p v-else class="state-text">Belum ada pengguna terdaftar.</p>
    </div>
  </div>
</template>

<style scoped>
/* [TIM] Style khusus panel admin; kelas form/tabel umum udah ada di style.css global. */
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
</style>
