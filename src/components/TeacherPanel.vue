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
// ================= BAGIAN KELOLA & HAPUS =================
// [TIM] Mode panel: 'create' (wizard bikin kuis) atau 'manage' (liat & hapus kuis/soal).
// Admin juga lewat panel ini soalnya admin itu bagian dari staff (is_staff() = guru + admin).
const panelMode = ref('create')
const quizRows = ref([])
const loadingManage = ref(false)
const expandedQuizId = ref(null)
const quizQuestions = ref([])
const loadingQuestions = ref(false)
const deleting = ref(false) // [TIM] Kunci biar nggak klik hapus dobel pas proses jalan.
// [TIM] Simpan id yang lagi nunggu konfirmasi hapus (pola 2 langkah, pengganti confirm()).
const pendingDeleteQuiz = ref(null)
const pendingDeleteQuestion = ref(null)

// [TIM] Nama mapel buat label, dicocokin dari id kategori.
const categoryName = (id) => props.categories.find((c) => c.id === id)?.name ?? id

// [TIM] Pindah ke mode kelola + langsung ambil daftar semua kuis.
const switchToManage = () => {
  panelMode.value = 'manage'
  loadQuizList()
}

// [TIM] Ambil semua sesi kuis (policy RLS select ngebolehin staff baca penuh).
const loadQuizList = async () => {
  loadingManage.value = true
  expandedQuizId.value = null
  quizQuestions.value = []
  pendingDeleteQuiz.value = null
  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    quizRows.value = data || []
  } catch (err) {
    toast.error('Gagal memuat daftar kuis: ' + err.message)
  } finally {
    loadingManage.value = false
  }
}

// [TIM] Buka/tutup daftar soal milik satu kuis, buat hapus satuan.
const toggleManageQuiz = async (quizId) => {
  pendingDeleteQuestion.value = null
  if (expandedQuizId.value === quizId) {
    expandedQuizId.value = null
    quizQuestions.value = []
    return
  }
  expandedQuizId.value = quizId
  quizQuestions.value = []
  loadingQuestions.value = true
  try {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('quiz_id', quizId)
      .order('created_at', { ascending: true })
    if (error) throw error
    quizQuestions.value = data || []
  } catch (err) {
    toast.error('Gagal memuat soal: ' + err.message)
  } finally {
    loadingQuestions.value = false
  }
}

// [TIM] Hapus satu kuis UTUH. Soal + riwayatnya ikut kehapus otomatis (cascade di DB).
const confirmDeleteQuiz = async (quiz) => {
  if (deleting.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('quizzes').delete().eq('id', quiz.id)
    if (error) throw error
    quizRows.value = quizRows.value.filter((r) => r.id !== quiz.id)
    if (expandedQuizId.value === quiz.id) {
      expandedQuizId.value = null
      quizQuestions.value = []
    }
    pendingDeleteQuiz.value = null
    toast.success(`Kuis "${quiz.title}" dihapus, beserta soal & riwayatnya.`)
  } catch (err) {
    toast.error('Gagal menghapus kuis: ' + err.message)
    pendingDeleteQuiz.value = null
  } finally {
    deleting.value = false
  }
}

// [TIM] Hapus satu soal di dalem kuis yang lagi dibuka.
const confirmDeleteQuestion = async (q) => {
  if (deleting.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    if (error) throw error
    quizQuestions.value = quizQuestions.value.filter((x) => x.id !== q.id)
    pendingDeleteQuestion.value = null
    toast.success('Soal berhasil dihapus.')
  } catch (err) {
    toast.error('Gagal menghapus soal: ' + err.message)
    pendingDeleteQuestion.value = null
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="dashboard-card teacher-card">
    <h2>{{ panelMode === 'manage' ? 'Kelola & Hapus Kuis' : 'Halaman Pembuatan Kuis Baru' }}</h2>

    <!-- [TIM] Switch mode: bikin baru vs kelola/hapus. Dua-duanya cuma buat staff (guru/admin). -->
    <div class="panel-mode-switch">
      <button :class="['mode-btn', { active: panelMode === 'create' }]" @click="panelMode = 'create'">Buat Kuis Baru</button>
      <button :class="['mode-btn', { active: panelMode === 'manage' }]" @click="switchToManage">Kelola & Hapus Kuis</button>
    </div>

    <!-- [TIM] MODE CREATE: wizard 2 langkah (info kuis -> input soal). -->
    <div v-if="panelMode === 'create'">
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

    <!-- [TIM] MODE MANAGE: daftar kuis -> hapus kuis utuh / buka buat hapus soal satuan. -->
    <div v-else class="manage-section">
      <div class="manage-toolbar">
        <button class="btn-nav" @click="loadQuizList" :disabled="loadingManage"><span v-if="loadingManage" class="btn-spinner" aria-hidden="true"></span>{{ loadingManage ? 'Memuat...' : 'Muat Ulang' }}</button>
      </div>

      <div v-if="loadingManage" class="manage-state"><p>Memuat daftar kuis...</p></div>
      <div v-else-if="quizRows.length === 0" class="manage-state empty"><p>Belum ada kuis yang dibuat.</p></div>

      <ul v-else class="manage-list">
        <li v-for="quiz in quizRows" :key="quiz.id" class="manage-item">
          <div class="manage-item-head">
            <div class="manage-info">
              <strong>{{ quiz.title }}</strong>
              <span class="manage-meta">{{ categoryName(quiz.category_id) }} • {{ quiz.total_questions }} soal • {{ quiz.duration_minutes }} menit</span>
            </div>
            <div class="manage-actions">
              <button class="btn-nav" @click="toggleManageQuiz(quiz.id)">{{ expandedQuizId === quiz.id ? 'Tutup Soal' : 'Lihat & Hapus Soal' }}</button>
              <!-- [TIM] Konfirmasi 2 langkah: klik 'Hapus Kuis' dulu, baru muncul 'Yakin'. -->
              <template v-if="pendingDeleteQuiz === quiz.id">
                <button class="btn-danger" @click="confirmDeleteQuiz(quiz)" :disabled="deleting">Yakin, Hapus Kuis</button>
                <button class="btn-nav" @click="pendingDeleteQuiz = null">Batal</button>
              </template>
              <button v-else class="btn-danger-outline" @click="pendingDeleteQuiz = quiz.id">Hapus Kuis</button>
            </div>
          </div>

          <!-- [TIM] Soal satuan: nongol pas kuis ini dibuka. Tiap baris punya hapus sendiri. -->
          <div v-if="expandedQuizId === quiz.id" class="manage-questions">
            <div v-if="loadingQuestions" class="manage-state"><p>Memuat soal...</p></div>
            <div v-else-if="quizQuestions.length === 0" class="manage-state empty"><p>Belum ada soal di kuis ini.</p></div>
            <ul v-else class="question-manage-list">
              <li v-for="q in quizQuestions" :key="q.id" class="question-manage-item">
                <span class="q-manage-text">{{ q.question_text }}</span>
                <template v-if="pendingDeleteQuestion === q.id">
                  <button class="btn-danger" @click="confirmDeleteQuestion(q)" :disabled="deleting">Yakin, Hapus</button>
                  <button class="btn-nav" @click="pendingDeleteQuestion = null">Batal</button>
                </template>
                <button v-else class="btn-danger-outline" @click="pendingDeleteQuestion = q.id">Hapus Soal</button>
              </li>
            </ul>
          </div>
        </li>
      </ul>
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

/* [TIM] Switch mode Buat/Kelola di panel guru. */
.panel-mode-switch {
  display: flex;
  gap: 8px;
  margin: 12px 0 20px;
  flex-wrap: wrap;
}
.mode-btn {
  border: 2px solid #e5e7eb;
  background: #f9fafb;
  color: #374151;
  padding: 8px 16px;
  border-radius: 10px;
  font-weight: 600;
  cursor: pointer;
}
.mode-btn.active {
  border-color: #4f46e5;
  background: #eef2ff;
  color: #4f46e5;
}

/* [TIM] Section kelola & hapus kuis. */
.manage-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}
.manage-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.manage-item {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px 16px;
  background: #fff;
}
.manage-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.manage-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.manage-info strong {
  font-size: 1.05rem;
}
.manage-meta {
  color: #6b7280;
  font-size: 0.85rem;
}
.manage-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.manage-questions {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e5e7eb;
}
.question-manage-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.question-manage-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f9fafb;
  flex-wrap: wrap;
}
.q-manage-text {
  flex: 1;
  min-width: 200px;
}
.manage-state {
  text-align: center;
  color: #6b7280;
  padding: 20px;
}
.manage-state.empty p {
  margin: 0;
}

/* [TIM] Tombol bahaya buat aksi hapus (destruktif). */
.btn-danger {
  border: none;
  background: #ef4444;
  color: #fff;
  padding: 8px 14px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn-danger-outline {
  border: 2px solid #ef4444;
  background: transparent;
  color: #ef4444;
  padding: 6px 12px;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}
.btn-danger-outline:hover {
  background: #fef2f2;
}
</style>
