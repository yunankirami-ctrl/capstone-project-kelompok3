<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { toast } from '../composables/useToast.js'

const props = defineProps({
  quiz: { type: Object, required: true },        // Baris sesi kuis dari tabel `quizzes`.
  questions: { type: Array, required: true }     // Daftar soal dari tabel `questions`.
})

const emit = defineEmits(['finish', 'exit'])

// State pas lagi ngerjain.
const currentIndex = ref(0)
const userAnswers = ref({}) // Formatnya { nomorSoal: teksJawabanYangDipilih }.
const submitting = ref(false) // Biar tombol finish nggak diklik dua kali.
const zoomImage = ref(null)   // URL gambar yang lagi diperbesar (lightbox); null = tertutup.

// State timer.
const timeLeft = ref(0)
let timerInterval = null
const timeUp = ref(false) // Penanda waktu habis -> finish otomatis tanpa konfirmasi.

// Skor akhir dihitung proporsional skala 100 dari jumlah jawaban bener.
const finalScore = computed(() => {
  const totalQ = props.questions.length
  if (totalQ === 0) return 0
  const correctCount = props.questions.filter(
    (q, idx) => userAnswers.value[idx] === q.correct_option
  ).length
  return Math.round((correctCount / totalQ) * 100)
})

// Timer hitung mundur; pas habis, kuis langsung dikumpulin otomatis.
const startTimer = () => {
  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      clearInterval(timerInterval)
      timeUp.value = true 
      toast.error('Waktu habis! Jawaban otomatis dikumpulkan.')
      finishQuiz()
    }
  }, 1000)
}

// Format detik.
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// Jalanin timer pas komponen pertama muncul.
const resetAndStart = () => {
  submitting.value = false
  timeUp.value = false
  currentIndex.value = 0
  userAnswers.value = {}
  timeLeft.value = (props.quiz.duration_minutes || 30) * 60
  startTimer()
}

onMounted(resetAndStart)

// Pilih jawaban buat soal yang lagi dibuka.
const selectAnswer = (opt) => {
  userAnswers.value[currentIndex.value] = opt
}

const prevQuestion = () => {
  if (currentIndex.value > 0) currentIndex.value--
}

const nextQuestion = () => {
  if (currentIndex.value < props.questions.length - 1) currentIndex.value++
}

// Kuis selesai.
const finishQuiz = async () => {
  if (submitting.value) return

  const unanswered = props.questions.length - Object.keys(userAnswers.value).length
  if (unanswered > 0 && timeLeft.value > 0 && !timeUp.value) {
    // Konfirmasi cuma kalo masih ada waktu; kalo waktu udah habis, jawaban langsung masuk.
    const sure = window.confirm(
      `Masih ada ${unanswered} soal yang belum dijawab. Yakin ingin mengumpulkan sekarang?`
    )
    if (!sure) return
    startTimer()
    return
  }

  submitting.value = true
  clearInterval(timerInterval)

  // Skor diserahin ke App.vue.
  emit('finish', { score: finalScore.value })
}

const exit = () => emit('exit')

// Bersihin interval pas komponen dilepas.
onUnmounted(() => clearInterval(timerInterval))
</script>

<template>
  <section class="quiz-section">
    <button @click="exit" class="btn-back">← Kembali ke Daftar Kuis</button>

    <!-- Kartu soal yang lagi dibuka -->
    <div v-if="questions.length > 0" class="question-card">
      <div class="quiz-header">
        <span class="badge-cat">{{ quiz.title }}</span>
        <div class="timer-badge" :class="{ danger: timeLeft <= 60 }">
          Waktu: <strong>{{ formatTime(timeLeft) }}</strong>
        </div>
        <span class="progress-text">Soal {{ currentIndex + 1 }} dari {{ questions.length }}</span>
      </div>

      <h3 class="q-text">{{ questions[currentIndex].question_text }}</h3>

      <img
        v-if="questions[currentIndex].image_url"
        :key="questions[currentIndex].id"
        :src="questions[currentIndex].image_url"
        class="q-image"
        alt="Gambar soal"
        loading="lazy"
        @click="zoomImage = questions[currentIndex].image_url"
        @error="$event.target.style.display = 'none'"
      />

      <div class="options-grid">
        <button
          v-for="(opt, idx) in questions[currentIndex].options"
          :key="idx"
          :class="['option-btn', { active: userAnswers[currentIndex] === opt }]"
          @click="selectAnswer(opt)"
        >
          {{ opt }}
        </button>
      </div>

      <div class="quiz-nav-footer">
        <button @click="prevQuestion" :disabled="currentIndex === 0" class="btn-nav">← Sebelumnya</button>

        <button
          v-if="currentIndex < questions.length - 1"
          @click="nextQuestion"
          class="btn-nav btn-primary-nav"
        >Selanjutnya →</button>
        <button v-else @click="finishQuiz" :disabled="submitting" class="btn-finish">
          <span v-if="submitting" class="btn-spinner" aria-hidden="true"></span>Selesai &amp; Kirim Jawaban (Finish)
        </button>
      </div>
    </div>

    <!-- Pengaman kalo ternyata soal kosong -->
    <div v-else class="empty-state">
      <p>Kuis ini belum memiliki soal. Hubungi guru Anda.</p>
    </div>

    <!-- Lightbox: klik gambar soal buat memperbesar, klik mana aja buat nutup. -->
    <div v-if="zoomImage" class="img-lightbox" @click="zoomImage = null">
      <img :src="zoomImage" alt="Gambar soal diperbesar" class="img-lightbox-img" />
      <span class="img-lightbox-hint">Klik di mana saja untuk menutup</span>
    </div>
  </section>
</template>

<style scoped>
/* Style khusus halaman kerjain kuis */
.quiz-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 16px;
}

.badge-cat {
  background: #e0e7ff;
  color: #3730a3;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  font-size: 0.9rem;
}

.progress-text {
  color: #6b7280;
  font-size: 0.85rem;
}

/* Timer jadi merah pas sisa waktu mau habis */
.timer-badge.danger {
  background: #ef4444;
  color: white;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  50% { opacity: 0.7; }
}

.q-text {
  font-size: 1.15rem;
  color: #1f2937;
  margin-bottom: 8px;
}

.question-card {
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.empty-state {
  background: white;
  border: 2px dashed #e5e7eb;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  color: #6b7280;
}

/* Gambar soal: selalu muat, rasio asli dijaga, nggak pernah kepotong/meleber. */
.q-image {
  display: block;
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  margin-bottom: 16px;
  cursor: zoom-in;
}

.img-lightbox {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(15, 23, 42, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  cursor: zoom-out;
}
.img-lightbox-img {
  max-width: 100%;
  max-height: 85vh;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
}
.img-lightbox-hint {
  position: absolute;
  bottom: 18px;
  color: #e2e8f0;
  font-size: 0.85rem;
}

@media (max-width: 640px) {
  .question-card,
  .empty-state { padding: 16px; }
  .q-image { max-height: 200px; }
}
</style>
