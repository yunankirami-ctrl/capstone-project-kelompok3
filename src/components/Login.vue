<script setup>
import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'

const emit = defineEmits(['login-success', 'switch-to-register'])

const email = ref('')
const password = ref('')
const errorMessage = ref('')
const loading = ref(false)
// Kontrol lihat/sembunyi password.
const showPassword = ref(false)

const handleLogin = async () => {
  errorMessage.value = ''
  if (!email.value || !password.value) {
    errorMessage.value = 'Email dan password harus diisi!'
    return
  }

  loading.value = true

  try {
    // Step verifikasi login.
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (error || !authData.user) throw new Error(error?.message || 'Login gagal!')

    // Ambil data user dari tabel `profiles`.
    // jadi tinggal ambil berdasarkan id user Auth yang barusan login.
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    // Jika auth sukses tapi profile kosong = trigger `handle_new_user`
    if (profileError || !profile) {
      await supabase.auth.signOut()
      throw new Error('Akun berhasil masuk, tapi profile belum terdaftar. Hubungi admin (trigger profiles belum terbentuk di Supabase).')
    }

    emit('login-success', profile)
  } catch (err) {
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- Class auth-card/auth-form/dsb di style.css  -->
  <div class="auth-card">
    <h2>Masuk Portal Kuis</h2>
    <p class="subtitle">Silakan masuk menggunakan email dan password</p>

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
        <div class="input-wrap">
          <input
            :type="showPassword ? 'text' : 'password'"
            v-model="password"
            placeholder="Masukkan password..."
            required
          />
          <button
            type="button"
            class="toggle-pass"
            @click="showPassword = !showPassword"
            :aria-label="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
            :title="showPassword ? 'Sembunyikan password' : 'Tampilkan password'"
          >
            <!-- Ikon mata -->
            <svg v-if="!showPassword" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          </button>
        </div>
      </div>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

      <button type="submit" class="btn-primary" :disabled="loading">
        <span v-if="loading" class="btn-spinner" aria-hidden="true"></span>{{ loading ? 'Memproses...' : 'Masuk' }}
      </button>
    </form>

    <!-- Tautan pindah ke halaman Register. -->
    <p class="switch-text">
      Belum punya akun?
      <button type="button" @click="emit('switch-to-register')" class="text-link">Daftar di sini</button>
    </p>
  </div>
</template>
