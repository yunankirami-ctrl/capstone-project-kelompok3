<script setup>
import { ref, watch, onMounted } from 'vue'
import { supabase } from '../supabase/supabase.js'

const props = defineProps({
  refreshKey: { type: Number, default: 0 },
  // Username user yang login, buat highlight barisnya di peringkat.
  highlightUsername: { type: String, default: '' }
})

const leaderboardData = ref([])
const loading = ref(true)
const errorMessage = ref('')

// Ambil data lewat RPC. Jalan pas komponen pertama muncul & tiap refreshKey berubah.
const fetchLeaderboard = async () => {
  loading.value = true
  errorMessage.value = ''

  try {
    const { data, error } = await supabase.rpc('get_leaderboard')

    if (error) throw error
    leaderboardData.value = data || []
  } catch (err) {
    errorMessage.value = 'Gagal memuat leaderboard: ' + err.message
    leaderboardData.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchLeaderboard)

// leaderboard auto-refresh.
watch(() => props.refreshKey, fetchLeaderboard)
</script>

<template>
  <div class="leaderboard-card">
    <h2>Papan Peringkat</h2>

    <div v-if="loading" class="state-text">Memuat peringkat...</div>

    <div v-else-if="errorMessage" class="state-text error">
      <p>{{ errorMessage }}</p>
      <button class="retry-btn" @click="fetchLeaderboard">Coba Lagi</button>
    </div>

    <ul v-else-if="leaderboardData.length > 0" class="rank-list">
      <li
        v-for="(user, index) in leaderboardData"
        :key="index"
        :class="['rank-item', { me: highlightUsername && user.username === highlightUsername }]"
      >
        <span class="rank-number" :class="'top-' + (index + 1)">{{ index + 1 }}</span>
        <span class="username">{{ user.username || 'Siswa' }}<span v-if="highlightUsername && user.username === highlightUsername" class="you-tag">Kamu</span></span>
        <span class="points">{{ user.points || 0 }} XP</span>
      </li>
    </ul>

    <p v-else class="state-text">Belum ada data peringkat. Jadilah murid pertama yang mengerjakan kuis!</p>
  </div>
</template>

<style scoped>
.leaderboard-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  max-width: 560px;
  margin: 20px auto;
}
h2 {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 16px;
  color: #1e293b;
}
.rank-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.rank-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  gap: 12px;
}
.rank-number {
  font-weight: bold;
  width: 24px;
  text-align: center;
  color: #64748b;
}
.top-1 { color: #f59e0b; } /* Emas */
.top-2 { color: #94a3b8; } /* Perak */
.top-3 { color: #b45309; } /* Perunggu */
.username {
  flex: 1;
  font-weight: 500;
  color: #334155;
}
.points {
  font-weight: 600;
  color: #4f46e5;
}
.rank-item.me {
  background: #eef2ff;
  border-radius: 8px;
}
.you-tag {
  margin-left: 8px;
  background: #4f46e5;
  color: white;
  font-size: 0.68rem;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  vertical-align: middle;
}
.state-text {
  text-align: center;
  color: #64748b;
  font-size: 0.9rem;
  padding: 8px 0;
}
.state-text.error {
  color: #ef4444;
}
.retry-btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}
</style>
