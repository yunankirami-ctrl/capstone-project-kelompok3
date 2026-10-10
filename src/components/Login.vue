<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

// Emit atau fungsi penanda ketika login berhasil
const emit = defineEmits(['login-success'])

const handleLogin = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value,
    })

    if (error) throw error

    successMessage.value = 'Login berhasil! Selamat datang.'
    emit('login-success', data.user)
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-card">
    <h2>🔐 Masuk ke Portal Kuis</h2>
    <form @submit.prevent="handleLogin">
      <div class="form-group">
        <label>Email:</label>
        <input type="email" v-model="email" placeholder="nama@email.com" required />
      </div>

      <div class="form-group">
        <label>Password:</label>
        <input type="password" v-model="password" placeholder="••••••••" required />
      </div>

      <button type="submit" class="login-btn" :disabled="loading">
        {{ loading ? 'Memproses...' : 'Masuk' }}
      </button>
    </form>

    <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success-msg">{{ successMessage }}</p>
  </div>
</template>

<style scoped>
.login-card {
  background: white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  max-width: 400px;
  margin: 20px auto;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}
h2 {
  text-align: center;
  font-size: 1.2rem;
  margin-bottom: 20px;
  color: #1e293b;
}
.form-group {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #475569;
}
input {
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 1rem;
}
input:focus {
  outline: none;
  border-color: #4f46e5;
}
.login-btn {
  background: #4f46e5;
  color: white;
  border: none;
  padding: 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  width: 100%;
  font-weight: 600;
  margin-top: 10px;
}
.login-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}
.error-msg {
  color: #ef4444;
  font-size: 0.9rem;
  margin-top: 10px;
  text-align: center;
}
.success-msg {
  color: #22c55e;
  font-size: 0.9rem;
  margin-top: 10px;
  text-align: center;
}
</style>