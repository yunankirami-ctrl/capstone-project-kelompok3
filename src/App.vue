<script setup>
import { ref } from 'vue'
import { supabase } from './supabase/supabase.js'
import Login from './components/Login.vue'
import Leaderboard from './components/Leaderboard.vue'

// Sesi User yang Sedang Login
const currentUser = ref(null)

// Navigasi Tab ('home' | 'manage-users' | 'add-question')
const currentTab = ref('home')

// Data Kategori Mata Pelajaran
const categories = ref([
  { id: 'math', name: 'Matematika', icon: '🔢', color: '#4F46E5' },
  { id: 'science', name: 'IPA (Sains)', icon: '🔬', color: '#10B981' },
  { id: 'indo', name: 'Bahasa Indonesia', icon: '📖', color: '#F59E0B' },
  { id: 'english', name: 'Bahasa Inggris', icon: '🔤', color: '#EC4899' }
])

const selectedCategory = ref(null)
const questions = ref([])
const currentIndex = ref(0)
const selectedAnswer = ref(null)
const score = ref(0)
const quizFinished = ref(false)
const loading = ref(false)

// Form Buat Akun Baru (Role Admin)
const newUsername = ref('')
const newPassword = ref('')
const newFullName = ref('')
const newAccountRole = ref('murid')

// Form Tambah Soal Baru (Role Guru / Admin)
const newQuestionCategory = ref('math')
const newQuestionText = ref('')
const newOptions = ref(['', '', '', ''])
const newCorrectOption = ref('')

// Management Users (Role Admin)
const allUsers = ref([])

// Ketika Login Berhasil
const handleLoginSuccess = async (userData) => {
  currentUser.value = userData
  currentTab.value = 'home'
  if (userData.role === 'admin') {
    fetchAllUsers()
  }
}

// Ambil Semua Pengguna (Admin)
const fetchAllUsers = async () => {
  const { data } = await supabase.from('profiles').select('*')
  allUsers.value = data || []
}

// Tambah Akun Guru / Murid Baru (Khusus Admin)
const handleCreateUser = async () => {
  if (!newUsername.value || !newPassword.value) {
    return alert('Username dan Password wajib diisi!')
  }

  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', newUsername.value)
    .single()

  if (existingUser) {
    return alert('Username sudah digunakan! Silakan gunakan username lain.')
  }

  const randomUuid = crypto.randomUUID()

  const { error } = await supabase.from('profiles').insert([
    {
      id: randomUuid,
      username: newUsername.value,
      password: newPassword.value,
      full_name: newFullName.value || newUsername.value,
      role: newAccountRole.value
    }
  ])

  if (!error) {
    alert(`Berhasil membuat akun ${newAccountRole.value} baru!`)
    newUsername.value = ''
    newPassword.value = ''
    newFullName.value = ''
    newAccountRole.value = 'murid'
    fetchAllUsers()
  } else {
    alert('Gagal membuat akun: ' + error.message)
  }
}

// Ubah Role Pengguna (Khusus Admin)
const updateUserRole = async (userId, newRole) => {
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)
  
  if (!error) {
    alert('Role berhasil diperbarui!')
    fetchAllUsers()
  } else {
    alert('Gagal mengubah role: ' + error.message)
  }
}

// Tambah Soal Baru (Khusus Guru / Admin)
const handleAddQuestion = async () => {
  if (!newQuestionText.value || !newCorrectOption.value) {
    return alert('Lengkapi semua data soal!')
  }

  const { error } = await supabase.from('questions').insert([
    {
      category_id: newQuestionCategory.value,
      question_text: newQuestionText.value,
      options: newOptions.value,
      correct_option: newCorrectOption.value
    }
  ])

  if (!error) {
    alert('Soal kuis berhasil ditambahkan!')
    newQuestionText.value = ''
    newOptions.value = ['', '', '', '']
    newCorrectOption.value = ''
  } else {
    alert('Gagal menambah soal: ' + error.message)
  }
}

// Kuis Control
const selectCategory = async (category) => {
  selectedCategory.value = category
  loading.value = true
  const { data } = await supabase
    .from('questions')
    .select('*')
    .eq('category_id', category.id)

  questions.value = data || []
  loading.value = false
}

const handleAnswer = (option) => {
  selectedAnswer.value = option
}

const nextQuestion = () => {
  const currentQ = questions.value[currentIndex.value]
  if (selectedAnswer.value === currentQ.correct_option) {
    score.value += 10
  }

  selectedAnswer.value = null
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  } else {
    quizFinished.value = true
    saveScore()
  }
}

const saveScore = async () => {
  if (!currentUser.value) return
  await supabase.from('quiz_attempts').insert([
    {
      user_id: currentUser.value.id,
      score: score.value
    }
  ])
}

const resetQuiz = () => {
  selectedCategory.value = null
  questions.value = []
  currentIndex.value = 0
  score.value = 0
  quizFinished.value = false
  selectedAnswer.value = null
}

const handleLogout = () => {
  currentUser.value = null
  currentTab.value = 'home'
  resetQuiz()
}
</script>

<template>
  <div class="app-container">
    <!-- Header Utama -->
    <header class="main-header">
      <h1>🎓 Portal Kuis Interaktif SD</h1>
      <div v-if="currentUser" class="user-badge">
        <span>Halo, <strong>{{ currentUser.username }}</strong> (<i>{{ currentUser.role }}</i>)</span>
        <button @click="handleLogout" class="btn-logout">Keluar</button>
      </div>
    </header>

    <!-- Tampilan Sebelum Login -->
    <main v-if="!currentUser">
      <Login @login-success="handleLoginSuccess" />
    </main>

    <!-- Tampilan Setelah Login -->
    <main v-else class="content-wrapper">

      <!-- Navigation Bar (Tabs) -->
      <nav class="navbar-tabs">
        <button 
          :class="['tab-btn', { active: currentTab === 'home' }]" 
          @click="{ currentTab = 'home'; resetQuiz(); }"
        >
          🏠 Beranda Kuis
        </button>

        <button 
          v-if="currentUser.role === 'guru' || currentUser.role === 'admin'"
          :class="['tab-btn', { active: currentTab === 'add-question' }]" 
          @click="currentTab = 'add-question'"
        >
          📝 Tambah Soal
        </button>

        <button 
          v-if="currentUser.role === 'admin'"
          :class="['tab-btn', { active: currentTab === 'manage-users' }]" 
          @click="currentTab = 'manage-users'"
        >
          👤 Kelola Akun & Role
        </button>
      </nav>

      <!-- KONTEN TAB 1: BERANDA & KUIS -->
      <div v-if="currentTab === 'home'">
        <!-- Pilihan Mata Pelajaran -->
        <section v-if="!selectedCategory" class="category-selection">
          <h2>📚 Pilih Mata Pelajaran</h2>
          <p>Pilih topik kuis yang ingin kamu kerjakan hari ini:</p>

          <div class="category-grid">
            <div 
              v-for="cat in categories" 
              :key="cat.id" 
              class="category-card"
              :style="{ borderColor: cat.color }"
              @click="selectCategory(cat)"
            >
              <div class="cat-icon">{{ cat.icon }}</div>
              <h3>{{ cat.name }}</h3>
              <button class="btn-start" :style="{ backgroundColor: cat.color }">Mulai Kuis</button>
            </div>
          </div>

          <div class="leaderboard-section">
            <Leaderboard />
          </div>
        </section>

        <!-- Halaman Mengerjakan Kuis -->
        <section v-else class="quiz-section">
          <button @click="resetQuiz" class="btn-back">⬅ Kembali ke Pilihan Mapel</button>

          <div v-if="loading" class="loading-state">
            <p>⏳ Memuat soal...</p>
          </div>

          <div v-else-if="questions.length === 0" class="empty-state">
            <h3>Belum ada soal untuk {{ selectedCategory.name }}</h3>
            <p>Silakan minta Guru atau Admin untuk menambahkan soal pada menu <strong>Tambah Soal</strong>.</p>
          </div>

          <div v-else-if="quizFinished" class="result-card">
            <h2>🎉 Kuis Selesai!</h2>
            <p class="final-score">Skor Kamu: <span>{{ score }}</span></p>
            <button @click="resetQuiz" class="btn-restart">Coba Lagi / Pilih Mapel Lain</button>
          </div>

          <div v-else class="question-card">
            <div class="quiz-header">
              <span class="badge-cat">{{ selectedCategory.name }}</span>
              <span class="progress-text">Soal {{ currentIndex + 1 }} dari {{ questions.length }}</span>
            </div>

            <h3 class="q-text">{{ questions[currentIndex].question_text }}</h3>

            <div class="options-grid">
              <button
                v-for="(opt, idx) in questions[currentIndex].options"
                :key="idx"
                :class="['option-btn', { active: selectedAnswer === opt }]"
                @click="handleAnswer(opt)"
              >
                {{ opt }}
              </button>
            </div>

            <button 
              @click="nextQuestion" 
              :disabled="!selectedAnswer"
              class="btn-next"
            >
              {{ currentIndex === questions.length - 1 ? 'Selesai' : 'Lanjut ➡' }}
            </button>
          </div>
        </section>
      </div>

      <!-- KONTEN TAB 2: TAMBAH SOAL (GURU / ADMIN) -->
      <div v-if="currentTab === 'add-question'" class="dashboard-card teacher-card">
        <h2>📝 Form Tambah Soal Kuis Baru</h2>
        <form @submit.prevent="handleAddQuestion" class="form-stack">
          <div class="input-group">
            <label>Mata Pelajaran</label>
            <select v-model="newQuestionCategory" class="full-select">
              <option v-for="cat in categories" :key="cat.id" :value="cat.id">
                {{ cat.icon }} {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="input-group">
            <label>Tuliskan Pertanyaan</label>
            <input v-model="newQuestionText" placeholder="Contoh: Berapakah hasil dari 5 + 5?" required />
          </div>

          <div class="input-group">
            <label>Pilihan Jawaban (Opsi A - D)</label>
            <div class="options-grid-inputs">
              <input v-for="(opt, idx) in 4" :key="idx" v-model="newOptions[idx]" :placeholder="'Opsi ' + (idx + 1)" required />
            </div>
          </div>

          <div class="input-group">
            <label>Jawaban yang Benar (Sama persis dengan salah satu Opsi)</label>
            <input v-model="newCorrectOption" placeholder="Ketikkan jawaban benar persis seperti opsi di atas..." required />
          </div>

          <button type="submit" class="btn-action btn-add-question">Simpan Soal Kuis</button>
        </form>
      </div>

      <!-- KONTEN TAB 3: KELOLA AKUN & ROLE (ADMIN) -->
      <div v-if="currentTab === 'manage-users'" class="dashboard-card admin-card">
        <h2>👤 Panel Pengaturan Akun & Pengguna</h2>
        
        <!-- Form Tambah Akun Baru -->
        <div class="sub-panel">
          <h3>➕ Buat Akun Guru / Murid Baru</h3>
          <form @submit.prevent="handleCreateUser" class="form-grid">
            <div class="input-group">
              <label>Nama Lengkap</label>
              <input v-model="newFullName" placeholder="Contoh: Budi Santoso" />
            </div>
            <div class="input-group">
              <label>Username</label>
              <input v-model="newUsername" placeholder="Contoh: budi_siswa" required />
            </div>
            <div class="input-group">
              <label>Password</label>
              <input v-model="newPassword" type="password" placeholder="Password akun..." required />
            </div>
            <div class="input-group">
              <label>Role Akun</label>
              <select v-model="newAccountRole">
                <option value="murid">Murid</option>
                <option value="guru">Guru</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <button type="submit" class="btn-action btn-add-user">Buat Akun Sekarang</button>
          </form>
        </div>

        <!-- Tabel Daftar Akun -->
        <div class="sub-panel margin-top">
          <h3>⚙️ Kelola Role Pengguna Terdaftar</h3>
          <table class="styled-table">
            <thead>
              <tr>
                <th>Nama Lengkap</th>
                <th>Username</th>
                <th>Role Saat Ini</th>
                <th>Aksi Ubah Role</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="u in allUsers" :key="u.id">
                <td>{{ u.full_name || '-' }}</td>
                <td><strong>{{ u.username }}</strong></td>
                <td><span :class="['role-tag', u.role]">{{ u.role }}</span></td>
                <td>
                  <select :value="u.role" @change="e => updateUserRole(u.id, e.target.value)">
                    <option value="murid">Murid</option>
                    <option value="guru">Guru</option>
                    <option value="admin">Administrator</option>
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