<script setup>
// [TIM] HALAMAN KERJAIN KUIS - di sini murid ngerjain soal (Step 3 alur murid).
// Fungsinya:
//   - Nampilin soal satu-satu, ada tombol Sebelumnya/Selanjutnya.
//   - Timer hitung mundur; kalo waktu habis -> jawaban otomatis dikumpulin.
//   - Hitung skor (skala 100) terus emits 'finish' (score) ke App.vue buat_disimpen ke DB.
// PENTING buat rekan setim:
//   - Komponen ini SENGAJA nggak nulis ke database. Nyimpan quiz_attempts, layar hasil,
//     sama tombol Ulangi/Kembali semua diurus App.vue (biar alur data cuma satu tempat).
//   - Kalo mau percobaan baru, App.vue naikkkin quizPlayerKey jadi komponen ini remount
//     dan state soal/timer otomatis fresh lagi (lewat onMounted).

import { ref, computed, onMounted, onUnmounted } from 'vue'
import { toast } from '../composables/useToast.js'

const props = defineProps({
  quiz: { type: Object, required: true },        // [TIM] Baris sesi kuis dari tabel `quizzes` (judul & durasi).
  questions: { type: Array, required: true }     // [TIM] Daftar soal dari tabel `questions` ( udah diacak App.vue).
})

const emit = defineEmits(['finish', 'exit'])

// [TIM] State pas lagi ngerjain.
const currentIndex = ref(0)
const userAnswers = ref({}) // [TIM] Formatnya { nomorSoal: teksJawabanYangDipilih }.
const submitting = ref(false) // [TIM] Biar tombol finish nggak diklik dua kali.

// [TIM] State timer.
const timeLeft = ref(0)
let timerInterval = null
const timeUp = ref(false) // [TIM] Penanda waktu habis -> finish otomatis tanpa konfirmasi.

// [TIM] Skor akhir dihitung proporsional skala 100 dari jumlah jawaban bener.
const finalScore = computed(() => {
  const totalQ = props.questions.length
  if (totalQ === 0) return 0
  const correctCount = props.questions.filter(
    (q, idx) => userAnswers.value[idx] === q.correct_option
  ).length
  return Math.round((correctCount / totalQ) * 100)
})

// [TIM] Timer hitung mundur; pas habis, kuis langsung dikumpulin otomatis.
const startTimer = () => {
  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      clearInterval(timerInterval)
      timeUp.value = true // [TIM] Set flag DULU sebelum finish biar dialog konfirmasi dilewatin.
      toast.error('Waktu habis! Jawaban otomatis dikumpulkan.')
      finishQuiz()
    }
  }, 1000)
}

// [TIM] Format detik -> MM:SS buat tampilan badge timer.
const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

// [TIM] Jalanin timer pas komponen pertama muncul. Remount (quizPlayerKey di App.vue)
// bikin state soal/timer selalu fresh tiap percobaan baru.
const resetAndStart = () => {
  submitting.value = false
  timeUp.value = false
  currentIndex.value = 0
  userAnswers.value = {}
  timeLeft.value = (props.quiz.duration_minutes || 30) * 60
  startTimer()
}

onMounted(resetAndStart)

// [TIM] Milih jawaban buat soal yang lagi dibuka.
const selectAnswer = (opt) => {
  userAnswers.value[currentIndex.value] = opt
}

const prevQuestion = () => {
  if (currentIndex.value > 0) currentIndex.value--
}

const nextQuestion = () => {
  if (currentIndex.value < props.questions.length - 1) currentIndex.value++
}

// [TIM] Beresin kuis: stop timer, terus serahin skor ke App.vue buat_disimpen.
const finishQuiz = async () => {
  if (submitting.value) return

  const unanswered = props.questions.length - Object.keys(userAnswers.value).length
  if (unanswered > 0 && timeLeft.value > 0 && !timeUp.value) {
    // [TIM] Konfirmasi cuma kalo masih ada waktu; kalo waktu udah habis, jawaban langsung masuk.
    const sure = window.confirm(
      `Masih ada ${unanswered} soal yang belum dijawab. Yakin ingin mengumpulkan sekarang?`
    )
    if (!sure) return
    startTimer() // [TIM] Lanjutin timer lagi kalo batal ngumpulin.
    return
  }

  submitting.value = true
  clearInterval(timerInterval)

  // [TIM] Skor diserahin ke App.vue; yang mutusin "resmi leaderboard atau nggak" itu App
  // (dia yang punya riwayat quiz_attempts & flag firstAttempt).
  emit('finish', { score: finalScore.value })
}

const exit = () => emit('exit')

// [TIM] Beresin interval pas komponen dilepas, biar nggak ada timer hantu jalan terus.
onUnmounted(() => clearInterval(timerInterval))
</script>

<template>
  <section class="quiz-section">
    <button @click="exit" class="btn-back">← Kembali ke Daftar Kuis</button>

    <!-- [TIM] Kartu soal yang lagi dibuka -->
    <div v-if="questions.length > 0" class="question-card">
      <div class="quiz-header">
        <span class="badge-cat">{{ quiz.title }}</span>
        <div class="timer-badge" :class="{ danger: timeLeft <= 60 }">
          Waktu: <strong>{{ formatTime(timeLeft) }}</strong>
        </div>
        <span class="progress-text">Soal {{ currentIndex + 1 }} dari {{ questions.length }}</span>
      </div>

      <h3 class="q-text">{{ questions[currentIndex].question_text }}</h3>

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

    <!-- [TIM] Pengaman kalo ternyata soal kosong -->
    <div v-else class="empty-state">
      <p>Kuis ini belum memiliki soal. Hubungi guru Anda.</p>
    </div>
  </section>
</template>

<style scoped>
/* [TIM] Style khusus halaman kerjain kuis; kelas umum (btn-back, option-btn, timer-badge)
   udah ada di style.css global. */
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

/* [TIM] Timer jadi merah pas sisa waktu <= 1 menit biar siswa waspada. */
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

/* [TIM] RESPONSIVE: di HP kartu soal & state kosong dipadetin dikit biar muat lega.
   Sengaja di scoped sini karena style global nggak bisa nimpa kelas di komponen ini. */
@media (max-width: 640px) {
  .question-card,
  .empty-state { padding: 16px; }
}
</style>
