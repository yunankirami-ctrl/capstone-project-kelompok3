<script setup>
// [TIM] HALAMAN REGISTER (khusus murid baru).
// Rekan-rekan, daftar di sini pakai Supabase Auth signUp(). Alurnya:
//   signUp(email, password, metadata{username, full_name}) -> Supabase bikin user di auth.users
//   -> trigger database `handle_new_user` OTOMATIS bikin baris `profiles` (role 'murid', points 0).
// Jadi KITA NGGAK perlu insert manual ke profiles dari sini, cukup kirim metadata lewat options.
// CATATAN KEAMANAN: role guru/admin SENGAJA tidak bisa didaftarkan dari halaman ini.
// Akun guru/admin dibuat manual oleh admin lewat Supabase Dashboard (lihat SUPABASE_SETUP.md).

import { ref } from 'vue'
import { supabase } from '../supabase/supabase.js'

const username = ref('')
const fullName = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const emit = defineEmits(['switch-to-login'])

const handleRegister = async () => {
  errorMessage.value = ''
  successMessage.value = ''

  // [TIM] Validasi kita lakukan DULUAN sebelum nelepon Supabase, biar error langsung
  // muncul cepat & jelas tanpa harus nunggu response server.
  if (!username.value.trim()) {
    errorMessage.value = 'Username tidak boleh kosong.'
    return
  }
  if (!email.value.includes('@')) {
    errorMessage.value = 'Format email tidak valid (harus mengandung @).'
    return
  }
  if (password.value.length < 6) {
    // [TIM] Inget: 6 karakter itu minimum bawaan Supabase Auth. Kurang dari ini pasti ditolak.
    errorMessage.value = 'Password minimal 6 karakter.'
    return
  }

  loading.value = true

  try {
    // [TIM] Password dikirim ke Supabase Auth (di-hash di server), BUKAN kita simpan
    // plaintext di tabel. Aman ya.
    const { error } = await supabase.auth.signUp({
      email: email.value.trim(),
      password: password.value,
      // [TIM] Metadata di bawah ini dibaca trigger `handle_new_user` di database buat
      // ngisi kolom username & full_name pada tabel profiles. Kalau full_name dikosongkan,
      // kita fallback ke username biar tetap ada namanya.
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
    // [TIM] Pesan dari Supabase sudah deskriptif (email udah terdaftar, password lemah, dsb),
    // jadi tinggal kita tampilkan apa adanya.
    errorMessage.value = err.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <!-- [TIM] Desain SENGAJA disamakan dengan Login: pakai class auth-card/auth-form/
       form-group/btn-primary yang style-nya sudah global di style.css.
       Tambahannya cuma field username + nama lengkap dan pesan sukses. -->
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
        <input
          type="password"
          v-model="password"
          placeholder="••••••••"
          minlength="6"
          required
        />
      </div>

      <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
      <p v-if="successMessage" class="success-text">{{ successMessage }}</p>

      <button type="submit" class="btn-primary" :disabled="loading">
        {{ loading ? 'Mendaftarkan...' : 'Daftar' }}
      </button>
    </form>

    <!-- [TIM] Tautan balik ke halaman Login. -->
    <p class="switch-text">
      Sudah punya akun?
      <button type="button" @click="emit('switch-to-login')" class="text-link">Masuk di sini</button>
    </p>
  </div>
</template>
