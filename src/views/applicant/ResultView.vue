<script setup lang="ts">
import { useApplicationStore } from '../../stores/applications'
import { finalLabel, manualLabel } from '../../utils/labels'

const applicationStore = useApplicationStore()
const result = applicationStore.latestResult
</script>

<template>
  <section class="panel">
    <h2>初审结果</h2>
    <div v-if="!result" class="empty">还没有提交过申请。</div>
    <div v-else class="result-board">
      <div class="review-flow">
        <span :class="['tag', result.status === 'PASS' ? 'pass' : 'fail']">AI 初审：{{ result.status }}</span>
        <span class="tag pending">人工审核：{{ manualLabel(result.manualStatus) }}</span>
        <span :class="['tag', result.finalStatus === 'APPROVED' ? 'pass' : result.finalStatus === 'REJECTED' ? 'fail' : 'pending']">
          最终：{{ finalLabel(result.finalStatus) }}
        </span>
      </div>
      <p class="suggestion">{{ result.suggestion }}</p>
      <ul v-if="result.issues.length" class="issues">
        <li v-for="issue in result.issues" :key="issue">{{ issue }}</li>
      </ul>
      <div v-if="result.ragReferences.length" class="rag-box">
        <h3>RAG 检索依据</h3>
        <p v-for="ref in result.ragReferences" :key="ref">{{ ref }}</p>
      </div>
    </div>
  </section>
</template>
