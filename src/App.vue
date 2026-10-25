<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { supabase } from './supabase/supabase.js'
import Login from './components/Login.vue'
import Register from './components/Register.vue'
import Leaderboard from './components/Leaderboard.vue'
import QuizHome from './components/QuizHome.vue'
import QuizPlayer from './components/QuizPlayer.vue'
import TeacherPanel from './components/TeacherPanel.vue'
import AdminPanel from './components/AdminPanel.vue'
import ProfileView from './components/ProfileView.vue'
import ToastHub from './components/ToastHub.vue'
import { CATEGORIES } from './data/categories.js'
import { ROLES, isStaff, isAdmin } from './data/roles.js'
import { toast } from './composables/useToast.js'

// ===== State sesi & navigasi utama =====
const currentUser = ref(null)   // Baris profile user yang login.
const showRegister = ref(false) // Ganti-tampil Login/Register di area autentikasi.
const currentTab = ref('home')  // Tab aktif.
const leaderboardKey = ref(0)   // Leaderboard fetch ulang.
const sidebarOpen = ref(false)  // Drawer sidebar versi mobile.

// ===== State alur kuis murid =====
const selectedQuiz = ref(null)     // Sesi kuis yang terakhir dipilih.
const questions = ref([])          // Daftar soal kuis yang aktif.
const quizResult = ref(null)       // Hasil ngerjain kuis yang terakhir dilakukan.
const loadingQuiz = ref(false)     // Fetch soal/riwayat attempt.
const savingScore = ref(false)     // Tulis riwayat ke quiz_attempts.
const quizPlayerKey = ref(0)       // QuizPlayer di-remount.
const firstAttemptFlag = ref(true) // Penanda pengerjaan sekarang.
const quizHomeRef = ref(null)      // Referensi ke QuizHome.

// Huruf awal nama untuk avatar inisial di sidebar & topbar.
const userInitials = computed(() => {
  if (!currentUser.value) return ''
  const name = (currentUser.value.full_name || currentUser.value.username || '?').trim()
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
})

// Judul halaman aktif, ditampilkan di topbar mobile.
const PAGE_TITLES = {
  home: 'Beranda Kuis',
  leaderboard: 'Papan Peringkat',
  profile: 'Profil Saya',
  'add-question': 'Buat Kuis & Soal',
  'manage-users': 'Kelola Role'
}
const pageTitle = computed(() => PAGE_TITLES[currentTab.value] || 'Portal Kuis')

// Halaman terakhir disimpan biar pas browser refresh nggak balik ke beranda.
const LAST_TAB_KEY = 'portal-last-tab'

const lastSavedTab = (profile) => {
  const saved = localStorage.getItem(LAST_TAB_KEY)
  if (!saved || !(saved in PAGE_TITLES)) return 'home'
  if (saved === 'add-question' && !isStaff(profile)) return 'home'
  if (saved === 'manage-users' && !isAdmin(profile)) return 'home'
  return saved
}

const switchTab = (tab) => {
  currentTab.value = tab
  localStorage.setItem(LAST_TAB_KEY, tab)
  sidebarOpen.value = false // Drawer mobile ditutup tiap pindah halaman.
  quizResult.value = null
  selectedQuiz.value = null
  questions.value = []
}

// Nama lengkap diubah lewat ProfileView — header/sidebar ikut update.
const handleProfileUpdated = (patch) => {
  if (currentUser.value) currentUser.value = { ...currentUser.value, ...patch }
}

// ===== Autentikasi =====

const handleLoginSuccess = (profile, initialTab = 'home') => {
  currentUser.value = profile
  quizResult.value = null
  selectedQuiz.value = null
  questions.value = []
  showRegister.value = false
  switchTab(initialTab)
  leaderboardKey.value++
}

// Restore sesi browser refresh.
const restoreSession = async () => {
  try {
    const { data } = await supabase.auth.getSession()
    const authUser = data.session?.user
    if (!authUser) return

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single()

    // Profile belum ada.
    if (error || !profile) {
      toast.error('Profile pengguna tidak ditemukan. Silakan login kembali.')
      await supabase.auth.signOut()
      return
    }

    handleLoginSuccess(profile, lastSavedTab(profile))
  } catch (err) {
    // Gangguan jaringan pas restore sesi.
    console.warn('Gagal restore sesi:', err.message)
  }
}

onMounted(restoreSession)

// Logout.
const handleLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  } catch (err) {
    toast.error('Gagal keluar: ' + err.message)
  } finally {
    currentUser.value = null
    showRegister.value = false
    currentTab.value = 'home'
    localStorage.removeItem(LAST_TAB_KEY) // Habis logout, mulai lagi dari beranda.
    sidebarOpen.value = false
    quizResult.value = null
    selectedQuiz.value = null
    questions.value = []
  }
}

// ===== Alur kuis murid =====

const startQuiz = async (quiz) => {
  selectedQuiz.value = quiz
  quizResult.value = null
  questions.value = []
  loadingQuiz.value = true

  try {
    let firstAttempt = true

    // Cek apa murid pernah ngerjain quiz ini.
    if (currentUser.value.role === ROLES.MURID) {
      const { data: attempts, error: attemptsError } = await supabase
        .from('quiz_attempts')
        .select('id')
        .eq('user_id', currentUser.value.id)
        .eq('quiz_id', quiz.id)
        .limit(1)

      if (attemptsError) throw attemptsError
      firstAttempt = !attempts || attempts.length === 0
    }

    // Ambil soal berdasarkan quiz_id.
    const { data: qData, error: qError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quiz.id)

    if (qError) throw qError

    // Pengaman — kuis tanpa soal.
    if (!qData || qData.length === 0) {
      toast.error('Kuis ini belum memiliki soal. Hubungi guru Anda.')
      selectedQuiz.value = null
      return
    }

    questions.value = shuffle(qData)
    // Simpen penanda attempt pertama sebelum player mulai.
    quizResult.value = null
    firstAttemptFlag.value = firstAttempt
    quizPlayerKey.value++ // Re-mount QuizPlayer.
  } catch (err) {
    toast.error('Gagal memuat kuis: ' + err.message)
    selectedQuiz.value = null
  } finally {
    loadingQuiz.value = false
  }
}

// Acak urutan soal.
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const handleQuizFinish = async ({ score }) => {
  savingScore.value = true

  const isMurid = currentUser.value.role === ROLES.MURID
  const countsForLeaderboard = isMurid && firstAttemptFlag.value

  try {
    if (isMurid && selectedQuiz.value) {
      const { error } = await supabase.from('quiz_attempts').insert([{
        user_id: currentUser.value.id,
        quiz_id: selectedQuiz.value.id,
        category_id: selectedQuiz.value.category_id,
        score
      }])

      if (error) throw error

      firstAttemptFlag.value = false
      leaderboardKey.value++ // Refresh leaderboard.

      // Tarik poin sinkron.
      const { data: freshProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.value.id)
        .single()
      if (freshProfile) currentUser.value = freshProfile
    }

    quizResult.value = { score, countsForLeaderboard, alreadyRecorded: !countsForLeaderboard && isMurid }
  } catch (err) {
    toast.error('Nilai kamu (' + score + '/100) gagal disimpan: ' + err.message)
    quizResult.value = { score, countsForLeaderboard: false, alreadyRecorded: true, saveFailed: true }
  } finally {
    savingScore.value = false
  }
}

// Tombol Ulangi.
const retryQuiz = () => {
  if (selectedQuiz.value) startQuiz(selectedQuiz.value)
}

const exitQuiz = async () => {
  const categoryId = selectedQuiz.value?.category_id
  selectedQuiz.value = null
  questions.value = []
  quizResult.value = null

  if (categoryId) {
    await nextTick()
    quizHomeRef.value?.reopen(categoryId)
  }
}

onUnmounted(() => toast.hide())
</script>

<template>
  <!-- ===== Belum login===== -->
  <div v-if="!currentUser" class="app-container">
    <header class="main-header auth-mode">
      <h1>Portal Kuis Interaktif</h1>
    </header>

    <main>
      <Register v-if="showRegister" @switch-to-login="showRegister = false" />
      <Login
        v-else
        @login-success="handleLoginSuccess"
        @switch-to-register="showRegister = true"
      />
    </main>
  </div>

  <!-- ===== Sudah login ===== -->
  <div v-else class="app-shell">
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="sidebarOpen = false"></div>

    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <div class="sidebar-brand">Portal Kuis Interaktif</div>

      <!-- Chip user diklik = ke halaman profil, ala sosmed. -->
      <button
        type="button"
        :class="['sidebar-user', { active: currentTab === 'profile' }]"
        @click="switchTab('profile')"
        title="Profil saya"
      >
        <span class="avatar-initials" aria-hidden="true">{{ userInitials }}</span>
        <div class="sidebar-user-info">
          <strong>{{ currentUser.full_name || currentUser.username }}</strong>
          <span>{{ currentUser.role }}</span>
        </div>
      </button>

      <nav class="sidebar-nav">
        <button :class="['side-link', { active: currentTab === 'home' }]" @click="switchTab('home')">Beranda Kuis</button>
        <button :class="['side-link', { active: currentTab === 'leaderboard' }]" @click="switchTab('leaderboard')">Papan Peringkat</button>
        <button
          v-if="isStaff(currentUser)"
          :class="['side-link', { active: currentTab === 'add-question' }]"
          @click="switchTab('add-question')"
        >Buat Kuis &amp; Soal</button>
        <button
          v-if="isAdmin(currentUser)"
          :class="['side-link', { active: currentTab === 'manage-users' }]"
          @click="switchTab('manage-users')"
        >Kelola Role</button>
      </nav>

      <div class="sidebar-footer">
        <button @click="handleLogout" class="btn-logout">Keluar</button>
      </div>
    </aside>

    <div class="shell-main">
      <!-- Topbar mobile -->
      <header class="mobile-topbar">
        <button class="hamburger-btn" @click="sidebarOpen = true" aria-label="Buka menu">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <span class="topbar-title">{{ pageTitle }}</span>
        <button type="button" class="topbar-avatar" @click="switchTab('profile')" aria-label="Profil saya" title="Profil saya">
          <span class="avatar-initials avatar-sm" aria-hidden="true">{{ userInitials }}</span>
        </button>
      </header>

      <main class="shell-content">
      <!-- HALAMAN 1: Beranda kuis -->
      <div v-if="currentTab === 'home'">
        <!-- Layar hasil akhir -->
        <section v-if="quizResult" class="result-card">
          <h2>Ujian Selesai!</h2>
          <p class="final-score">Nilai Kamu: <span>{{ quizResult.score }}</span> / 100</p>

          <p v-if="quizResult.saveFailed" class="info-badge info">
            Nilai tidak tersimpan ke server (gangguan jaringan). Coba lagi nanti.
          </p>
          <p v-else-if="quizResult.countsForLeaderboard" class="info-badge success">
            Nilai ini telah terekam secara resmi di Papan Peringkat (Leaderboard)!
          </p>
          <p v-else-if="quizResult.alreadyRecorded && currentUser.role === 'murid'" class="info-badge info">
            Anda sudah pernah mengerjakan kuis ini sebelumnya. Nilai latihan ini tidak mengubah skor di Leaderboard.
          </p>
          <p v-else-if="currentUser.role !== 'murid'" class="info-badge info">
            Mode coba-coba ({{ currentUser.role }}) — nilai tidak dicatat ke leaderboard.
          </p>

          <div class="result-actions">
            <button @click="retryQuiz" class="btn-restart">Ulangi Kuis</button>
            <button @click="exitQuiz" class="btn-back-home">Selesai &amp; Kembali</button>
          </div>
        </section>

        <!-- Lagi muat soal -->
        <div v-else-if="loadingQuiz" class="loading-state"><p>Memuat soal...</p></div>

        <!-- Status nyimpen nilai sebentar abis kuis dikumpulin -->
        <div v-else-if="savingScore" class="loading-state"><p>Menyimpan nilai...</p></div>

        <!-- Kuis lagi jalan -->
        <QuizPlayer
          v-else-if="selectedQuiz && questions.length > 0"
          :key="quizPlayerKey"
          :quiz="selectedQuiz"
          :questions="questions"
          @finish="handleQuizFinish"
          @exit="exitQuiz"
        />

        <!-- Pilih mapel / daftar kuis -->
        <QuizHome v-else ref="quizHomeRef" :categories="CATEGORIES" @select-quiz="startQuiz" />

      </div>

      <!-- HALAMAN 2 -->
      <Leaderboard
        v-else-if="currentTab === 'leaderboard'"
        :refresh-key="leaderboardKey"
        :highlight-username="currentUser.username"
      />

      <!-- HALAMAN 3 -->
      <ProfileView
        v-else-if="currentTab === 'profile'"
        :user="currentUser"
        @profile-updated="handleProfileUpdated"
      />

      <!-- HALAMAN 4 -->
      <TeacherPanel v-else-if="currentTab === 'add-question' && isStaff(currentUser)" :user="currentUser" :categories="CATEGORIES" />

      <!-- HALAMAN 5 -->
      <AdminPanel v-else-if="currentTab === 'manage-users' && isAdmin(currentUser)" :user="currentUser" />
      </main>
    </div>
  </div>

  <!-- Notifikasi global. -->
  <ToastHub />
</template>

<style scoped>
.result-card {
  background: white;
  padding: 24px;
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  text-align: center;
}

.final-score {
  font-size: 1.3rem;
  color: #374151;
}

.final-score span {
  font-size: 2.2rem;
  font-weight: 800;
  color: #4f46e5;
}

.btn-restart {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 10px 18px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.1s ease;
}

.btn-restart:hover {
  background: #4338ca;
}

.btn-restart:active {
  transform: translateY(1px);
}

.loading-state {
  background: white;
  border: 2px dashed #e5e7eb;
  border-radius: var(--radius-card);
  padding: 30px;
  text-align: center;
  color: #6b7280;
}
</style>
