<script setup>
// [TIM] ToastHub = wadah tampil notifikasi global (kartu kecil pojok kanan bawah).
// Ini pasangan dari composables/useToast.js (pengganti alert/confirm). Pemasangannya
// CUKUP SEKALI di App.vue; komponen lain tinggal manggil toast.success()/error()/info().
import { toast } from '../composables/useToast.js'
</script>

<template>
  <Transition name="toast-slide">
    <div v-if="toast.state.visible" :class="['toast', toast.state.type]" role="status">
      <span class="toast-icon">
        {{ toast.state.type === 'success' ? '✅' : toast.state.type === 'error' ? '⛔' : 'ℹ️' }}
      </span>
      <p class="toast-message">{{ toast.state.message }}</p>
      <button class="toast-close" @click="toast.hide()" aria-label="Tutup notifikasi">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 999;
  display: flex;
  align-items: center;
  gap: 10px;
  max-width: 380px;
  padding: 14px 16px;
  border-radius: 12px;
  color: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  text-align: left;
}

.toast.success { background: #10b981; }
.toast.error { background: #ef4444; }
.toast.info { background: #3b82f6; }

.toast-message {
  margin: 0;
  flex: 1;
  font-size: 0.92rem;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  font-size: 0.9rem;
  padding: 2px 4px;
}

/* Animasi masuk/keluar toast */
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  transform: translateY(16px);
  opacity: 0;
}
</style>
