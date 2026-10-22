<script setup>
import { toast } from '../composables/useToast.js'
</script>

<template>
  <Transition name="toast-slide">
    <div v-if="toast.state.visible" :class="['toast', toast.state.type]" role="status">
      <span class="toast-icon" aria-hidden="true">
        <svg v-if="toast.state.type === 'success'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        <svg v-else-if="toast.state.type === 'error'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
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

.toast-icon {
  display: inline-flex;
  align-items: center;
}

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
