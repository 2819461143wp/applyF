<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useApplicationStore } from '../../stores/applications'
import { useSessionStore } from '../../stores/session'
import { finalLabel, manualLabel, workflowLabel } from '../../utils/labels'

const session = useSessionStore()
const applicationStore = useApplicationStore()
const applications = applicationStore.applications
const loading = applicationStore.loading
const loadApplications = applicationStore.loadApplications
const reviewingId = ref<number | null>(null)
const isAdmin = session.isAdmin
const title = computed(() => (isAdmin.value ? '人工审核工作台' : '我的申请'))

async function submitManualReview(id: number, decision: 'APPROVE' | 'REJECT') {
  reviewingId.value = id
  try {
    await applicationStore.submitManualReview(id, decision, session.currentUser.value?.role ?? 'user')
  } finally {
    reviewingId.value = null
  }
}

onMounted(() => {
  void loadApplications()
})
</script>

<template>
  <section class="panel">
    <div class="panel-head">
      <h2>{{ title }}</h2>
      <button class="minor" @click="loadApplications">刷新</button>
    </div>
    <p v-if="loading">加载中...</p>
    <table v-else>
      <thead>
        <tr>
          <th>ID</th>
          <th>申请人</th>
          <th>用途</th>
          <th>AI 初审</th>
          <th>流程</th>
          <th>人工审核</th>
          <th>问题</th>
          <th v-if="isAdmin">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in applications" :key="item.id">
          <td>{{ item.id }}</td>
          <td>{{ item.applicantName || '-' }}</td>
          <td>{{ item.waterPurpose || '-' }}</td>
          <td><span :class="['tag', item.status === 'PASS' ? 'pass' : 'fail']">{{ item.status }}</span></td>
          <td>{{ workflowLabel(item.workflowStatus) }}</td>
          <td>{{ manualLabel(item.manualStatus) }}</td>
          <td>{{ item.issues || '无' }}</td>
          <td v-if="isAdmin">
            <div v-if="item.workflowStatus === 'PENDING_MANUAL_REVIEW'" class="table-actions">
              <button @click="submitManualReview(item.id, 'APPROVE')" :disabled="reviewingId === item.id">通过</button>
              <button class="danger" @click="submitManualReview(item.id, 'REJECT')" :disabled="reviewingId === item.id">驳回</button>
            </div>
            <span v-else class="muted">{{ finalLabel(item.finalStatus) }}</span>
          </td>
        </tr>
        <tr v-if="applications.length === 0">
          <td :colspan="isAdmin ? 8 : 7" class="empty">暂无申请记录</td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
