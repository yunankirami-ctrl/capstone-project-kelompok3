// [TIM] Titik masuk (entry point) aplikasi. Di sini kita bikin instance Vue, muat
// style.css global, pasang App.vue ke #app (lihat index.html), dan aktifin PWA.
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import 'virtual:pwa-register' // [TIM] Daftarin Service Worker PWA (ikon & manifest diatur di vite.config.js)

createApp(App).mount('#app')
