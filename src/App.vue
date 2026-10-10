<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from './supabase/supabase.js'
import Leaderboard from './components/Leaderboard.vue'

const questions = ref([])
const currentIndex = ref(0)
const selectedAnswer = ref(null)
const score = ref(0)
const quizFinished = ref(false)
const loading = ref(true)

// Ambil data soal dari Supabase saat komponen dimuat
onMounted(async () => {
  try {
    const { data, error } = await supabase.from('questions').select('*')
    if (error) throw error
    questions.value = data || []
  } catch (err) {
    console.error('Gagal memuat soal:', err.message)
  } finally {
    loading.value = false
  }
})

// Tambahkan fungsi ini di dalam script setup
const saveScoreToSupabase = async () => {
  try {
    // Contoh: Menyimpan riwayat percobaan kuis ke tabel quiz_attempts
    // Sesuaikan nama kolom dengan struktur tabel di Supabase Anda
    const { error } = await supabase
      .from('quiz_attempts')
      .insert([
        { 
          score: score.value, 
          created_at: new Date() 
          // user_id: 'ID_USER_YANG_LOGIN' (jika sudah ada sistem autentikasi)
        }
      ])

    if (error) throw error
    console.log('Skor berhasil disimpan ke Supabase!')
  } catch (err) {
    console.error('Gagal menyimpan skor:', err.message)
  }
}

const handleAnswer = (option) => {
  selectedAnswer.value = option
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
    saveScoreToSupabase() // <-- Panggil fungsi penyimpanan di sini
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
    <h1>Portal Kuis Interaktif SD</h1>

    <div v-if="loading">Memuat soal dari database...</div>

    <div v-else-if="questions.length === 0">
      <p>Belum ada soal tersedia di database Supabase pada tabel <code>questions</code>.</p>
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
.card, .result-card {
  background: white;
  padding: 24px;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
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
</style>