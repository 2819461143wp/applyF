<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import VectorGraph from '../../components/knowledge/VectorGraph.vue'
import {
  deleteKnowledgeDocumentRequest,
  listKnowledgeDocuments,
  loadKnowledgeVectors,
  uploadKnowledgeFile,
} from '../../services/api'
import { useSessionStore } from '../../stores/session'
import type { KnowledgeDocument, KnowledgeUploadResult, VectorResult } from '../../types/domain'
import { displaySourceName } from '../../utils/labels'

const session = useSessionStore()
const role = computed(() => session.currentUser.value?.role ?? 'user')
const knowledgeFile = ref<File | null>(null)
const knowledgeResult = ref<KnowledgeUploadResult | null>(null)
const knowledgeStatusMessage = ref('')
const knowledgeDocuments = ref<KnowledgeDocument[]>([])
const vectors = ref<VectorResult>({ total: 0, points: [], edges: [], sources: [], similarityThreshold: 0.65 })
const knowledgeUploading = ref(false)
const knowledgeDeletingId = ref<string | null>(null)
const vectorLoading = ref(false)
const selectedDocId = ref('')

function onKnowledgeFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  knowledgeFile.value = input.files?.[0] ?? null
}

function syncSelectedDocument(preferredDocId = '') {
  const docIds = new Set(knowledgeDocuments.value.map((document) => document.docId))
  if (preferredDocId && docIds.has(preferredDocId)) {
    selectedDocId.value = preferredDocId
    return
  }
  if (selectedDocId.value && docIds.has(selectedDocId.value)) {
    return
  }
  const firstUploaded = knowledgeDocuments.value.find((document) => document.deletable)
  selectedDocId.value = firstUploaded?.docId ?? knowledgeDocuments.value[0]?.docId ?? ''
}

async function loadKnowledgeWorkspace(preferredDocId = '') {
  vectorLoading.value = true
  try {
    const [nextVectors, nextDocuments] = await Promise.all([loadKnowledgeVectors(role.value), listKnowledgeDocuments(role.value)])
    vectors.value = nextVectors
    knowledgeDocuments.value = nextDocuments
    syncSelectedDocument(preferredDocId)
  } finally {
    vectorLoading.value = false
  }
}

async function loadDocumentList() {
  knowledgeDocuments.value = await listKnowledgeDocuments(role.value)
  syncSelectedDocument()
}

async function uploadKnowledge() {
  if (!knowledgeFile.value) return
  knowledgeUploading.value = true
  knowledgeStatusMessage.value = ''
  try {
    knowledgeResult.value = await uploadKnowledgeFile(knowledgeFile.value, role.value)
    knowledgeStatusMessage.value = knowledgeResult.value.message
    await loadKnowledgeWorkspace(knowledgeResult.value.docId)
  } finally {
    knowledgeUploading.value = false
  }
}

async function deleteKnowledgeDocument(document: KnowledgeDocument) {
  if (!document.deletable || knowledgeDeletingId.value) return
  const confirmed = window.confirm(`确定删除“${document.filename}”及其 ${document.chunks} 个向量切片吗？`)
  if (!confirmed) return
  knowledgeDeletingId.value = document.docId
  knowledgeStatusMessage.value = ''
  try {
    const data = await deleteKnowledgeDocumentRequest(document.docId, role.value)
    knowledgeStatusMessage.value = data.message ?? `已删除 ${document.filename}`
    if (selectedDocId.value === document.docId) {
      selectedDocId.value = ''
    }
    await loadKnowledgeWorkspace()
  } finally {
    knowledgeDeletingId.value = null
  }
}

onMounted(() => {
  void loadKnowledgeWorkspace()
})
</script>

<template>
  <section class="panel knowledge-grid">
    <div class="knowledge-card">
      <p class="section-kicker">MinerU + ChromaDB</p>
      <h2>RAG 知识库管理</h2>
      <p class="hero-copy">上传法规、填报说明、流程文档。PDF 优先调用 MinerU 解析，DOCX 使用 Word XML 解析，随后切块写入 Chroma 向量库。</p>
      <label class="upload-box knowledge-upload">
        <input type="file" accept=".pdf,.docx,.pptx,.xlsx,.txt,.md" @change="onKnowledgeFileChange" />
        <span>{{ knowledgeFile?.name || '选择知识库文档' }}</span>
      </label>
      <div class="actions">
        <button :disabled="!knowledgeFile || knowledgeUploading" @click="uploadKnowledge">{{ knowledgeUploading ? '入库中...' : '解析并入库' }}</button>
        <button class="minor" :disabled="vectorLoading" @click="loadKnowledgeWorkspace()">{{ vectorLoading ? '刷新中...' : '刷新知识库' }}</button>
      </div>
      <p v-if="knowledgeStatusMessage" class="ok-line">{{ knowledgeStatusMessage }}</p>
      <div v-if="knowledgeResult" class="result-card">
        <strong>{{ knowledgeResult.message }}</strong>
        <p>
          文件：{{ knowledgeResult.filename }} / 解析器：{{ knowledgeResult.parser }} / 新增切片：{{ knowledgeResult.chunksAdded }}
          / 解析字数：{{ knowledgeResult.contentLength ?? knowledgeResult.preview.length }}
        </p>
        <span class="preview-label">完整解析内容（可滚动查看）</span>
        <pre>{{ knowledgeResult.contentText || knowledgeResult.preview }}</pre>
      </div>
      <div class="document-list">
        <div class="document-list-head">
          <div>
            <h3>已入库文档</h3>
            <p>删除文档会同步删除该文档写入 Chroma 的全部向量切片。点击文档可切换右侧 chunk 展示。</p>
          </div>
          <button class="minor tiny" type="button" @click="loadDocumentList">刷新列表</button>
        </div>
        <p v-if="knowledgeDocuments.length === 0" class="empty">暂无已入库文档。</p>
        <article
          v-for="document in knowledgeDocuments"
          :key="document.docId"
          :class="['document-item', { selected: selectedDocId === document.docId }]"
          @click="selectedDocId = document.docId"
        >
          <div>
            <strong>{{ displaySourceName(document.filename) }}</strong>
            <span>{{ document.parser }} / {{ document.chunks }} 个切片</span>
          </div>
          <button
            class="danger tiny"
            type="button"
            :disabled="!document.deletable || knowledgeDeletingId === document.docId"
            @click.stop="deleteKnowledgeDocument(document)"
          >
            {{ document.deletable ? (knowledgeDeletingId === document.docId ? '删除中...' : '删除') : '内置' }}
          </button>
          <p>{{ document.preview || '无预览文本' }}</p>
        </article>
      </div>
    </div>

    <VectorGraph :vectors="vectors" :selected-doc-id="selectedDocId" />
  </section>
</template>
