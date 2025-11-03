<template>
  <div class="text-center py-8">
    <!-- Welcome Icon -->
    <div class="mb-6 flex justify-center">
      <div class="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
        <svg class="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
        </svg>
      </div>
    </div>

    <!-- Welcome Message -->
    <h2 class="text-3xl font-bold text-gray-900 mb-4">
      Welcome to PropertyGoose!
    </h2>
    <p class="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
      Let's get your account set up so you can start managing tenant references and agreements. This will only take a few minutes.
    </p>

    <!-- What We'll Collect -->
    <div class="max-w-2xl mx-auto mb-10">
      <div class="bg-orange-50 border border-orange-200 rounded-lg p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">What we'll set up:</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
          <div class="flex items-start">
            <svg class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="font-medium text-gray-900">Your Profile</p>
              <p class="text-sm text-gray-600">Name and contact details</p>
            </div>
          </div>

          <div class="flex items-start">
            <svg class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="font-medium text-gray-900">Company Information</p>
              <p class="text-sm text-gray-600">Business address and contact</p>
            </div>
          </div>

          <div class="flex items-start">
            <svg class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="font-medium text-gray-900">Bank Details</p>
              <p class="text-sm text-gray-600">For generating agreements</p>
            </div>
          </div>

          <div class="flex items-start">
            <svg class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            <div>
              <p class="font-medium text-gray-900">Branding</p>
              <p class="text-sm text-gray-600">Logo and colors (optional)</p>
            </div>
          </div>

          <div class="flex items-start">
            <svg class="w-5 h-5 text-primary mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
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
// No props or state needed for welcome screen
defineEmits<{
  next: []
}>()
</script>
