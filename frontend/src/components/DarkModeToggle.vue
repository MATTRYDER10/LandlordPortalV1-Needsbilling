<template>
  <button
    @click="toggle"
    class="dark-mode-toggle relative w-14 h-7 rounded-full transition-all duration-500 ease-out focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
    :class="isDark ? 'bg-slate-800' : 'bg-gradient-to-r from-sky-400 to-blue-500'"
    :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
  >
    <!-- Stars (visible in dark mode) -->
    <div
      class="absolute inset-0 overflow-hidden rounded-full transition-opacity duration-500"
      :class="isDark ? 'opacity-100' : 'opacity-0'"
    >
      <div class="star star-1" />
      <div class="star star-2" />
      <div class="star star-3" />
    </div>

    <!-- Clouds (visible in light mode) -->
    <div
      class="absolute inset-0 overflow-hidden rounded-full transition-opacity duration-500"
      :class="isDark ? 'opacity-0' : 'opacity-100'"
    >
      <div class="cloud cloud-1" />
      <div class="cloud cloud-2" />
    </div>

    <!-- Moon (dark mode background) -->
    <div
      class="absolute top-1 right-1.5 w-4 h-4 rounded-full bg-slate-300 transition-opacity duration-300"
      :class="isDark ? 'opacity-40' : 'opacity-0'"
    >
      <div class="absolute w-1 h-1 rounded-full bg-slate-400 top-0.5 left-0.5" />
      <div class="absolute w-0.5 h-0.5 rounded-full bg-slate-400 top-2 left-2" />
    </div>

    <!-- Sun (light mode background) -->
    <div
      class="absolute top-1.5 left-1.5 w-4 h-4 rounded-full bg-yellow-300 transition-opacity duration-300"
      :class="isDark ? 'opacity-0' : 'opacity-60'"
    >
      <div class="sun-glow" />
    </div>

    <!-- Goose slider -->
    <div
      class="goose-slider absolute top-0.5 w-6 h-6 rounded-full bg-white transition-all duration-500 ease-out transform flex items-center justify-center overflow-hidden"
      :class="[
        isDark
          ? 'translate-x-7 shadow-[0_0_8px_2px_rgba(255,255,255,0.2)]'
          : 'translate-x-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.15)]'
      ]"
    >
      <!-- Awake Goose (light mode) -->
      <svg
        class="absolute w-5 h-5 transition-all duration-500"
        :class="isDark ? 'opacity-0 scale-75' : 'opacity-100 scale-100'"
        viewBox="0 0 24 24"
        fill="none"
      >
        <!-- Body -->
        <ellipse cx="12" cy="14" rx="6" ry="5" fill="#f97316" />
        <!-- Wing -->
        <ellipse cx="10" cy="14" rx="3" ry="3" fill="#ea580c" />
        <!-- Neck -->
        <path d="M15 12 Q18 8 17 4" stroke="#f8fafc" stroke-width="3" stroke-linecap="round" fill="none" />
        <!-- Head -->
        <circle cx="17" cy="4" r="2.5" fill="#f8fafc" />
        <!-- Beak -->
        <path d="M19 4 L22 3.5 L19 5" fill="#f97316" />
        <!-- Eye -->
        <circle cx="17.5" cy="3.5" r="0.7" fill="#1e293b" />
        <!-- Feet -->
        <path d="M10 18 L9 21 M14 18 L15 21" stroke="#f97316" stroke-width="1.5" stroke-linecap="round" />
      </svg>

      <!-- Sleeping Goose (dark mode) -->
      <svg
        class="absolute w-5 h-5 transition-all duration-500"
        :class="isDark ? 'opacity-100 scale-100' : 'opacity-0 scale-75'"
        viewBox="0 0 24 24"
        fill="none"
      >
        <!-- Body -->
        <ellipse cx="12" cy="14" rx="6" ry="5" fill="#64748b" />
        <!-- Wing -->
        <ellipse cx="10" cy="14" rx="3" ry="3" fill="#475569" />
        <!-- Neck tucked -->
        <path d="M15 11 Q16 9 15 7" stroke="#e2e8f0" stroke-width="3" stroke-linecap="round" fill="none" />
        <!-- Head tucked down -->
        <circle cx="15" cy="7" r="2.5" fill="#e2e8f0" />
        <!-- Beak tucked -->
        <path d="M16 8 L17.5 9 L15.5 9" fill="#64748b" />
        <!-- Closed eye (zzz) -->
        <path d="M14 6.5 Q15 6 16 6.5" stroke="#1e293b" stroke-width="0.8" stroke-linecap="round" fill="none" />
        <!-- Zzz -->
        <text x="18" y="5" font-size="4" fill="#94a3b8" font-weight="bold">z</text>
        <text x="20" y="3" font-size="3" fill="#94a3b8" font-weight="bold">z</text>
        <!-- Feet tucked -->
        <path d="M10 18 L10 19.5 M14 18 L14 19.5" stroke="#64748b" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </div>
  </button>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDarkMode } from '@/composables/useDarkMode'

const { isDark, toggleDarkMode } = useDarkMode()
const isAnimating = ref(false)

const toggle = () => {
  isAnimating.value = true
  toggleDarkMode()

  setTimeout(() => {
    isAnimating.value = false
  }, 500)
}

watch(isDark, () => {
  isAnimating.value = true
  setTimeout(() => {
    isAnimating.value = false
  }, 500)
})
</script>

<style scoped>
.star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: white;
  border-radius: 50%;
  animation: twinkle 2s ease-in-out infinite;
}

.star-1 { top: 5px; left: 6px; animation-delay: 0s; }
.star-2 { top: 15px; left: 10px; animation-delay: 0.7s; }
.star-3 { top: 10px; left: 3px; animation-delay: 1.4s; }

@keyframes twinkle {
  0%, 100% { opacity: 0.3; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.3); }
}

.cloud {
  position: absolute;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
}

.cloud-1 {
  width: 10px;
  height: 4px;
  top: 5px;
  right: 4px;
  animation: drift 3s ease-in-out infinite;
}

.cloud-2 {
  width: 6px;
  height: 3px;
  top: 16px;
  right: 8px;
  animation: drift 4s ease-in-out infinite reverse;
}

@keyframes drift {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-3px); }
}

.sun-glow {
  position: absolute;
  inset: -2px;
  background: radial-gradient(circle, rgba(250, 204, 21, 0.6) 0%, transparent 70%);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

.goose-slider {
  transition: transform 0.5s cubic-bezier(0.68, -0.2, 0.32, 1.2);
}

.dark-mode-toggle:active .goose-slider {
  transform: translateX(3.5px) scale(0.95);
}

.dark-mode-toggle:active.dark .goose-slider {
  transform: translateX(calc(1.75rem - 2px)) scale(0.95);
}
</style>
