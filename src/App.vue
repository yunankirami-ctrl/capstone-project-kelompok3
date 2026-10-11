<script setup>
import { ref, onUnmounted } from 'vue'
import { supabase } from './supabase/supabase.js'
import Login from './components/Login.vue'
import Leaderboard from './components/Leaderboard.vue'

// Sesi User
const currentUser = ref(null)
const currentTab = ref('home')

// Kategori Mapel
const categories = ref([
  { id: 'math', name: 'Matematika', icon: '🔢', color: '#4F46E5' },
  { id: 'science', name: 'IPA (Sains)', icon: '🔬', color: '#10B981' },
  { id: 'indo', name: 'Bahasa Indonesia', icon: '📖', color: '#F59E0B' },
  { id: 'english', name: 'Bahasa Inggris', icon: '🔤', color: '#EC4899' }
])

// Navigasi Alur Murid
const selectedCategory = ref(null)   // Step 1: Pilih Mapel
const quizList = ref([])             // Daftar Quiz (misal: Quiz Week 1)
const selectedQuiz = ref(null)       // Step 2: Pilih Quiz spesifik
const questions = ref([])
const currentIndex = ref(0)
const userAnswers = ref({}) 
const quizFinished = ref(false)
const finalScore = ref(0)
const loading = ref(false)
const isFirstAttempt = ref(true)     // Menandai apakah ini percobaan pertama

// Timer State
const timeLeft = ref(0) 
let timerInterval = null

// Form Guru: Pembuatan Sesi Quiz Baru
const teacherStep = ref('create-quiz') // 'create-quiz' atau 'add-questions'
const newQuizCategory = ref('math')
const newQuizTitle = ref('')
const newQuizTotalQ = ref(10)
const newQuizDuration = ref(30)
const createdQuizId = ref(null)
const addedQuestionsCount = ref(0)

// Form Input Soal Satuan
const newQuestionText = ref('')
const newOptions = ref(['', '', '', ''])
const newCorrectOption = ref('')

// Management Users (Admin)
const allUsers = ref([])
const newUsername = ref('')
const newPassword = ref('')
const newFullName = ref('')
const newAccountRole = ref('murid')

// Login Success
const handleLoginSuccess = async (userData) => {
  currentUser.value = userData
  currentTab.value = 'home'
  if (userData.role === 'admin') fetchAllUsers()
}

const fetchAllUsers = async () => {
  const { data } = await supabase.from('profiles').select('*')
  allUsers.value = data || []
}

// Admin: Buat Akun
const handleCreateUser = async () => {
  if (!newUsername.value || !newPassword.value) return alert('Username & Password wajib diisi!')
  
  const randomUuid = crypto.randomUUID()
  const { error } = await supabase.from('profiles').insert([{
    id: randomUuid,
    username: newUsername.value,
    password: newPassword.value,
    full_name: newFullName.value || newUsername.value,
    role: newAccountRole.value
  }])

  if (!error) {
    alert('Akun berhasil dibuat!')
    newUsername.value = ''
    newPassword.value = ''
    newFullName.value = ''
    fetchAllUsers()
  } else {
    alert('Gagal: ' + error.message)
  }
}

const updateUserRole = async (userId, newRole) => {
  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
  if (!error) { alert('Role diperbarui!'); fetchAllUsers(); }
}

// Guru Step 1: Buat Sesi Quiz (Judul, Jumlah Soal, Durasi)
const handleCreateQuizSession = async () => {
  if (!newQuizTitle.value) return alert('Judul kuis (misal: Quiz Week 1) wajib diisi!')

  const { data, error } = await supabase.from('quizzes').insert([{
    category_id: newQuizCategory.value,
    title: newQuizTitle.value,
    total_questions: newQuizTotalQ.value,
    duration_minutes: newQuizDuration.value
  }]).select().single()

  if (error) {
    return alert('Gagal membuat sesi kuis: ' + error.message)
  }

  createdQuizId.value = data.id
  addedQuestionsCount.value = 0
  teacherStep.value = 'add-questions'
  alert(`Sesi "${newQuizTitle.value}" berhasil dibuat! Silakan masukkan ${newQuizTotalQ.value} soal di bawah ini.`)
}

// Guru Step 2: Masukkan Soal satu per satu ke Sesi Quiz
const handleAddQuestionToQuiz = async () => {
  if (!newQuestionText.value || !newCorrectOption.value) return alert('Lengkapi data soal!')

  const { error } = await supabase.from('questions').insert([{
    quiz_id: createdQuizId.value,
    category_id: newQuizCategory.value,
    question_text: newQuestionText.value,
    options: newOptions.value,
    correct_option: newCorrectOption.value
  }])

  if (!error) {
    addedQuestionsCount.value++
    newQuestionText.value = ''
    newOptions.value = ['', '', '', '']
    newCorrectOption.value = ''

    if (addedQuestionsCount.value >= newQuizTotalQ.value) {
      alert('Semua soal untuk kuis ini telah selesai dimasukkan!')
      teacherStep.value = 'create-quiz'
      newQuizTitle.value = ''
      createdQuizId.value = null
    } else {
      alert(`Soal berhasil disimpan! Masukkan soal berikutnya (${addedQuestionsCount.value}/${newQuizTotalQ.value})`)
    }
  } else {
    alert('Gagal tambah soal: ' + error.message)
  }
}

// Murid: Pilih Mapel -> Muncul Daftar Quiz (Quiz Week 1, dll)
const selectCategory = async (category) => {
  selectedCategory.value = category
  loading.value = true

  const { data } = await supabase
    .from('quizzes')
    .select('*')
    .eq('category_id', category.id)

  quizList.value = data || []
  loading.value = false
}

// Murid: Pilih Quiz Spesifik untuk Memulai Ujian
const startQuiz = async (quiz) => {
  selectedQuiz.value = quiz
  loading.value = true

  // Cek apakah murid sudah pernah mengerjakan quiz ini sebelumnya (untuk aturan Leaderboard)
  if (currentUser.value && currentUser.value.role === 'murid') {
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('user_id', currentUser.value.id)
      .eq('quiz_id', quiz.id)

    isFirstAttempt.value = (!attempts || attempts.length === 0)
  } else {
    isFirstAttempt.value = true
  }

  // Ambil soal berdasarkan quiz_id
  const { data: qData } = await supabase
    .from('questions')
    .select('*')
    .eq('quiz_id', quiz.id)

  questions.value = qData || []
  timeLeft.value = quiz.duration_minutes * 60
  startTimer()

  currentIndex.value = 0
  userAnswers.value = {}
  quizFinished.value = false
  loading.value = false
}

// Timer Countdown
const startTimer = () => {
  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      clearInterval(timerInterval)
      alert('Waktu habis!')
      finishQuiz()
    }
  }, 1000)
}

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Navigasi Soal
const selectAnswerForCurrent = (opt) => {
  userAnswers.value[currentIndex.value] = opt
}

const prevQuestion = () => {
  if (currentIndex.value > 0) currentIndex.value--
}

const nextQuestion = () => {
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  }
}

// Tombol Selesai / Finish Ujian
const finishQuiz = async () => {
  clearInterval(timerInterval)
  
  let correctCount = 0
  questions.value.forEach((q, idx) => {
    if (userAnswers.value[idx] === q.correct_option) {
      correctCount++
    }
  })

  // Hitung nilai proporsional maksimal 100
  const totalQ = questions.value.length
  finalScore.value = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0
  quizFinished.value = true

  // SIMPAN KE DATABASE:
  // Nilai disimpan sebagai riwayat latihan, TAPI Leaderboard HANYA mencatat jika ini percobaan pertama (isFirstAttempt)
  if (currentUser.value && currentUser.value.role === 'murid') {
    await supabase.from('quiz_attempts').insert([{
      user_id: currentUser.value.id,
      quiz_id: selectedQuiz.value.id,
      category_id: selectedCategory.value.id,
      score: finalScore.value
    }])
  }
}

const retryQuiz = () => {
  startQuiz(selectedQuiz.value)
}

const resetNavigation = () => {
  clearInterval(timerInterval)
  selectedCategory.value = null
  quizList.value = []
  selectedQuiz.value = null
  questions.value = []
  userAnswers.value = {}
  quizFinished.value = false
}

const handleLogout = () => {
  clearInterval(timerInterval)
  currentUser.value = null
  currentTab.value = 'home'
  resetNavigation()
}

onUnmounted(() => {
  clearInterval(timerInterval)
})
</script>

<template>
  <div class="app-container">
    <header class="main-header">
      <h1>🎓 Portal Kuis Interaktif SD</h1>
      <div v-if="currentUser" class="user-badge">
        <span>Halo, <strong>{{ currentUser.username }}</strong> (<i>{{ currentUser.role }}</i>)</span>
        <button @click="handleLogout" class="btn-logout">Keluar</button>
      </div>
    </header>

    <main v-if="!currentUser">
      <Login @login-success="handleLoginSuccess" />
    </main>

    <main v-else class="content-wrapper">
      <nav class="navbar-tabs">
        <button :class="['tab-btn', { active: currentTab === 'home' }]" @click="{ currentTab = 'home'; resetNavigation(); }">🏠 Beranda Kuis</button>
        <button v-if="currentUser.role === 'guru' || currentUser.role === 'admin'" :class="['tab-btn', { active: currentTab === 'add-question' }]" @click="currentTab = 'add-question'">📝 Buat Kuis & Soal</button>
        <button v-if="currentUser.role === 'admin'" :class="['tab-btn', { active: currentTab === 'manage-users' }]" @click="currentTab = 'manage-users'">👤 Kelola Akun & Role</button>
      </nav>

      <!-- TAB 1: BERANDA & DAFTAR KUIS -->
      <div v-if="currentTab === 'home'">
        
        <!-- Step 1: Pilih Mata Pelajaran -->
        <section v-if="!selectedCategory" class="category-selection">
          <h2>📚 Pilih Mata Pelajaran</h2>
          <p>Pilih topik kuis yang ingin dikerjakan:</p>
          <div class="category-grid">
            <div v-for="cat in categories" :key="cat.id" class="category-card" :style="{ borderColor: cat.color }" @click="selectCategory(cat)">
              <div class="cat-icon">{{ cat.icon }}</div>
              <h3>{{ cat.name }}</h3>
              <button class="btn-start" :style="{ backgroundColor: cat.color }">Lihat Daftar Kuis</button>
            </div>
          </div>
          <div class="leaderboard-section"><Leaderboard /></div>
        </section>

        <!-- Step 2: Pilih Sesi Quiz Spesifik (Misal: Quiz Week 1) -->
        <section v-else-if="!selectedQuiz" class="quiz-list-section">
          <button @click="selectedCategory = null" class="btn-back">⬅ Kembali ke Pilihan Mapel</button>
          <h2>📋 Daftar Kuis: {{ selectedCategory.name }}</h2>
          <p>Pilih sesi kuis yang tersedia:</p>

          <div v-if="quizList.length === 0" class="empty-state">
            <p>Belum ada sesi kuis yang dibuat untuk mata pelajaran ini.</p>
          </div>

          <div class="quiz-session-grid" v-else>
            <div v-for="quiz in quizList" :key="quiz.id" class="session-card" @click="startQuiz(quiz)">
              <h3>🎯 {{ quiz.title }}</h3>
              <p>⏱️ Durasi: {{ quiz.duration_minutes }} Menit</p>
              <p>📝 Jumlah Soal: {{ quiz.total_questions }} Soal</p>
              <button class="btn-start-session">Mulai Ujian</button>
            </div>
          </div>
        </section>

        <!-- Step 3: Pengerjaan Kuis Berjalan -->
        <section v-else class="quiz-section">
          <button @click="resetNavigation" class="btn-back">⬅ Kembali ke Daftar Kuis</button>

          <div v-if="loading" class="loading-state"><p>⏳ Memuat soal...</p></div>

          <!-- Hasil Kuis / Nilai Keluar Saat Finish -->
          <div v-else-if="quizFinished" class="result-card">
            <h2>🎉 Ujian Selesai!</h2>
            <p class="final-score">Nilai Kamu: <span>{{ finalScore }}</span> / 100</p>
            
            <p v-if="isFirstAttempt" class="info-badge success">✨ Nilai ini telah terekam secara resmi di Papan Peringkat (Leaderboard)!</p>
            <p v-else class="info-badge info">ℹ️ Anda sudah pernah mengerjakan kuis ini sebelumnya. Nilai latihan ini tidak mengubah skor terbaik Anda di Leaderboard.</p>

            <div class="result-actions">
              <button @click="retryQuiz" class="btn-restart">🔄 Ulangi Kuis (Latihan)</button>
              <button @click="resetNavigation" class="btn-back-home">🏠 Selesai & Kembali</button>
            </div>
          </div>

          <!-- Pertanyaan Ujian Per Soal -->
          <div v-else class="question-card">
            <div class="quiz-header">
              <span class="badge-cat">{{ selectedQuiz.title }}</span>
              <div class="timer-badge">⏱️ Waktu: <strong>{{ formatTime(timeLeft) }}</strong></div>
              <span class="progress-text">Soal {{ currentIndex + 1 }} dari {{ questions.length }}</span>
            </div>

            <h3 class="q-text">{{ questions[currentIndex].question_text }}</h3>

            <div class="options-grid">
              <button
                v-for="(opt, idx) in questions[currentIndex].options"
                :key="idx"
                :class="['option-btn', { active: userAnswers[currentIndex] === opt }]"
                @click="selectAnswerForCurrent(opt)"
              >
                {{ opt }}
              </button>
            </div>

            <div class="quiz-nav-footer">
              <button @click="prevQuestion" :disabled="currentIndex === 0" class="btn-nav">⬅ Sebelumnya</button>
              
              <button v-if="currentIndex < questions.length - 1" @click="nextQuestion" class="btn-nav btn-primary-nav">Selanjutnya ➡</button>
              <button v-else @click="finishQuiz" class="btn-finish">📤 Selesai & Kirim Jawaban (Finish)</button>
            </div>
          </div>
        </section>
      </div>

      <!-- TAB 2: BUAT KUIS & SOAL (GURU / ADMIN) -->
      <div v-if="currentTab === 'add-question'" class="dashboard-card teacher-card">
        <h2>📝 Panel Pembuatan Kuis Baru</h2>

        <!-- Step A: Buat Judul, Mapel, Jumlah Soal, & Durasi -->
        <div v-if="teacherStep === 'create-quiz'">
          <h3>Langkah 1: Atur Informasi Kuis</h3>
          <form @submit.prevent="handleCreateQuizSession" class="form-stack">
            <div class="input-group">
              <label>Mata Pelajaran</label>
              <select v-model="newQuizCategory" class="full-select">
                <option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.icon }} {{ cat.name }}</option>
              </select>
            </div>

            <div class="input-group">
              <label>Nama / Deskripsi Sesi Kuis (Contoh: Quiz Week 1)</label>
              <input v-model="newQuizTitle" placeholder="Ketik nama kuis..." required />
            </div>

            <div class="form-row">
              <div class="input-group">
                <label>Jumlah Soal (1 - 40)</label>
                <input type="number" v-model.number="newQuizTotalQ" min="1" max="40" required />
              </div>
              <div class="input-group">
                <label>Durasi Ujian</label>
                <select v-model.number="newQuizDuration" class="full-select" required>
                  <option :value="15">15 Menit</option>
                  <option :value="30">30 Menit</option>
                  <option :value="45">45 Menit</option>
                  <option :value="60">60 Menit (1 Jam)</option>
                  <option :value="75">75 Menit</option>
                  <option :value="90">90 Menit (1.5 Jam)</option>
                  <option :value="105">105 Menit</option>
                  <option :value="120">120 Menit (2 Jam)</option>
                </select>
              </div>
            </div>

            <button type="submit" class="btn-action btn-add-question">Lanjut ke Input Soal ➡</button>
          </form>
        </div>

        <!-- Step B: Masukkan Soal ke dalam Sesi Kuis yang Dibuat -->
        <div v-else>
          <div class="quiz-creation-header">
            <h3>Langkah 2: Masukkan Soal ({{ addedQuestionsCount + 1 }} dari {{ newQuizTotalQ }})</h3>
            <span class="active-quiz-badge">Sesi: {{ newQuizTitle }}</span>
          </div>

          <form @submit.prevent="handleAddQuestionToQuiz" class="form-stack">
            <div class="input-group">
              <label>Tuliskan Pertanyaan</label>
              <input v-model="newQuestionText" placeholder="Contoh: Berapakah hasil 2 + 2?" required />
            </div>

            <div class="input-group">
              <label>Pilihan Jawaban (Opsi A - D)</label>
              <div class="options-grid-inputs">
                <input v-for="(opt, idx) in 4" :key="idx" v-model="newOptions[idx]" :placeholder="'Opsi ' + (idx + 1)" required />
              </div>
            </div>

            <div class="input-group">
              <label>Jawaban Benar (Persis seperti salah satu opsi)</label>
              <input v-model="newCorrectOption" placeholder="Ketik jawaban benar..." required />
            </div>

            <button type="submit" class="btn-action btn-add-question">Simpan Soal Ini</button>
          </form>
        </div>
      </div>

      <!-- TAB 3: KELOLA AKUN (ADMIN) -->
      <div v-if="currentTab === 'manage-users'" class="dashboard-card admin-card">
        <h2>👤 Panel Pengaturan Akun & Pengguna</h2>
        <div class="sub-panel">
          <h3>➕ Buat Akun Guru / Murid Baru</h3>
          <form @submit.prevent="handleCreateUser" class="form-grid">
            <div class="input-group"><label>Nama Lengkap</label><input v-model="newFullName" placeholder="Nama..." /></div>
            <div class="input-group"><label>Username</label><input v-model="newUsername" placeholder="Username..." required /></div>
            <div class="input-group"><label>Password</label><input v-model="newPassword" type="password" placeholder="Password..." required /></div>
            <div class="input-group"><label>Role</label><select v-model="newAccountRole"><option value="murid">Murid</option><option value="guru">Guru</option><option value="admin">Administrator</option></select></div>
            <button type="submit" class="btn-action btn-add-user">Buat Akun</button>
          </form>
        </div>

        <div class="sub-panel margin-top">
          <h3>⚙️ Daftar Pengguna</h3>
          <table class="styled-table">
            <thead><tr><th>Nama</th><th>Username</th><th>Role</th><th>Aksi Ubah Role</th></tr></thead>
            <tbody>
              <tr v-for="u in allUsers" :key="u.id">
                <td>{{ u.full_name || '-' }}</td>
                <td><strong>{{ u.username }}</strong></td>
                <td><span :class="['role-tag', u.role]">{{ u.role }}</span></td>
                <td>
                  <select :value="u.role" @change="e => updateUserRole(u.id, e.target.value)">
                    <option value="murid">Murid</option><option value="guru">Guru</option><option value="admin">Administrator</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>