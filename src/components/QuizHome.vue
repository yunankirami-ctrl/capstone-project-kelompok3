<script setup>
// [TIM] BERANDA MURID - tempat milih kuis (Step 1 & 2 alur murid).
//   Step 1: tampilin grid mata pelajaran (kategori).
//   Step 2: abis kategori dipilih, tampilin daftar sesi kuis dari tabel `quizzes`.
// Ujung-ujungnya emit 'select-quiz' (objek quiz) ke App.vue buat mulai dikerjakan.
// CATATAN: leaderboard SENGAJA nggak di sini, tapi di App.vue. Alasannya biar leaderboard
// nggak reload/kereset tiap murid pindah-pindah kategori.

import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'
import { toast } from '../composables/useToast.js'

const props = defineProps({
  // [TIM] Daftar kategori mapel, dikirim dari App.vue (aslinya dari data/categories.js).
  categories: { type: Array, required: true }
})

const emit = defineEmits(['select-quiz'])

const selectedCategory = ref(null)
const quizList = ref([])
const loading = ref(false)

// [TIM] Abis mapel dipilih -> ambil daftar sesi kuis yang ada di mapel itu.
const selectCategory = async (category) => {
  selectedCategory.value = category
  loading.value = true
  quizList.value = []

  try {
    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('category_id', category.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    quizList.value = data || []
  } catch (err) {
    toast.error('Gagal memuat daftar kuis: ' + err.message)
  } finally {
    loading.value = false
  }
}

// [TIM] Balik ke halaman pilihan mapel.
const backToCategories = () => {
  selectedCategory.value = null
  quizList.value = []
}

// [TIM] Operkan quiz yang dipilih ke App.vue (App yang nanti tampilin QuizPlayer).
const chooseQuiz = (quiz) => emit('select-quiz', quiz)

// [TIM] reopen: dipanggil App.vue via ref pas murid keluar dari kuis, biar langsung balik
// ke daftar kuis kategori tadi (bukan mulai dari pilih mapel lagi). Kita cari objek kategorinya via id.
const reopen = (categoryId) => {
  const category = props.categories.find((c) => c.id === categoryId)
  if (category) selectCategory(category)
}

defineExpose({ reopen })
</script>

<template>
  <!-- [TIM] Step 1: pilih mata pelajaran -->
  <section v-if="!selectedCategory" class="category-selection">
    <h2>Pilih Mata Pelajaran</h2>
    <p></p>
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
        <button class="btn-start" :style="{ backgroundColor: cat.color }">Lihat Daftar Kuis</button>
      </div>
    </div>
  </section>

  <!-- [TIM] Step 2: daftar sesi kuis (misal: Quiz Week 1) -->
  <section v-else class="quiz-list-section">
    <button @click="backToCategories" class="btn-back">⬅ Kembali ke Pilihan Mapel</button>
    <h2>📋 Daftar Kuis: {{ selectedCategory.name }}</h2>
    <p>Pilih sesi kuis yang tersedia:</p>

    <div v-if="loading" class="loading-state"><p>⏳ Memuat daftar kuis...</p></div>

    <div v-else-if="quizList.length === 0" class="empty-state">
      <p>Belum ada sesi kuis yang dibuat untuk mata pelajaran ini.</p>
    </div>

    <div v-else class="quiz-session-grid">
      <div v-for="quiz in quizList" :key="quiz.id" class="session-card" @click="chooseQuiz(quiz)">
        <h3>🎯 {{ quiz.title }}</h3>
        <p>⏱️ Durasi: {{ quiz.duration_minutes }} Menit</p>
        <p>📝 Jumlah Soal: {{ quiz.total_questions }} Soal</p>
        <button class="btn-start-session">Mulai Ujian</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* [TIM] Style kartu 'kosong' & 'memuat' yang dipakai bareng di beberapa halaman murid. */
.loading-state,
.empty-state {
  background: white;
  border: 2px dashed #e5e7eb;
  border-radius: 12px;
  padding: 30px;
  text-align: center;
  color: #6b7280;
  margin-top: 20px;
}
</style>
