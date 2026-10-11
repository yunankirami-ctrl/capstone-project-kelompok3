<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'

const emit = defineEmits(['login-success'])

const username = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

const handleLogin = async () => {
  errorMessage.value = ''
  if (!username.value || !password.value) {
    errorMessage.value = 'Username dan password harus diisi!'
    return
  }

  loading.value = true

  try {
    // Cari data user berdasarkan username di tabel profiles
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('username', username.value)
      .single()

    if (error || !data) {
      throw new Error('Username tidak ditemukan!')
    }

    // Validasi password sederhana
    if (data.password !== password.value) {
      throw new Error('Password salah!')
    }

    // Jika valid, kirim data user yang berhasil login ke App.vue
    emit('login-success', data)
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-card">
    <h2>🔐 Masuk Portal Kuis</h2>
    <p class="subtitle">Silakan masuk menggunakan akun yang diberikan oleh Admin</p>

    <form @submit.prevent="handleLogin" class="auth-form">
      <div class="form-group">
        <label>Username</label>
        <input 
          type="text" 
          v-model="username" 
          placeholder="Masukkan username..." 
          required 
        />
      </div>

      <div class="form-group">
        <label>Password</label>
        <input 
          type="password" 
          v-model="password" 
          placeholder="Masukkan password..." 
          required 
        />
      </div>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <button type="submit" class="btn-primary" :disabled="loading">
        {{ loading ? 'Memproses...' : 'Masuk' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.auth-card {
  background: white;
  padding: 30px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  max-width: 400px;
  margin: 40px auto;
}
.subtitle {
  color: #6b7280;
  font-size: 0.9rem;
  margin-bottom: 20px;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
  text-align: left;
}
.form-group label {
  font-weight: 500;
  font-size: 0.9rem;
  color: #374151;
}
.form-group input {
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
}
.error-text {
  color: #ef4444;
  font-size: 0.85rem;
  margin: 0;
}
.btn-primary {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1rem;
  margin-top: 10px;
}
.btn-primary:hover {
  background: #4338ca;
}
</style>