import { reactive } from 'vue'

// [TIM] useToast - alat notifikasi global kita, PENGGANTI alert()/confirm().
// Kenapa kita bikin ini? alert() itu blokir UI & jelek buat UX aplikasi anak SD.
// Cara pakai dari komponen mana pun:
//   toast.success('...')  toast.error('...')  toast.info('...')
// Efeknya: muncul kartu kecil di pojok kanan bawah, auto-hilang beberapa detik.
// Render-nya cuma satu tempat, yaitu komponen ToastHub.vue yang dipasang di App.vue.

// [TIM] State toast global - satu instance dipakai bareng-bareng se-apply.
const state = reactive({
  visible: false,
  message: '',
  type: 'info' // 'success' | 'error' | 'info'
})

let hideTimer = null

const show = (message, type = 'info', duration = 3500) => {
  state.message = message
  state.type = type
  state.visible = true

  // [TIM] Reset timer dulu, biar toast baru nggak kepotong hilang karena timer lama masih jalan.
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    state.visible = false
  }, duration)
}

export const toast = {
  state,
  success: (message, duration) => show(message, 'success', duration),
  error: (message, duration) => show(message, 'error', duration ?? 5000),
  info: (message, duration) => show(message, 'info', duration),
  hide: () => {
    clearTimeout(hideTimer)
    state.visible = false
  }
}
