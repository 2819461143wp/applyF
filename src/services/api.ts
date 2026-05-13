import type {
  ApplicationItem,
  ExtractionDraft,
  KnowledgeDocument,
  KnowledgeUploadResult,
  LoginUser,
  PrecheckResult,
  VectorResult,
} from '../types/domain'

const apiBase = 'http://localhost:8080/api/applications'

async function readJson<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${fallbackMessage}: ${response.status}`)
  }
  return (await response.json()) as T
}

export async function loginRequest(username: string, password: string) {
  const response = await fetch(`${apiBase}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return readJson<LoginUser>(response, '登录失败')
}

export async function listApplications() {
  const response = await fetch(apiBase)
  return readJson<ApplicationItem[]>(response, '申请列表加载失败')
}

export async function extractDraft(payload: unknown) {
  const response = await fetch(`${apiBase}/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson<ExtractionDraft>(response, '识别失败')
}

export async function submitPrecheckRequest(payload: unknown) {
  const response = await fetch(`${apiBase}/precheck`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return readJson<PrecheckResult>(response, '提交失败')
}

export async function submitManualReviewRequest(id: number, decision: 'APPROVE' | 'REJECT', role: string) {
  const response = await fetch(`${apiBase}/${id}/manual-review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Role': role },
    body: JSON.stringify({
      decision,
      comment: decision === 'APPROVE' ? '人工复核通过' : '人工复核驳回',
    }),
  })
  return readJson<ApplicationItem[]>(response, '人工审核失败')
}

export async function uploadKnowledgeFile(file: File, role: string) {
  const body = new FormData()
  body.append('file', file)
  body.append('filename', file.name)
  const response = await fetch(`${apiBase}/knowledge/upload`, {
    method: 'POST',
    headers: { 'X-Role': role },
    body,
  })
  return readJson<KnowledgeUploadResult>(response, '知识库上传失败')
}

export async function listKnowledgeDocuments(role: string) {
  const response = await fetch(`${apiBase}/knowledge/documents`, {
    headers: { 'X-Role': role },
  })
  const data = await readJson<{ documents: KnowledgeDocument[] }>(response, '知识库文档加载失败')
  return data.documents ?? []
}

export async function deleteKnowledgeDocumentRequest(docId: string, role: string) {
  const response = await fetch(`${apiBase}/knowledge/documents/${encodeURIComponent(docId)}`, {
    method: 'DELETE',
    headers: { 'X-Role': role },
  })
  return readJson<{ message?: string }>(response, '知识库文档删除失败')
}

export async function loadKnowledgeVectors(role: string) {
  const response = await fetch(`${apiBase}/knowledge/vectors`, {
    headers: { 'X-Role': role },
  })
  return readJson<VectorResult>(response, '向量加载失败')
}
