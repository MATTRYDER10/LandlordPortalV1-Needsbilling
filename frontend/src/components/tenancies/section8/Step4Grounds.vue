<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">Grounds for Possession</h3>
      <p class="text-sm text-gray-500 dark:text-slate-400">Select all grounds that apply. You can select multiple grounds.</p>
    </div>

    <!-- Mandatory Grounds -->
    <div>
      <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-red-500"></span>
        Mandatory Grounds
        <span class="text-xs font-normal text-gray-500 dark:text-slate-400">(Court must grant possession if proved)</span>
      </h4>
      <div class="space-y-2">
        <GroundCard
          v-for="ground in mandatoryGrounds"
          :key="ground.id"
          :ground="ground"
          :selected="formState.selectedGroundIds.includes(ground.id)"
          @toggle="toggleGround(ground.id)"
        />
      </div>
    </div>

    <!-- Discretionary Grounds -->
    <div>
      <h4 class="text-sm font-semibold text-gray-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        Discretionary Grounds
        <span class="text-xs font-normal text-gray-500 dark:text-slate-400">(Court decides if reasonable)</span>
      </h4>
      <div class="space-y-2">
        <GroundCard
          v-for="ground in discretionaryGrounds"
          :key="ground.id"
          :ground="ground"
          :selected="formState.selectedGroundIds.includes(ground.id)"
          @toggle="toggleGround(ground.id)"
        />
      </div>
    </div>

    <!-- Notice Date Panel (pinned at bottom) -->
    <div
      v-if="formState.selectedGroundIds.length > 0"
      class="sticky bottom-0 bg-gradient-to-t from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent pt-4"
    >
      <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div class="flex items-start gap-3">
          <Calendar class="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div class="flex-1">
            <div class="flex flex-wrap items-center gap-2 mb-2">
              <span class="text-sm font-medium text-blue-900 dark:text-blue-200">Selected grounds:</span>
              <span
                v-for="groundId in formState.selectedGroundIds"
                :key="groundId"
                class="px-2 py-0.5 text-xs font-medium rounded-full"
                :class="getGroundById(groundId)?.type === 'mandatory'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-amber-100 text-amber-700'"
              >
                {{ getGroundById(groundId)?.number }}
              </span>
            </div>

            <div class="grid sm:grid-cols-2 gap-3 text-sm">
              <div>
                <label class="block text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Service Date</label>
                <input
                  :value="formState.serviceDate"
                  @input="updateServiceDate(($event.target as HTMLInputElement).value)"
                  type="date"
                  class="w-full px-3 py-1.5 border border-blue-300 dark:border-blue-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm bg-white dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-blue-700 dark:text-blue-400 mb-1">Earliest Court Date</label>
                <div class="px-3 py-1.5 bg-blue-100 dark:bg-blue-800/30 rounded-lg font-semibold text-blue-900 dark:text-blue-200">
                  {{ calculatedCourtDate }}
                </div>
              </div>
            </div>

            <div class="mt-3 text-xs text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-800/30 rounded-lg p-2">
              <strong>{{ longestPeriodGround?.noticePeriodLabel }}</strong> notice period
              ({{ longestPeriodGround?.number }}) — the longest of your selected grounds.
              This ensures all grounds remain valid at the hearing date.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar } from 'lucide-vue-next'
import GroundCard from './GroundCard.vue'
import type { S8FormState, S8Ground } from '@/types/section8'

interface Props {
  formState: S8FormState
  grounds: S8Ground[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  update: [updates: Partial<S8FormState>]
}>()

const mandatoryGrounds = computed(() =>
  props.grounds.filter(g => g.type === 'mandatory')
)

const discretionaryGrounds = computed(() =>
  props.grounds.filter(g => g.type === 'discretionary')
)

const selectedGrounds = computed(() =>
  props.grounds.filter(g => props.formState.selectedGroundIds.includes(g.id))
)

const longestPeriodGround = computed(() => {
  if (selectedGrounds.value.length === 0) return null
  return selectedGrounds.value.reduce((prev, curr) =>
    curr.noticePeriodDays > prev.noticePeriodDays ? curr : prev
  )
})

const calculatedCourtDate = computed(() => {
  if (!longestPeriodGround.value || !props.formState.serviceDate) return '—'

  const serviceDate = new Date(props.formState.serviceDate)
  const courtDate = new Date(serviceDate)
  courtDate.setDate(courtDate.getDate() + longestPeriodGround.value.noticePeriodDays)

  return courtDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
})

function getGroundById(id: string): S8Ground | undefined {
  return props.grounds.find(g => g.id === id)
}

function toggleGround(groundId: string) {
  const current = props.formState.selectedGroundIds
  const updated = current.includes(groundId)
    ? current.filter(id => id !== groundId)
    : [...current, groundId]

  emit('update', { selectedGroundIds: updated })
}

function updateServiceDate(value: string) {
  emit('update', { serviceDate: value })
}
</script>
