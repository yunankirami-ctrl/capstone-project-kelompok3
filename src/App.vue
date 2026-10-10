<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase/supabase.js'
import Login from './components/Login.vue'
import Register from './components/Register.vue'
import Leaderboard from './components/Leaderboard.vue'

// Status Autentikasi & Navigasi Form
const currentUser = ref(null)
const loadingSession = ref(true)
const isRegisterMode = ref(false) // Mengatur tampilan Login atau Register

// Data Kuis
const questions = ref([])
const currentIndex = ref(0)
const selectedAnswer = ref(null)
const score = ref(0)
const quizFinished = ref(false)
const loadingQuiz = ref(false)

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    currentUser.value = session.user
    fetchQuestions()
  }
  loadingSession.value = false

  supabase.auth.onAuthStateChange((_event, session) => {
    currentUser.value = session?.user || null
    if (currentUser.value) {
      fetchQuestions()
    }
  })
})

const fetchQuestions = async () => {
  loadingQuiz.value = true
  try {
    const { data, error } = await supabase.from('questions').select('*')
    if (error) throw error
    questions.value = data || []
  } catch (err) {
    console.error('Gagal memuat soal:', err.message)
  } finally {
    loadingQuiz.value = false
  }
}

const handleLoginSuccess = (user) => {
  currentUser.value = user
}

const handleLogout = async () => {
  await supabase.auth.signOut()
  currentUser.value = null
  restartQuiz()
}

const handleAnswer = (option) => {
  selectedAnswer.value = option
}

const saveScoreToSupabase = async () => {
  try {
    const { error } = await supabase
      .from('quiz_attempts')
      .insert([
        { 
          score: score.value, 
          created_at: new Date(),
          user_id: currentUser.value?.id 
        }
      ])

    if (error) throw error
    console.log('Skor berhasil disimpan ke Supabase!')
  } catch (err) {
    console.error('Gagal menyimpan skor:', err.message)
  }
}

const nextQuestion = () => {
  const currentQ = questions.value[currentIndex.value]
  if (selectedAnswer.value === currentQ.answer) {
    score.value += 10
  }

  selectedAnswer.value = null
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value++
  } else {
    quizFinished.value = true
    saveScoreToSupabase()
  }
}

const restartQuiz = () => {
  currentIndex.value = 0
  score.value = 0
  selectedAnswer.value = null
  quizFinished.value = false
}
</script>

<template>
  <main class="quiz-container">
    <div class="header-bar" v-if="currentUser">
      <span class="user-email">Halo, {{ currentUser.email }}</span>
      <button @click="handleLogout" class="logout-btn">Keluar</button>
    </div>

    <h1>Portal Kuis Interaktif SD</h1>

    <div v-if="loadingSession">
      <p class="center-text">Memeriksa sesi...</p>
    </div>

    <!-- Bagian Auth: Tampil jika belum login -->
    <div v-else-if="!currentUser">
      <!-- Tampilkan Register atau Login berdasarkan nilai isRegisterMode -->
      <div v-if="isRegisterMode">
        <Register @switch-to-login="isRegisterMode = false" />
      </div>
      <div v-else>
        <Login @login-success="handleLoginSuccess" />
        <p class="switch-auth-text">
          Belum punya akun? 
          <button @click="isRegisterMode = true" class="text-link">Daftar di sini</button>
        </p>
      </div>
    </div>

    <!-- Bagian Utama Kuis: Tampil jika sudah login -->
    <div v-else>
      <div v-if="loadingQuiz">
        <p class="center-text">Memuat soal kuis...</p>
      </div>

      <div v-else-if="questions.length === 0">
        <p class="center-text">Belum ada soal tersedia di tabel <code>questions</code>.</p>
      </div>

      <div v-else-if="!quizFinished">
        <div class="card">
          <h3>Soal {{ currentIndex + 1 }} dari {{ questions.length }}</h3>
          <p class="question-text">{{ questions[currentIndex].question_text }}</p>

          <div class="options">
            <button 
              v-for="(opt, idx) in questions[currentIndex].options" 
              :key="idx"
              :class="{ selected: selectedAnswer === opt }"
              @click="handleAnswer(opt)"
              class="option-btn"
            >
              {{ opt }}
            </button>
          </div>

          <button 
            class="next-btn" 
            :disabled="!selectedAnswer" 
            @click="nextQuestion"
          >
            {{ currentIndex === questions.length - 1 ? 'Selesai' : 'Selanjutnya' }}
          </button>
        </div>
      </div>

      <div v-else class="result-card">
        <h2>Kuis Selesai! 🎉</h2>
        <p>Skor Akhir Anda: <strong>{{ score }}</strong></p>
        <button @click="restartQuiz" class="next-btn">Ulangi Kuis</button>
      </div>

      <Leaderboard />
    </div>
  </main>
</template>

<style scoped>
.quiz-container {
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background: #f9f9f9;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}
.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  background: white;
  padding: 10px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.03);
}
.user-email {
  font-size: 0.9rem;
  color: #475569;
  font-weight: 500;
}
.logout-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}
.center-text {
  text-align: center;
  color: #64748b;
  margin: 20px 0;
}
.card, .result-card {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  margin-bottom: 20px;
}
.question-text {
  font-size: 1.1rem;
  margin-bottom: 20px;
  font-weight: 500;
}
.options {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 20px;
}
.option-btn {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  text-align: left;
  font-size: 1rem;
  transition: all 0.2s;
}
.option-btn:hover {
  border-color: #4f46e5;
}
.option-btn.selected {
  background: #e0e7ff;
  border-color: #4f46e5;
  color: #312e81;
  font-weight: 600;
}
.next-btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  width: 100%;
}
.next-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
.switch-auth-text {
  text-align: center;
  margin-top: 15px;
  font-size: 0.9rem;
  color: #64748b;
}
.text-link {
  background: none;
  border: none;
  color: #4f46e5;
  cursor: pointer;
  font-weight: 600;
  padding: 0;
}
.text-link:hover {
  text-decoration: underline;
}
</style>