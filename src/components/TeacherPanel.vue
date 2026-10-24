<script setup>
import { ref, computed } from 'vue'
import { supabase } from '../supabase/supabase.js'
import { toast } from '../composables/useToast.js'

const props = defineProps({
  user: { type: Object, required: true }, 
  categories: { type: Array, required: true } 
})

const teacherStep = ref('create-quiz')

// Form Langkah 1 - info kuis.
const newQuizCategory = ref(props.categories[0]?.id ?? 'math')
const newQuizTitle = ref('')
const newQuizTotalQ = ref(10)
const newQuizDuration = ref(30)

// State Langkah 2 - input soal.
const createdQuizId = ref(null)
const createdQuizTitle = ref('')
const addedQuestionsCount = ref(0)
const submitting = ref(false) 

const newQuestionText = ref('')
const newOptions = ref(['', '', '', ''])
const newCorrectOption = ref('')

// Gambar soal (opsional).
const IMAGE_BUCKET = 'question-images'
const MAX_IMAGE_MB = 2
const newQuestionImage = ref(null)
const imagePreview = ref('')

const resetImage = () => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  newQuestionImage.value = null
  imagePreview.value = ''
}

const handleImageSelect = (e) => {
  const file = e.target.files && e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    e.target.value = ''
    return toast.error('File harus berupa gambar (JPG/PNG).')
  }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    e.target.value = ''
    return toast.error(`Ukuran gambar maksimal ${MAX_IMAGE_MB}MB.`)
  }
  newQuestionImage.value = file
  imagePreview.value = URL.createObjectURL(file)
}

// Perkecil & kompres gambar.
const compressImage = (file) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.onload = () => {
    URL.revokeObjectURL(url)
    const MAX_DIM = 1280
    let w = img.width
    let h = img.height
    if (w > MAX_DIM || h > MAX_DIM) {
      const scale = Math.min(MAX_DIM / w, MAX_DIM / h)
      w = Math.round(w * scale)
      h = Math.round(h * scale)
    }
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Gagal memproses gambar.')), 'image/jpeg', 0.8)
  }
  img.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('Gambar tidak bisa dibaca.'))
  }
  img.src = url
})

// Ambil path storage dari public URL untuk hapus gambar.
const storagePathFromUrl = (url) => {
  const marker = '/question-images/'
  const i = (url || '').indexOf(marker)
  return i >= 0 ? decodeURIComponent(url.slice(i + marker.length)) : null
}

const filledOptions = computed(() => newOptions.value.map((o) => o.trim()).filter(Boolean))

// Langkah 1 - simpan sesi kuis baru ke tabel `quizzes`.
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

    // Pindihin data kuis ke state terpisah biar nggak ikut ke-reset pas form Step 1 dibersihin.
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

// Reset total form langkah 2 terus balik ke langkah 1.
const quitAddingQuestions = () => {
  teacherStep.value = 'create-quiz'
  createdQuizId.value = null
  createdQuizTitle.value = ''
  addedQuestionsCount.value = 0
  newQuestionText.value = ''
  newOptions.value = ['', '', '', '']
  newCorrectOption.value = ''
  resetImage()
}

// Langkah 2 - validasi terus simpan satu soal ke tabel `questions`.
const handleAddQuestionToQuiz = async () => {
  const questionText = newQuestionText.value.trim()
  const options = newOptions.value.map((o) => o.trim())

  if (!questionText) return toast.error('Tuliskan pertanyaan dulu!')
  if (options.some((o) => !o)) return toast.error('Keempat pilihan jawaban (A-D) harus diisi!')
  if (new Set(options).size !== options.length) return toast.error('Pilihan jawaban tidak boleh ada yang sama.')
  if (!newCorrectOption.value) return toast.error('Pilih jawaban benar dari dropdown!')

  submitting.value = true
  try {
    // Upload gambar sebelum insert soal. Kalau gagal, soal nggak jadi disimpan.
    let imageUrl = null
    if (newQuestionImage.value) {
      const blob = await compressImage(newQuestionImage.value)
      const path = `${createdQuizId.value}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
      const { error: uploadError } = await supabase.storage
        .from(IMAGE_BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      imageUrl = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl
    }

    const { error } = await supabase.from('questions').insert([{
      quiz_id: createdQuizId.value,
      category_id: newQuizCategory.value,
      question_text: questionText,
      options, // Disimpan sebagai array JSONB sesuai skema tabel.
      correct_option: newCorrectOption.value,
      image_url: imageUrl
    }])

    if (error) throw error

    addedQuestionsCount.value++

    // Reset form soal.
    newQuestionText.value = ''
    newOptions.value = ['', '', '', '']
    newCorrectOption.value = ''
    resetImage()

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
const panelMode = ref('create')
const quizRows = ref([])
const loadingManage = ref(false)
const expandedQuizId = ref(null)
const quizQuestions = ref([])
const loadingQuestions = ref(false)
const deleting = ref(false) 
const pendingDeleteQuiz = ref(null)
const pendingDeleteQuestion = ref(null)

// Nama mapel buat label, dicocokin dari id kategori.
const categoryName = (id) => props.categories.find((c) => c.id === id)?.name ?? id

// Pindah ke mode kelola + langsung ambil daftar semua kuis.
const switchToManage = () => {
  panelMode.value = 'manage'
  loadQuizList()
}

// Ambil semua sesi kuis.
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

const confirmDeleteQuiz = async (quiz) => {
  if (deleting.value) return
  deleting.value = true
  try {
    // Catat gambar soal DULU; cascade DB hapus barisnya tapi file storage tidak ikut kehapus.
    const { data: imgRows } = await supabase
      .from('questions')
      .select('image_url')
      .eq('quiz_id', quiz.id)
      .not('image_url', 'is', null)

    const { error } = await supabase.from('quizzes').delete().eq('id', quiz.id)
    if (error) throw error

    const paths = (imgRows || []).map((r) => storagePathFromUrl(r.image_url)).filter(Boolean)
    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove(paths)
      if (storageError) toast.error('Kuis terhapus, tapi gagal menghapus file gambarnya.')
    }

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

const confirmDeleteQuestion = async (q) => {
  if (deleting.value) return
  deleting.value = true
  try {
    const { error } = await supabase.from('questions').delete().eq('id', q.id)
    if (error) throw error

    if (q.image_url) {
      const path = storagePathFromUrl(q.image_url)
      if (path) {
        const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove([path])
        if (storageError) toast.error('Soal terhapus, tapi file gambarnya gagal dihapus.')
      }
    }

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

    <!-- Switch mode: bikin baru vs kelola/hapus. Dua-duanya cuma buat staff. -->
    <div class="panel-mode-switch">
      <button :class="['mode-btn', { active: panelMode === 'create' }]" @click="panelMode = 'create'">Buat Kuis Baru</button>
      <button :class="['mode-btn', { active: panelMode === 'manage' }]" @click="switchToManage">Kelola & Hapus Kuis</button>
    </div>

    <!-- MODE CREATE: wizard 2 langkah. -->
    <div v-if="panelMode === 'create'">
    <!-- Step A: Informasi Kuis -->
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

    <!-- Step B: Input Soal -->
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
          <label>Gambar Soal (opsional)</label>
          <div v-if="!imagePreview" class="image-picker">
            <input id="question-image-input" type="file" accept="image/*" @change="handleImageSelect" />
            <label for="question-image-input" class="btn-nav">Pilih Gambar</label>
            <span class="image-hint">Maksimal 2MB, otomatis diperkecil sebelum di-upload</span>
          </div>
          <div v-else class="image-preview-box">
            <img :src="imagePreview" alt="Preview gambar soal" class="image-preview" />
            <button type="button" class="btn-nav" @click="resetImage">Ganti / Hapus Gambar</button>
          </div>
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

        <!-- Dropdown jawaban benar. -->
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

    <!-- MODE MANAGE: daftar kuis -> hapus kuis utuh / buka buat hapus soal satuan. -->
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
              <!-- Konfirmasi 2 langkah: klik 'Hapus Kuis' -->
              <template v-if="pendingDeleteQuiz === quiz.id">
                <button class="btn-danger" @click="confirmDeleteQuiz(quiz)" :disabled="deleting">Yakin, Hapus Kuis</button>
                <button class="btn-nav" @click="pendingDeleteQuiz = null">Batal</button>
              </template>
              <button v-else class="btn-danger-outline" @click="pendingDeleteQuiz = quiz.id">Hapus Kuis</button>
            </div>
          </div>

          <!-- Tiap baris soal punya hapus sendiri. -->
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
/* Baris tombol aksi di langkah 2 biar sejajar. */
.teacher-step-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}

/* Picker gambar soal. */
.image-picker {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
.image-picker input[type="file"] {
  display: none;
}
.image-hint {
  font-size: 0.8rem;
  color: #6b7280;
}
.image-preview-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}
.image-preview {
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
}

/* Switch mode Buat/Kelola di panel guru. */
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

/* Section kelola & hapus kuis. */
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

/* Tombol bahaya buat aksi hapus. */
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
