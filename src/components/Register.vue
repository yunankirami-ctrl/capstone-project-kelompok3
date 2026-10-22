<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'

const username = ref('')
const fullName = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')
const showPassword = ref(false)

const emit = defineEmits(['switch-to-login'])

const handleRegister = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  // Validasi sederhana.
  if (!username.value.trim()) {
    errorMessage.value = 'Username tidak boleh kosong.'
    return
  }
  if (!email.value.includes('@')) {
    errorMessage.value = 'Format email tidak valid (harus mengandung @).'
    return
  }
  if (password.value.length < 6) {
    // Password minimal 6 karakter.
    errorMessage.value = 'Password minimal 6 karakter.'
    return
  }

  loading.value = true

  try {
    // Password dikirim ke Supabase Auth.
    const { error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      options: {
        data: {
          username: username.value.trim(),
          full_name: fullName.value.trim() || username.value.trim()
        }
      }
    })

    if (error) throw error

    successMessage.value = 'Pendaftaran berhasil! Kamu bisa langsung Masuk (login) sekarang.'
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Desain form daftar akun  -->
  <div class="auth-card">
    <h2>Daftar Akun Siswa Baru</h2>
    <p class="subtitle">Isi data di bawah untuk membuat akun</p>

    <form @submit.prevent="handleRegister" class="auth-form">
      <div class="form-group">
        <label>Username</label>
        <input
          type="text"
          v-model="username"
          placeholder="Nama pengguna"
          maxlength="30"
          required
        />
      </div>

      <div class="form-group">
        <label>Nama Lengkap</label>
        <input
          type="text"
          v-model="fullName"
          placeholder="Nama lengkap (opsional)"
          maxlength="60"
        />
      </div>

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
        <label>Password (minimal 6 karakter)</label>
        <div class="input-wrap">
          <input
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="••••••••"
            minlength="6"
            required
          />
          <button
            type="button"
            class="toggle-pass"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
            :title="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
          >
            <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <p v-if="successMessage" class="success-text">{{ successMessage }}</p>

      <button type="submit" class="btn-primary" :disabled="loading">
        <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>{{ loading ? 'Mendaftarkan...' : 'Daftar' }}
      </button>
    </form>

    <!-- Tautan balik ke halaman Login. -->
    <p class="switch-text">
      Sudah punya akun?
      <button type="button" @click="emit('switch-to-login')" class="text-link">Masuk di sini</button>
    </p>
  </div>
</template>
