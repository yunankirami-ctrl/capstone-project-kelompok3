<script setup>
import { ref, onMounted } from 'vue'
import { supabase } from '../supabase/supabase.js'

const leaderboardData = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    // Mengambil data profil/skor siswa diurutkan dari poin tertinggi
    const { data, error } = await supabase
      .from('profiles') // Sesuaikan dengan nama tabel profil/skor Anda
      .select('username, points')
      .order('points', { ascending: false })
      .limit(10) // Batasi 10 besar

    if (error) throw error
    leaderboardData.value = data || []
  } catch (err) {
    console.error('Gagal memuat leaderboard:', err.message)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="leaderboard-card">
    <h2>🏆 Papan Peringkat (Leaderboard)</h2>
    
    <div v-if="loading">Memuat peringkat...</div>
    
    <ul v-else-if="leaderboardData.length > 0" class="rank-list">
      <li v-for="(user, index) in leaderboardData" :key="index" class="rank-item">
        <span class="rank-number" :class="'top-' + (index + 1)">{{ index + 1 }}</span>
        <span class="username">{{ user.username || 'Siswa' }}</span>
        <span class="points">{{ user.points || 0 }} XP</span>
      </li>
    </ul>

    <p v-else>Belum ada data peringkat.</p>
  </div>
</template>

<style scoped>
.leaderboard-card {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  max-width: 400px;
  margin: 20px auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
</style>