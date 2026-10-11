<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase/supabase.js'
import Login from './components/Login.vue'
import Register from './components/Register.vue'
import Leaderboard from './components/Leaderboard.vue'

const user = ref(null)
const isRegistering = ref(false)

// State Kuis & Kategori
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

// Cek sesi user saat aplikasi dimuat
onMounted(async () => {
  const { data } = await supabase.auth.getSession()
  user.value = data.session?.user || null

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user || null
  })
})

// Fungsi Logout
const handleLogout = async () => {
  await supabase.auth.signOut()
  resetQuiz()
}

// Memilih Mata Pelajaran & Ambil Soal
const selectCategory = async (category) => {
  selectedCategory.value = category
  loading.value = true
  
  // Ambil soal berdasarkan kategori (atau ambil semua jika belum ada filter di DB)
  const { data, error } = await supabase.from('questions').select('*')
  
  if (error) {
    console.error('Error fetching questions:', error)
  } else {
    questions.value = data || []
  }
  loading.value = false
}

// Pilih Jawaban
const handleSelectAnswer = (option) => {
  selectedAnswer.value = option
}

// Lanjut Soal Berikutnya
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

// Simpan Skor ke Supabase
const saveScore = async () => {
  if (!user.value) return
  await supabase.from('quiz_attempts').insert([
    {
      user_id: user.value.id,
      score: score.value
    }
  ])
}

// Reset Kembali ke Pilihan Mapel
const resetQuiz = () => {
  selectedCategory.value = null
  questions.value = []
  currentIndex.value = 0
  score.value = 0
  quizFinished.value = false
  selectedAnswer.value = null
}
</script>

<template>
  <div class="app-container">
    <!-- Header -->
    <header class="main-header">
      <h1>🎓 Portal Kuis Interaktif SD</h1>
      <div v-if="user" class="user-badge">
        <span>Halo, <strong>{{ user.email.split('@')[0] }}</strong>!</span>
        <button @click="handleLogout" class="btn-logout">Keluar</button>
      </div>
    </header>

    <!-- Tampilan Sebelum Login -->
    <main v-if="!user" class="auth-wrapper">
      <Register v-if="isRegistering" @toggle="isRegistering = false" />
      <Login v-else @toggle="isRegistering = true" />
    </main>

    <!-- Tampilan Setelah Login -->
    <main v-else class="content-wrapper">
      
      <!-- 1. PILIHAN MATA PELAJARAN (Jika belum memilih mapel) -->
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

      <!-- 2. HALAMAN KUIS (Jika mapel sudah dipilih) -->
      <section v-else class="quiz-section">
        <button @click="resetQuiz" class="btn-back">⬅ Kembali ke Pilihan Mapel</button>

        <div v-if="loading" class="loading-state">
          <p>⏳ Memuat soal...</p>
        </div>

        <!-- Jika tidak ada soal -->
        <div v-else-if="questions.length === 0" class="empty-state">
          <h3>Belum ada soal untuk {{ selectedCategory.name }}</h3>
          <p>Silakan tambahkan data di tabel <code>questions</code> Supabase[cite: 7].</p>
        </div>

        <!-- Jika Kuis Selesai -->
        <div v-else-if="quizFinished" class="result-card">
          <h2>🎉 Kuis Selesai!</h2>
          <p class="final-score">Skor Kamu: <span>{{ score }}</span></p>
          <button @click="resetQuiz" class="btn-restart">Coba Lagi / Pilih Mapel Lain</button>
        </div>

        <!-- Tampilan Soal Kuis -->
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
              @click="handleSelectAnswer(opt)"
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

    </main>
  </div>
</template>