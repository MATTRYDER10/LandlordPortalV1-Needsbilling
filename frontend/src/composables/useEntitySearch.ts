import { ref } from 'vue'
import { useApi } from './useApi'

export interface EntityResult {
  type: 'reference' | 'property' | 'landlord' | 'tenancy'
  id: string
  label: string
}

export function useEntitySearch() {
  const { apiFetch } = useApi()
  const results = ref<EntityResult[]>([])
  const loading = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  async function search(query: string) {
    if (debounceTimer) clearTimeout(debounceTimer)

    if (!query || query.length < 2) {
      results.value = []
      return
    }

    debounceTimer = setTimeout(async () => {
      loading.value = true
      results.value = []

      try {
        const allResults: EntityResult[] = []

        // Search properties
        const propsRes = await apiFetch(`/api/properties/search?q=${encodeURIComponent(query)}&limit=5`)
        if (propsRes.ok) {
          const data = await propsRes.json()
          const properties = data.properties || []
          for (const p of properties) {
            allResults.push({
              type: 'property',
              id: p.id,
              label: p.address || p.name || p.id
            })
          }
        }

        // Search landlords
        const landlordsRes = await apiFetch(`/api/landlords?search=${encodeURIComponent(query)}&limit=5`)
        if (landlordsRes.ok) {
          const data = await landlordsRes.json()
          const landlords = data.landlords || []
          for (const l of landlords) {
            allResults.push({
              type: 'landlord',
              id: l.id,
              label: l.name || l.email || l.id
            })
          }
        }

        // Search tenancies
        const tenanciesRes = await apiFetch(`/api/tenancies?search=${encodeURIComponent(query)}&limit=5`)
        if (tenanciesRes.ok) {
          const data = await tenanciesRes.json()
          const tenancies = data.tenancies || []
          for (const t of tenancies) {
            allResults.push({
              type: 'tenancy',
              id: t.id,
              label: t.property_address || t.tenant_name || t.id
            })
          }
        }

        // Search references
        const refsRes = await apiFetch(`/api/references?search=${encodeURIComponent(query)}&limit=5`)
        if (refsRes.ok) {
          const data = await refsRes.json()
          const references = data.references || []
          for (const r of references) {
            allResults.push({
              type: 'reference',
              id: r.id,
              label: r.tenant_name || r.property_address || r.id
            })
          }
        }

        results.value = allResults
      } catch (err) {
        console.error('Entity search error:', err)
        results.value = []
      } finally {
        loading.value = false
      }
    }, 300)
  }

  function clear() {
    results.value = []
    if (debounceTimer) clearTimeout(debounceTimer)
  }

  return {
    results,
    loading,
    search,
    clear
  }
}
