<script setup>
// [TIM] PANEL GURU/ADMIN - buat kuis di sini (Tab "Buat Kuis & Soal").
// Alurnya 2 langkah:
//   Langkah 1: isi info kuis (mapel, judul, jumlah soal, durasi) -> insert ke tabel `quizzes`.
//   Langkah 2: masukin soal satu-satu ke sesi kuis itu -> insert ke tabel `questions`.
// Yang udah kita benerin dari versi lama:
//   - Jawaban benar sekarang milih lewat dropdown (bukan ketik manual), jadi nggak mungkin
//     beda huruf/spasi sama opsi -> skor murid akurat.
//   - Validasi udah lengkap: opsi nggak boleh kosong/dobel, jumlah soal dibatasi 1-40.
//   - Semua alert() udah ditukar toast (nggak blokir) dan error database diurus bener.

import { ref, computed } from 'vue'
import { supabase } from '../supabase/supabase.js'
import { toast } from '../composables/useToast.js'

const props = defineProps({
  user: { type: Object, required: true },      // [TIM] Guru/admin yang lagi login, disimpen di kolom created_by.
  categories: { type: Array, required: true }  // [TIM] Daftar mapel buat dropdown.
})

// [TIM] State ngatur panel lagi di langkah mana ('create-quiz' | 'add-questions').
const teacherStep = ref('create-quiz')

// [TIM] Form Langkah 1 - info kuis.
const newQuizCategory = ref(props.categories[0]?.id ?? 'math')
const newQuizTitle = ref('')
const newQuizTotalQ = ref(10)
const newQuizDuration = ref(30)

// [TIM] State Langkah 2 - input soal.
const createdQuizId = ref(null)
const createdQuizTitle = ref('')
const addedQuestionsCount = ref(0)
const submitting = ref(false) // [TIM] Biar nggak klik ganda pas nyimpen soal/kuis.

const newQuestionText = ref('')
const newOptions = ref(['', '', '', ''])
const newCorrectOption = ref('')

// [TIM] Opsi yang udah diisi (buat dropdown jawaban benar, yang nongol cuma opsi yang nggak kosong).
const filledOptions = computed(() => newOptions.value.map((o) => o.trim()).filter(Boolean))

// [TIM] Langkah 1 - simpen sesi kuis baru ke tabel `quizzes`.
const handleCreateQuizSession = async () => {
  if (!newQuizTitle.value.trim()) {
    return toast.error('Judul kuis (misal: Quiz Week 1) wajib diisi!')
  }
  if (newQuizTotalQ.value < 1 || newQuizTotalQ.value > 40) {
    return toast.error('Jumlah soal harus antara 1 sampai 40.')
  }

  submitting.value = true
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .insert([{
        category_id: newQuizCategory.value,
        title: newQuizTitle.value.trim(),
        total_questions: newQuizTotalQ.value,
        duration_minutes: newQuizDuration.value,
        created_by: props.user.id
      }])
      .select()
      .single()

    if (error) throw error

    // [TIM] Pindihin data kuis ke state terpisah biar nggak ikut ke-reset pas form Step 1 dibersihin.
    createdQuizId.value = data.id
    createdQuizTitle.value = data.title
    addedQuestionsCount.value = 0
    teacherStep.value = 'add-questions'
    toast.success(`Sesi "${data.title}" dibuat! Sekarang masukkan ${data.total_questions} soal.`)
  } catch (err) {
    toast.error('Gagal membuat sesi kuis: ' + err.message)
  } finally {
    submitting.value = false
  }
}

// [TIM] Reset total form langkah 2 terus balik ke langkah 1.
const quitAddingQuestions = () => {
  teacherStep.value = 'create-quiz'
  createdQuizId.value = null
  createdQuizTitle.value = ''
  addedQuestionsCount.value = 0
  newQuestionText.value = ''
  newOptions.value = ['', '', '', '']
  newCorrectOption.value = ''
}

// [TIM] Langkah 2 - validasi terus simpen satu soal ke tabel `questions`.
const handleAddQuestionToQuiz = async () => {
  const questionText = newQuestionText.value.trim()
  const options = newOptions.value.map((o) => o.trim())

  if (!questionText) return toast.error('Tuliskan pertanyaan dulu!')
  if (options.some((o) => !o)) return toast.error('Keempat pilihan jawaban (A-D) harus diisi!')
  if (new Set(options).size !== options.length) return toast.error('Pilihan jawaban tidak boleh ada yang sama.')
  if (!newCorrectOption.value) return toast.error('Pilih jawaban benar dari dropdown!')

  submitting.value = true
  try {
    const { error } = await supabase.from('questions').insert([{
      quiz_id: createdQuizId.value,
      category_id: newQuizCategory.value,
      question_text: questionText,
      options, // [TIM] Disimpen sebagai array JSONB sesuai skema tabel.
      correct_option: newCorrectOption.value
    }])

    if (error) throw error

    addedQuestionsCount.value++

    // [TIM] Reset cuma bagian teks & kunci; opsi A-D kita kosongin juga soalnya guru kadang
    // pake opsi yg sama buat soal serupa, takutan kepindah dobel.
    newQuestionText.value = ''
    newOptions.value = ['', '', '', '']
    newCorrectOption.value = ''

    if (addedQuestionsCount.value >= newQuizTotalQ.value) {
      toast.success(`Selesai! Semua ${newQuizTotalQ.value} soal kuis "${createdQuizTitle.value}" tersimpan.`)
      quitAddingQuestions()
    } else {
      toast.success(`Soal tersimpan! Lanjutkan soal berikutnya (${addedQuestionsCount.value}/${newQuizTotalQ.value}).`)
    }
  } catch (err) {
    toast.error('Gagal tambah soal: ' + err.message)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="dashboard-card teacher-card">
    <h2>Halaman Pembuatan Kuis Baru</h2>

    <!-- [TIM] Step A: Informasi Kuis -->
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
          <input v-model="newQuizTitle" placeholder="Ketik nama kuis..." maxlength="100" required />
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

        <button type="submit" class="btn-action btn-add-question" :disabled="submitting">
          <span v-if="submitting" class="btn-spinner" aria-hidden="true"></span>{{ submitting ? 'Menyimpan...' : 'Lanjut ke Input Soal →' }}
        </button>
      </form>
    </div>

    <!-- [TIM] Step B: Input Soal -->
    <div v-else>
      <div class="quiz-creation-header">
        <h3>Langkah 2: Masukkan Soal ({{ Math.min(addedQuestionsCount + 1, newQuizTotalQ) }} dari {{ newQuizTotalQ }})</h3>
        <span class="active-quiz-badge">Sesi: {{ createdQuizTitle }}</span>
      </div>

      <form @submit.prevent="handleAddQuestionToQuiz" class="form-stack">
        <div class="input-group">
          <label>Tuliskan Pertanyaan</label>
          <input v-model="newQuestionText" placeholder="Contoh: Berapakah hasil 2 + 2?" maxlength="500" required />
        </div>

        <div class="input-group">
          <label>Pilihan Jawaban (Opsi A - D)</label>
          <div class="options-grid-inputs">
            <input
              v-for="idx in 4"
              :key="idx"
              v-model="newOptions[idx - 1]"
              :placeholder="'Opsi ' + idx"
              maxlength="200"
              required
            />
          </div>
        </div>

        <!-- [TIM] Dropdown jawaban benar - milih dari opsi yang udah diketik, bukan ketik ulang,
             biar nilainya (string) dijamin sama persis sama data soal. -->
        <div class="input-group">
          <label>Jawaban Benar</label>
          <select v-model="newCorrectOption" required>
            <option value="" disabled>Pilih jawaban benar...</option>
            <option v-for="(opt, idx) in filledOptions" :key="idx" :value="opt">{{ opt }}</option>
          </select>
        </div>

        <div class="teacher-step-actions">
          <button type="submit" class="btn-action btn-add-question" :disabled="submitting">
            <span v-if="submitting" class="btn-spinner" aria-hidden="true"></span>{{ submitting ? 'Menyimpan...' : 'Simpan Soal Ini' }}
          </button>
          <button type="button" @click="quitAddingQuestions" class="btn-nav">← Selesai Nanti / Batal</button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* [TIM] Baris tombol aksi di langkah 2 (simpan + batal) biar sejajar. */
.teacher-step-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
</style>
