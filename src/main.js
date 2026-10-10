import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import 'virtual:pwa-register' // Pendaftaran Service Worker PWA

createApp(App).mount('#app')