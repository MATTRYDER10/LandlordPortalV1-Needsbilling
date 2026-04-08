import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Toast from 'vue-toastification'
import 'vue-toastification/dist/index.css'
import './style.css'
import App from './App.vue'
import router from './router'
// Initialize interceptors for admin company override
import './lib/axios'
import './lib/fetchInterceptor'
import { initErrorLogger } from './services/errorLogger'

const app = createApp(App)
const pinia = createPinia()

const toastOptions = {
  position: 'top-right',
  timeout: 3000,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.6,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
  toastClassName: 'custom-toast',
}

app.use(pinia)
app.use(router)
app.use(Toast, toastOptions)
initErrorLogger(app, router)

app.mount('#app')
