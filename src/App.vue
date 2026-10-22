<script setup>
// [TIM] App.vue - Komponen ROOT aplikasi: ngatur SESI login & ROUTING antar-tab.
// Prinsip bagi kerjanya: App.vue cuma megang state lintas-halaman sama operasi database
// yang ngefek ke data global (simpan skor, refresh leaderboard).
// Semua tampilan udah dipecah ke komponen:
//   Login / Register   -> form autentikasi (Supabase Auth)
//   QuizHome           -> murid milih mapel & sesi kuis
//   QuizPlayer         -> murid ngerjain soal + layar hasil sementara
//   TeacherPanel       -> guru/admin bikin kuis & soal
//   AdminPanel         -> admin ngatur role pengguna
//   Leaderboard        -> papan peringkat
//   ToastHub           -> notifikasi global (gantiin alert)

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

// [TIM] ===== State sesi & navigasi utama =====
const currentUser = ref(null)   // [TIM] Baris profile user yang login (null = belum login -> tampil form auth).
const showRegister = ref(false) // [TIM] Ganti-tampil Login/Register di area autentikasi.
const currentTab = ref('home')  // [TIM] Tab aktif: 'home' | 'add-question' (guru/admin) | 'manage-users' (admin).
const leaderboardKey = ref(0)   // [TIM] Kalo dinaikin -> Leaderboard fetch ulang (misal abis skor disimpen).

// [TIM] ===== State alur kuis murid (kita pegang di sini biar tetep ada walau pindah tab) =====
const selectedQuiz = ref(null)     // [TIM] Sesi kuis yang lagi/terakhir dipilih.
const questions = ref([])          // [TIM] Daftar soal kuis yang aktif.
const quizResult = ref(null)       // [TIM] { score, countsForLeaderboard, alreadyRecorded } hasil ngerjain.
const loadingQuiz = ref(false)     // [TIM] Lagi fetch soal/riwayat attempt.
const savingScore = ref(false)     // [TIM] Lagi nulis riwayat ke quiz_attempts.
const quizPlayerKey = ref(0)       // [TIM] Kalo dinaikin -> QuizPlayer di-remount (soal di-shuffle + state reset).
const firstAttemptFlag = ref(true) // [TIM] Penanda pengerjaan sekarang = percobaan pertama murid (buat skor resmi).
const quizHomeRef = ref(null)      // [TIM] Referensi ke QuizHome biar bisa buka lagi kategori tadi abis keluar kuis.

// [TIM] Ganti tab sekalian beresin status simpan skor lama (nggak kepakai di tab lain).
const switchTab = (tab) => {
  currentTab.value = tab
  quizResult.value = null
  selectedQuiz.value = null
  questions.value = []
}

// [TIM] ===== Autentikasi =====

// [TIM] Dipanggil Login.vue abis Supabase Auth sukses -> simpen profile & buka beranda.
const handleLoginSuccess = (profile) => {
  currentUser.value = profile
  quizResult.value = null
  selectedQuiz.value = null
  questions.value = []
  showRegister.value = false
  switchTab('home')
  // [TIM] Leaderboard dimuat ulang biar data terbaru langsung keliatan abis restore/login.
  leaderboardKey.value++
}

// [TIM] Restore sesi pas aplikasi dimuat ulang (browser refresh) — Supabase nyimpen session
// di localStorage, tinggal ambil profile-nya berdasarkan id user aktif.
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

    // [TIM] Profile belum ada (trigger belum jalan / user lama) -> paksa logout biar nggak menggantung.
    if (error || !profile) {
      toast.error('Profile pengguna tidak ditemukan. Silakan login kembali.')
      await supabase.auth.signOut()
      return
    }

    handleLoginSuccess(profile)
  } catch (err) {
    // [TIM] Gangguan jaringan pas restore sesi — user bisa login manual sebagai cadangan.
    console.warn('Gagal restore sesi:', err.message)
  }
}

onMounted(restoreSession)

// [TIM] Logout: hapus session Supabase + reset semua state aplikasi.
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

// [TIM] ===== Alur kuis murid =====

// [TIM] Dipanggil QuizHome pas murid neken kartu kuis:
// cek riwayat attempt (penanda skor resmi) terus ambil soal, terakhir tampilin player.
const startQuiz = async (quiz) => {
  selectedQuiz.value = quiz
  quizResult.value = null
  questions.value = []
  loadingQuiz.value = true

  try {
    let firstAttempt = true

    // [TIM] Cek apa murid pernah ngerjain quiz ini (aturan leaderboard: cuma skor PERTAMA yang resmi).
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

    // [TIM] Ambil soal berdasarkan quiz_id.
    const { data: qData, error: qError } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quiz.id)

    if (qError) throw qError

    // [TIM] Pengaman — kuis tanpa soal nggak boleh dimulai (biar layar player nggak rusak).
    if (!qData || qData.length === 0) {
      toast.error('Kuis ini belum memiliki soal. Hubungi guru Anda.')
      selectedQuiz.value = null
      return
    }

    questions.value = shuffle(qData)
    // [TIM] Simpen penanda attempt pertama sebelum player mulai (nanti pas retry udah bukan pertama lagi).
    quizResult.value = null
    firstAttemptFlag.value = firstAttempt
    quizPlayerKey.value++ // [TIM] Remount QuizPlayer -> state soal/timer selalu fresh.
  } catch (err) {
    toast.error('Gagal memuat kuis: ' + err.message)
    selectedQuiz.value = null
  } finally {
    loadingQuiz.value = false
  }
}

// [TIM] Acak urutan soal biar tiap percobaan nggak selalu sama (Fisher-Yates).
const shuffle = (arr) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// [TIM] Dipanggil QuizPlayer pas kuis dikumpulin: simpen riwayat ke tabel `quiz_attempts`.
// Poin leaderboard NGGAK diupdate di sini — diurus trigger database
// `record_first_attempt_score` (cuma nambah poin kalo attempt itu beneran yang pertama).
const handleQuizFinish = async ({ score }) => {
  savingScore.value = true

  // [TIM] Sebelum insert, tentuin dulu apa attempt ini "percobaan pertama" yang resmi.
  const isMurid = currentUser.value.role === ROLES.MURID
  const countsForLeaderboard = isMurid && firstAttemptFlag.value

  try {
    // [TIM] Riwayat cuma disimpen buat murid; guru/admin cuma coba-coba (nggak dicatat).
    if (isMurid && selectedQuiz.value) {
      const { error } = await supabase.from('quiz_attempts').insert([{
        user_id: currentUser.value.id,
        quiz_id: selectedQuiz.value.id,
        category_id: selectedQuiz.value.category_id,
        score
      }])

      if (error) throw error

      // [TIM] Abis attempt masuk DB, attempt berikutnya udah bukan "percobaan pertama" lagi.
      firstAttemptFlag.value = false
      leaderboardKey.value++ // [TIM] Refresh leaderboard (trigger DB udah nambah poin kalo resmi).
    }

    quizResult.value = { score, countsForLeaderboard, alreadyRecorded: !countsForLeaderboard && isMurid }
  } catch (err) {
    toast.error('Nilai kamu (' + score + '/100) gagal disimpan: ' + err.message)
    quizResult.value = { score, countsForLeaderboard: false, alreadyRecorded: true, saveFailed: true }
  } finally {
    savingScore.value = false
  }
}

// [TIM] Tombol "Ulangi (Latihan)": muat ulang kuis yang sama (flag first-attempt ikut dicek ulang).
const retryQuiz = () => {
  if (selectedQuiz.value) startQuiz(selectedQuiz.value)
}

// [TIM] Balik dari player/hasil ke daftar kuis. Abis QuizHome ke-mount lagi,
// otomatis buka lagi kategori mapel kuis tadi (bukan balik ke pilihan mapel dari nol).
const exitQuiz = async () => {
  const categoryId = selectedQuiz.value?.category_id
  selectedQuiz.value = null
  questions.value = []
  quizResult.value = null

  if (categoryId) {
    await nextTick() // [TIM] Tunggu QuizHome ke-render ulang sebelum manggil metode reopen-nya.
    quizHomeRef.value?.reopen(categoryId)
  }
}

// [TIM] Beresin efek samping pas aplikasi dilepas (timer toast dll).
onUnmounted(() => toast.hide())
</script>

<template>
  <div class="app-container">
    <!-- [TIM] Header: judul + badge user login.
         Kelas 'auth-mode' aktif pas belum login -> judul nge-tengah biar sejajar
         sama kartu Login/Register di desktop (nggak nyangkut di kiri lagi). -->
    <header class="main-header" :class="{ 'auth-mode': !currentUser }">
      <h1>Portal Kuis Interaktif</h1>
      <div v-if="currentUser" class="user-badge">
        <span>Halo, <strong>{{ currentUser.username }}</strong> (<i>{{ currentUser.role }}</i>)</span>
        <button @click="handleLogout" class="btn-logout">Keluar</button>
      </div>
    </header>

    <!-- [TIM] Belum login: area autentikasi (Login/Register saling bertukar) -->
    <main v-if="!currentUser">
      <Register v-if="showRegister" @switch-to-login="showRegister = false" />
      <Login
        v-else
        @login-success="handleLoginSuccess"
        @switch-to-register="showRegister = true"
      />
    </main>

    <!-- [TIM] Sudah login -->
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

      <!-- [TIM] TAB 1: Beranda & ngerjain kuis (murid) -->
      <div v-if="currentTab === 'home'">
        <!-- [TIM] Layar hasil akhir (abis skor diproses App.vue) -->
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

        <!-- [TIM] Lagi muat soal -->
        <div v-else-if="loadingQuiz" class="loading-state"><p>Memuat soal...</p></div>

        <!-- [TIM] Status nyimpen nilai sebentar abis kuis dikumpulin -->
        <div v-else-if="savingScore" class="loading-state"><p>Menyimpan nilai...</p></div>

        <!-- [TIM] Kuis lagi jalan -->
        <QuizPlayer
          v-else-if="selectedQuiz && questions.length > 0"
          :key="quizPlayerKey"
          :quiz="selectedQuiz"
          :questions="questions"
          @finish="handleQuizFinish"
          @exit="exitQuiz"
        />

        <!-- [TIM] Milih mapel / daftar kuis -->
        <QuizHome v-else ref="quizHomeRef" :categories="CATEGORIES" @select-quiz="startQuiz" />

        <!-- [TIM] Leaderboard: cuma nongol di mode jelajah (bukan pas ngerjain/menyimpan) biar
             nggak nutupin layar kuis; ditaro di level App biar nggak reload tiap pindah kategori. -->
        <div v-if="!selectedQuiz && !loadingQuiz && !savingScore" class="leaderboard-section">
          <Leaderboard :refresh-key="leaderboardKey" />
        </div>
      </div>

      <!-- [TIM] TAB 2: Panel guru -->
      <TeacherPanel v-if="currentTab === 'add-question' && isStaff(currentUser)" :user="currentUser" :categories="CATEGORIES" />

      <!-- [TIM] TAB 3: Panel admin -->
      <AdminPanel v-if="currentTab === 'manage-users' && isAdmin(currentUser)" :user="currentUser" />
    </main>

    <!-- [TIM] Notifikasi global, satu-satunya tempat toast dirender. -->
    <ToastHub />
  </div>
</template>

<style scoped>
/* [TIM] Style khusus layar hasil & state di level App (kelas umum ada di style.css global). */
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
