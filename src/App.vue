<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { supabase } from './supabase/supabase.js'
import Login from './components/Login.vue'
import Register from './components/Register.vue'
import Leaderboard from './components/Leaderboard.vue'
import QuizHome from './components/QuizHome.vue'
import QuizPlayer from './components/QuizPlayer.vue'
import TeacherPanel from './components/TeacherPanel.vue'
import AdminPanel from './components/AdminPanel.vue'
import ToastHub from './components/ToastHub.vue'
import { CATEGORIES } from './data/categories.js'
import { ROLES, isStaff, isAdmin } from './data/roles.js'
import { toast } from './composables/useToast.js'

// ===== State sesi & navigasi utama =====
const currentUser = ref(null)   // Baris profile user yang login.
const showRegister = ref(false) // Ganti-tampil Login/Register di area autentikasi.
const currentTab = ref('home')  // Tab aktif.
const leaderboardKey = ref(0)   // Leaderboard fetch ulang.

// ===== State alur kuis murid =====
const selectedQuiz = ref(null)     // Sesi kuis yang terakhir dipilih.
const questions = ref([])          // Daftar soal kuis yang aktif.
const quizResult = ref(null)       // Hasil ngerjain kuis yang terakhir dilakukan.
const loadingQuiz = ref(false)     // Fetch soal/riwayat attempt.
const savingScore = ref(false)     // Tulis riwayat ke quiz_attempts.
const quizPlayerKey = ref(0)       // QuizPlayer di-remount.
const firstAttemptFlag = ref(true) // Penanda pengerjaan sekarang.
const quizHomeRef = ref(null)      // Referensi ke QuizHome.

const switchTab = (tab) => {
  currentTab.value = tab
  quizResult.value = null
  selectedQuiz.value = null
  questions.value = []
}

// ===== Autentikasi =====

const handleLoginSuccess = (profile) => {
  currentUser.value = profile
  quizResult.value = null
  selectedQuiz.value = null
  questions.value = []
  showRegister.value = false
  switchTab('home')
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

    handleLoginSuccess(profile)
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
  <div class="app-container">
    <!-- Header -->
    <header class="main-header" :class="{ 'auth-mode': !currentUser }">
      <h1>Portal Kuis Interaktif</h1>
      <div v-if="currentUser" class="user-badge">
        <span>Halo, <strong>{{ currentUser.username }}</strong> (<i>{{ currentUser.role }}</i>)</span>
        <button @click="handleLogout" class="btn-logout">Keluar</button>
      </div>
    </header>

    <!-- Belum login -->
    <main v-if="!currentUser">
      <Register v-if="showRegister" @switch-to-login="showRegister = false" />
      <Login
        v-else
        @login-success="handleLoginSuccess"
        @switch-to-register="showRegister = true"
      />
    </main>

    <!-- Sudah login -->
    <main v-else class="content-wrapper">
      <nav class="navbar-tabs">
        <button :class="['tab-btn', { active: currentTab === 'home' }]" @click="switchTab('home')">Beranda Kuis</button>
        <button
          v-if="isStaff(currentUser)"
          :class="['tab-btn', { active: currentTab === 'add-question' }]"
          @click="switchTab('add-question')"
        >Buat Kuis &amp; Soal</button>
        <button
          v-if="isAdmin(currentUser)"
          :class="['tab-btn', { active: currentTab === 'manage-users' }]"
          @click="switchTab('manage-users')"
        >Kelola Role</button>
      </nav>

      <!-- TAB 1 -->
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
            <button @click="retryQuiz" class="btn-restart">Ulangi Kuis (Latihan)</button>
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

        <!-- Leaderboard. -->
        <div v-if="!selectedQuiz && !loadingQuiz && !savingScore" class="leaderboard-section">
          <Leaderboard :refresh-key="leaderboardKey" />
        </div>
      </div>

      <!-- TAB 2-->
      <TeacherPanel v-if="currentTab === 'add-question' && isStaff(currentUser)" :user="currentUser" :categories="CATEGORIES" />

      <!-- TAB 3 -->
      <AdminPanel v-if="currentTab === 'manage-users' && isAdmin(currentUser)" :user="currentUser" />
    </main>

    <!-- Notifikasi global. -->
    <ToastHub />
  </div>
</template>

<style scoped>
.result-card {
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
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
}

.loading-state {
  background: white;
  border: 2px dashed #e5e7eb;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  color: #6b7280;
}

.leaderboard-section {
  margin-top: 32px;
}
</style>
