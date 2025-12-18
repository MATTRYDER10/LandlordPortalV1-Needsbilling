<template>
  <div class="text-center py-8">
    <!-- Welcome Message -->
    <div class="mb-6">
      <h2 class="text-3xl font-bold text-gray-900 mb-4">Welcome to</h2>
      <img src="/PropertyGooseLogo.png" alt="PropertyGoose" class="h-14 mx-auto" />
    </div>
    <p class="text-lg text-gray-600 mb-6 max-w-2xl mx-auto">
      Let's get your account set up so you can start managing tenant references and agreements. This will only take a few minutes.
    </p>

    <!-- Free Credits Banner -->
    <div class="max-w-md mx-auto mb-8">
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <p class="text-green-800 font-medium">You have <span class="font-bold">2 free credits</span> to get started!</p>
      </div>
    </div>

    <!-- What We'll Collect -->
    <div class="max-w-2xl mx-auto mb-10">
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">What we'll set up:</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div class="flex items-start">
            <CheckCircle class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p class="font-medium text-gray-900">Your Profile</p>
              <p class="text-sm text-gray-600">Name and contact details</p>
            </div>
          </div>

          <div class="flex items-start">
            <CheckCircle class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p class="font-medium text-gray-900">Company Information</p>
              <p class="text-sm text-gray-600">Business address and contact</p>
            </div>
          </div>

          <div class="flex items-start">
            <CheckCircle class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p class="font-medium text-gray-900">Bank Details</p>
              <p class="text-sm text-gray-600">For generating agreements</p>
            </div>
          </div>

          <div class="flex items-start">
            <CheckCircle class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p class="font-medium text-gray-900">Branding</p>
              <p class="text-sm text-gray-600">Logo and colors (optional)</p>
            </div>
          </div>

          <div class="flex items-start">
            <CheckCircle class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <p class="font-medium text-gray-900">Payment Method</p>
              <p class="text-sm text-gray-600">For billing and credits</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Call to Action -->
    <button
      @click="$emit('next')"
      class="px-8 py-3 bg-primary text-white text-lg font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
    >
      Get Started
    </button>

    <p class="mt-4 text-sm text-gray-500">
      Takes about 5 minutes • You can save and continue later
    </p>
  </div>
</template>

<script setup lang="ts">
import { CheckCircle } from 'lucide-vue-next'

// No props or state needed for welcome screen
defineEmits<{
  next: []
}>()
</script>
