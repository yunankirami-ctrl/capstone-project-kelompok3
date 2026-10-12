<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'

//note: Form register
const username = ref('')
const fullName = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const emit = defineEmits(['switch-to-login'])

const handleRegister = async () => {
  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    if (password.value.length < 6) {
      throw new Error('Password minimal 6 karakter.')
    }

    //note: Password dikirim ke Supabase Auth
    const { error } = await supabase.auth.signUp({
      email: email.value,
      password: password.value,
      //note: row profiles otomatis.
      options: {
        data: {
          username: username.value,
          full_name: fullName.value || username.value
        }
      }
    })

    if (error) throw error

    successMessage.value = 'Pendaftaran berhasil! Silakan periksa email Anda, lalu masuk.'
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-card">
    <h2>📝 Daftar Akun Siswa Baru</h2>
    <form @submit.prevent="handleRegister">
      <div class="form-group">
        <label>Username:</label>
        <input type="text" v-model="username" placeholder="Nama pengguna" required />
      </div>
      <div class="form-group">
        <label>Nama lengkap:</label>
        <input type="text" v-model="fullName" placeholder="Nama lengkap" />
      </div>
      <div class="form-group">
        <label>Email:</label>
        <input type="email" v-model="email" placeholder="nama@email.com" required />
      </div>

      <div class="form-group">
        <label>Password:</label>
        <input type="password" v-model="password" placeholder="••••••••" required />
      </div>

      <button type="submit" class="register-btn" :disabled="loading">
        {{ loading ? 'Mendaftarkan...' : 'Daftar' }}
      </button>
    </form>

    <p v-if="errorMessage" class="error-msg">{{ errorMessage }}</p>
    <p v-if="successMessage" class="success-msg">{{ successMessage }}</p>

    <p class="switch-text">
      Sudah punya akun? 
      <button type="button" @click="emit('switch-to-login')" class="text-link">Masuk di sini</button>
    </p>
  </div>
</template>

<style scoped>
.register-card {
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
.register-btn {
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
.register-btn:disabled {
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
</style>
