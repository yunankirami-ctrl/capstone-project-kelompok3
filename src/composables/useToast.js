import { reactive } from 'vue'
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
