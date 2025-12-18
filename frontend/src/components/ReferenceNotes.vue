<template>
  <div class="reference-notes">
    <div class="header">
      <h3>Notes</h3>
    </div>

    <!-- Add Note Form -->
    <div class="add-note-form">
      <textarea
        v-model="newNoteText"
        placeholder="Add a note..."
        rows="3"
        class="note-input"
      ></textarea>
      <div class="form-actions">
        <button
          @click="addNote"
          :disabled="!newNoteText.trim() || isSubmitting"
          class="btn-primary"
        >
          {{ isSubmitting ? 'Adding...' : 'Add Note' }}
        </button>
      </div>
    </div>

    <!-- Notes List -->
    <div class="notes-list">
      <div v-if="loading" class="loading">Loading notes...</div>
      <div v-else-if="notes.length === 0" class="empty">
        No notes yet. Add one above to get started.
      </div>
      <div v-else class="notes">
        <div
          v-for="note in notes"
          :key="note.id"
          class="note-item"
        >
          <div class="note-header">
            <span class="note-author">{{ note.created_by_user?.email || 'Unknown' }}</span>
            <span class="note-time">{{ formatDate(note.created_at) }}</span>
          </div>
          <div v-if="editingNoteId === note.id" class="note-edit">
            <textarea
              v-model="editNoteText"
              rows="3"
              class="note-input"
            ></textarea>
            <div class="form-actions">
              <button @click="saveEdit" class="btn-primary">Save</button>
              <button @click="cancelEdit" class="btn-secondary">Cancel</button>
            </div>
          </div>
          <div v-else class="note-content">
            <p>{{ note.note }}</p>
            <div v-if="canEdit(note)" class="note-actions">
              <button @click="startEdit(note)" class="btn-link">Edit</button>
              <button @click="deleteNote(note.id)" class="btn-link text-red">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'
import { formatDate as formatUkDate } from '../utils/date'

const props = defineProps<{
  referenceId: string
}>()

const toast = useToast()
const authStore = useAuthStore()
const notes = ref<any[]>([])
const loading = ref(false)
const isSubmitting = ref(false)
const newNoteText = ref('')
const editingNoteId = ref<string | null>(null)
const editNoteText = ref('')

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const loadNotes = async () => {
  loading.value = true
  try {
    const token = authStore.session?.access_token
    const response = await fetch(
      `${API_URL}/api/reference-notes/${props.referenceId}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    if (!response.ok) throw new Error('Failed to load notes')
    notes.value = await response.json()
  } catch (error: any) {
    console.error('Failed to load notes:', error)
    toast.error('Failed to load notes')
  } finally {
    loading.value = false
  }
}

const addNote = async () => {
  if (!newNoteText.value.trim()) return

  isSubmitting.value = true
  try {
    const token = authStore.session?.access_token
    const response = await fetch(
      `${API_URL}/api/reference-notes/${props.referenceId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: newNoteText.value })
      }
    )
    if (!response.ok) throw new Error('Failed to add note')
    const newNote = await response.json()
    notes.value.unshift(newNote)
    newNoteText.value = ''
    toast.success('Note added successfully')
  } catch (error: any) {
    console.error('Failed to add note:', error)
    toast.error('Failed to add note')
  } finally {
    isSubmitting.value = false
  }
}

const startEdit = (note: any) => {
  editingNoteId.value = note.id
  editNoteText.value = note.note
}

const cancelEdit = () => {
  editingNoteId.value = null
  editNoteText.value = ''
}

const saveEdit = async () => {
  if (!editNoteText.value.trim() || !editingNoteId.value) return

  try {
    const token = authStore.session?.access_token
    const response = await fetch(
      `${API_URL}/api/reference-notes/${props.referenceId}/${editingNoteId.value}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ note: editNoteText.value })
      }
    )
    if (!response.ok) throw new Error('Failed to update note')
    const updatedNote = await response.json()
    const index = notes.value.findIndex(n => n.id === editingNoteId.value)
    if (index !== -1) {
      notes.value[index] = updatedNote
    }
    cancelEdit()
    toast.success('Note updated successfully')
  } catch (error: any) {
    console.error('Failed to update note:', error)
    toast.error('Failed to update note')
  }
}

const deleteNote = async (noteId: string) => {
  if (!confirm('Are you sure you want to delete this note?')) return

  try {
    const token = authStore.session?.access_token
    const response = await fetch(
      `${API_URL}/api/reference-notes/${props.referenceId}/${noteId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }
    )
    if (!response.ok) throw new Error('Failed to delete note')
    notes.value = notes.value.filter(n => n.id !== noteId)
    toast.success('Note deleted successfully')
  } catch (error: any) {
    console.error('Failed to delete note:', error)
    toast.error('Failed to delete note')
  }
}

const canEdit = (note: any) => {
  const userId = localStorage.getItem('userId')
  return note.created_by === userId
}

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`

  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return formatUkDate(
    date,
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  )
}

onMounted(() => {
  loadNotes()
})
</script>

<style scoped>
.reference-notes {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
}

.header {
  margin-bottom: 16px;
}

.header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.add-note-form {
  margin-bottom: 24px;
}

.note-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
  resize: vertical;
  margin-bottom: 8px;
}

.note-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.form-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  background-color: var(--color-primary);
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background-color: #ea580c;
}

.btn-primary:disabled {
  background-color: #fed7aa;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #f3f4f6;
  color: #374151;
  padding: 8px 16px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-secondary:hover {
  background-color: #e5e7eb;
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
}

.btn-link:hover {
  text-decoration: underline;
}

.btn-link.text-red {
  color: #dc2626;
}

.loading,
.empty {
  text-align: center;
  padding: 32px;
  color: #6b7280;
  font-size: 14px;
}

.notes {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.note-item {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 16px;
  background: #fafafa;
}

.note-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.note-author {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.note-time {
  font-size: 12px;
  color: #6b7280;
}

.note-content p {
  margin: 0;
  font-size: 14px;
  color: #111827;
  line-height: 1.5;
  white-space: pre-wrap;
}

.note-actions {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}

.note-edit {
  margin-top: 8px;
}
</style>
