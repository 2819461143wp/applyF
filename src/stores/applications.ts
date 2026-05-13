import { ref } from 'vue'
import { listApplications, submitManualReviewRequest } from '../services/api'
import type { ApplicationItem, PrecheckResult } from '../types/domain'

const applications = ref<ApplicationItem[]>([])
const latestResult = ref<PrecheckResult | null>(null)
const loading = ref(false)

export function useApplicationStore() {
  async function loadApplications() {
    loading.value = true
    try {
      applications.value = await listApplications()
    } finally {
      loading.value = false
    }
  }

  async function submitManualReview(id: number, decision: 'APPROVE' | 'REJECT', role: string) {
    applications.value = await submitManualReviewRequest(id, decision, role)
  }

  return {
    applications,
    latestResult,
    loading,
    loadApplications,
    submitManualReview,
  }
}
