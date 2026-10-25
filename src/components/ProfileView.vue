<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase } from '../supabase/supabase.js'
import { ROLES } from '../data/roles.js'
import { toast } from '../composables/useToast.js'

const props = defineProps({
  user: { type: Object, required: true }
})

const emit = defineEmits(['profile-updated'])

// ===== Riwayat nilai & statistik =====
const attempts = ref([])
const loadingStats = ref(true)
const statsError = ref('')

// Huruf awal nama untuk avatar inisial (maks 2 kata).
const initials = computed(() => {
  const name = (props.user.full_name || props.user.username || '?').trim()
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
})

const stats = computed(() => {
  const count = attempts.value.length
  const avg = count ? Math.round(attempts.value.reduce((sum, a) => sum + a.score, 0) / count) : 0
  const best = count ? Math.max(...attempts.value.map((a) => a.score)) : 0
  return { count, avg, best }
})

const fetchAttempts = async () => {
  loadingStats.value = true
  statsError.value = ''
  try {
    // RLS hanya mengizinkan user membaca attempt miliknya sendiri.
    const { data, error } = await supabase
      .from('quiz_attempts')
      .select('id, score, attempted_at, quizzes(title)')
      .eq('user_id', props.user.id)
      .order('attempted_at', { ascending: false })
      .limit(50)

    if (error) throw error
    attempts.value = (data || []).map((a) => ({
      ...a,
      quizTitle: a.quizzes?.title || 'Kuis sudah terhapus'
    }))
  } catch (err) {
    statsError.value = 'Gagal memuat riwayat nilai: ' + err.message
  } finally {
    loadingStats.value = false
  }
}

onMounted(fetchAttempts)

const formatDateTime = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// ===== Ubah nama lengkap =====
const editingName = ref(false)
const editName = ref('')
const savingName = ref(false)

const startEditName = () => {
  editName.value = props.user.full_name || props.user.username || ''
  editingName.value = true
}

const saveName = async () => {
  const val = editName.value.trim()
  if (!val) return toast.error('Nama tidak boleh kosong.')
  if (val === props.user.full_name) {
    editingName.value = false
    return
  }

  savingName.value = true
  try {
    // Function SECURITY DEFINER — murid cuma boleh sentuh barisnya sendiri,
    // dan kolom role/points tidak bisa diakses lewat jalur ini.
    const { error } = await supabase.rpc('update_own_name', { new_name: val })
    if (error) throw error

    emit('profile-updated', { full_name: val })
    toast.success('Nama berhasil diperbarui.')
    editingName.value = false
  } catch (err) {
    toast.error('Gagal memperbarui nama: ' + err.message)
  } finally {
    savingName.value = false
  }
}

// ===== Ubah password =====
const showPassForm = ref(false)
const newPassword = ref('')
const confirmPassword = ref('')
const changingPass = ref(false)

const handleChangePassword = async () => {
  if (newPassword.value.length < 6) return toast.error('Password baru minimal 6 karakter.')
  if (newPassword.value !== confirmPassword.value) return toast.error('Konfirmasi password tidak sama.')

  changingPass.value = true
  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword.value })
    if (error) throw error

    toast.success('Password berhasil diganti.')
    newPassword.value = ''
    confirmPassword.value = ''
    showPassForm.value = false
  } catch (err) {
    toast.error('Gagal ganti password: ' + err.message)
  } finally {
    changingPass.value = false
  }
}
</script>

<template>
  <div class="profile-page">
    <!-- Kartu identitas -->
    <section class="profile-hero">
      <span class="avatar-initials avatar-xl">{{ initials }}</span>
      <div class="hero-info">
        <h2>{{ user.full_name || user.username }}</h2>
        <p class="hero-username">@{{ user.username }}</p>
        <div class="hero-meta">
          <span :class="['role-tag', user.role]">{{ user.role }}</span>
          <span class="hero-points">{{ user.points || 0 }} XP</span>
        </div>
      </div>
    </section>

    <!-- Statistik ringkas -->
    <section class="stats-grid">
      <div class="stat-card">
        <span class="stat-value">{{ stats.count }}</span>
        <span class="stat-label">Kuis Diselesaikan</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.avg }}</span>
        <span class="stat-label">Rata-rata Nilai</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{{ stats.best }}</span>
        <span class="stat-label">Nilai Tertinggi</span>
      </div>
    </section>

    <!-- Pengaturan akun -->
    <section class="profile-card">
      <h3>Pengaturan Akun</h3>

      <div class="setting-row">
        <div>
          <p class="setting-label">Nama Lengkap</p>
          <p v-if="!editingName" class="setting-value">{{ user.full_name || '(belum diisi)' }}</p>
          <div v-else class="name-edit-row">
            <input
              v-model="editName"
              type="text"
              maxlength="60"
              placeholder="Nama lengkap"
              class="setting-input"
            />
            <button class="btn-save" :disabled="savingName" @click="saveName">
              <span v-if="savingName" class="btn-spinner" aria-hidden="true"></span>{{ savingName ? 'Menyimpan...' : 'Simpan' }}
            </button>
            <button class="btn-cancel" :disabled="savingName" @click="editingName = false">Batal</button>
          </div>
        </div>
        <button v-if="!editingName" class="btn-edit" @click="startEditName">Ubah</button>
      </div>

      <div class="setting-row">
        <div>
          <p class="setting-label">Username</p>
          <p class="setting-value">@{{ user.username }} <span class="locked-note">(tidak bisa diubah sendiri)</span></p>
        </div>
      </div>

      <div class="setting-row">
        <div>
          <p class="setting-label">Password</p>
          <p class="setting-value">••••••••</p>
        </div>
        <button class="btn-edit" @click="showPassForm = !showPassForm">
          {{ showPassForm ? 'Tutup' : 'Ubah' }}
        </button>
      </div>

      <div v-if="showPassForm" class="pass-form">
        <div class="input-group">
          <label for="new-password">Password Baru</label>
          <input
            id="new-password"
            v-model="newPassword"
            type="password"
            minlength="6"
            placeholder="Minimal 6 karakter"
          />
        </div>
        <div class="input-group">
          <label for="confirm-password">Ulangi Password Baru</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            minlength="6"
            placeholder="Ketik ulang password baru"
          />
        </div>
        <button class="btn-primary" :disabled="changingPass" @click="handleChangePassword">
          <span v-if="changingPass" class="btn-spinner" aria-hidden="true"></span>{{ changingPass ? 'Menyimpan...' : 'Ganti Password' }}
        </button>
      </div>
    </section>

    <!-- Riwayat nilai -->
    <section class="profile-card">
      <h3>Riwayat Nilai</h3>
      <p v-if="user.role !== ROLES.MURID" class="staff-note">
        Kamu login sebagai {{ user.role }}, nilai tidak dicatat ke riwayat.
      </p>

      <div v-if="loadingStats" class="profile-state">Memuat riwayat...</div>
      <div v-else-if="statsError" class="profile-state error">{{ statsError }}</div>
      <div v-else-if="attempts.length === 0" class="empty-state">
        Belum ada nilai. Selesaikan kuis pertamamu di Beranda Kuis!
      </div>

      <div v-else class="table-scroll">
        <table class="styled-table">
          <thead>
            <tr>
              <th>Kuis</th>
              <th>Nilai</th>
              <th>Waktu Mengerjakan</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in attempts" :key="a.id">
              <td>{{ a.quizTitle }}</td>
              <td><strong :class="['score-cell', a.score >= 75 ? 'good' : 'plain']">{{ a.score }}</strong></td>
              <td>{{ formatDateTime(a.attempted_at) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.profile-card {
  background: white;
  padding: 22px;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.profile-card h3 {
  margin: 0 0 14px;
  color: #1e293b;
  font-size: 1.05rem;
}

/* Kartu identitas */
.profile-hero {
  display: flex;
  align-items: center;
  gap: 16px;
  background: white;
  padding: 22px;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
}

.hero-info h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #1e293b;
}

.hero-username {
  margin: 2px 0 8px;
  color: #64748b;
  font-size: 0.9rem;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 10px;
}

.hero-points {
  font-weight: 700;
  color: #4f46e5;
}

/* Statistik */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.stat-card {
  background: white;
  border-radius: var(--radius-card);
  padding: 16px;
  text-align: center;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-value {
  font-size: 1.6rem;
  font-weight: 800;
  color: #4f46e5;
}

.stat-label {
  font-size: 0.8rem;
  color: #64748b;
}

/* Baris pengaturan */
.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.setting-row:last-of-type {
  border-bottom: none;
}

.setting-label {
  margin: 0 0 2px;
  font-weight: 600;
  color: #334155;
  font-size: 0.9rem;
}

.setting-value {
  margin: 0;
  color: #475569;
}

.locked-note {
  color: #94a3b8;
  font-size: 0.8rem;
}

.name-edit-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 6px;
}

.setting-input {
  flex: 1;
  min-width: 180px;
  padding: 8px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-family: inherit;
  font-size: 0.95rem;
}

.setting-input:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15);
}

.btn-edit {
  background: #eef2ff;
  color: #4f46e5;
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s ease, transform 0.1s ease;
}

.btn-edit:hover { background: #e0e7ff; }
.btn-edit:active { transform: translateY(1px); }

.btn-save {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: background 0.15s ease, transform 0.1s ease;
}

.btn-save:hover:not(:disabled) { background: #4338ca; }
.btn-save:active:not(:disabled) { transform: translateY(1px); }

.btn-cancel {
  background: transparent;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-cancel:hover { background: #f1f5f9; }

.pass-form {
  margin-top: 14px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
}

.pass-form .btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Status & tabel riwayat */
.profile-state {
  text-align: center;
  color: #64748b;
  padding: 18px 0;
}

.profile-state.error { color: #ef4444; }

.staff-note {
  background: #fef9c3;
  border-radius: 8px;
  padding: 10px 14px;
  color: #854d0e;
  font-size: 0.88rem;
  margin: 0 0 12px;
}

.score-cell.good { color: #15803d; }
.score-cell.plain { color: #334155; }

@media (max-width: 640px) {
  .profile-hero { padding: 16px; gap: 12px; }
  .stats-grid { grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .stat-card { padding: 12px 6px; }
  .stat-value { font-size: 1.25rem; }
  .stat-label { font-size: 0.7rem; }
  .setting-row { flex-direction: column; align-items: flex-start; }
}
</style>
