<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'

//note: Login sekarang menggunakan Supabase Auth, bukan membandingkan password dari tabel profiles.
const emit = defineEmits(['login-success', 'switch-to-register'])

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)

const handleLogin = async () => {
  errorMessage.value = ''
  if (!email.value || !password.value) {
    errorMessage.value = 'Email dan password harus diisi!'
    return
  }

  loading.value = true

  try {
    //note: Supabase Auth menangani verifikasi email dan password.
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (error || !authData.user) throw new Error(error?.message || 'Login gagal!')

    //note: Data role dan username diambil dari profiles berdasarkan id Auth user.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) throw new Error('Profil pengguna belum tersedia.')
    emit('login-success', profile)
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
        <label>Email</label>
        <input 
          type="email" 
          v-model="email" 
          placeholder="nama@email.com" 
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

    <!-- //note: Tombol ini membuka form register. -->
    <p class="switch-text">
      Belum punya akun?
      <button type="button" @click="emit('switch-to-register')" class="text-link">Daftar di sini</button>
    </p>
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
.switch-text {
  text-align: center;
  margin-top: 15px;
  font-size: 0.9rem;
  color: #64748b;
}
.text-link {
  background: none;
  border: none;
  color: #4f46e5;
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  padding: 0;
}
.text-link:hover {
  text-decoration: underline;
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
