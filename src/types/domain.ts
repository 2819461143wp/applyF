export type Role = 'user' | 'admin'
export type SlotKey = 'application_form' | 'id_card' | 'business_license' | 'report' | 'ownership_proof' | 'other'

export interface LoginUser {
  username: string
  role: Role
  displayName: string
  token: string
}

export interface ApplicationItem {
  id: number
  applicantName: string
  idNumber: string
  contactPhone: string
  waterPurpose: string
  status: 'PASS' | 'FAIL'
  workflowStatus: string
  manualStatus: string
  finalStatus: string
  issues: string
  suggestion: string
  ragReferences: string
  reviewerComment: string
  submittedAt: string
}

export interface PrecheckResult {
  applicationId: number | null
  status: 'PASS' | 'FAIL'
  issues: string[]
  suggestion: string
  workflowStatus: string
  manualStatus: string
  finalStatus: string
  ragReferences: string[]
}

export interface AttachmentPayload {
  docType: string
  filename: string
  mimeType: string
  size: number
  contentText: string
  base64Content: string
}

export interface AttachmentSummary {
  filename: string
  docType: string
  detectedKind: string
  extractedText: string
  extractedFields: Record<string, string>
  warnings: string[]
}

export interface ExtractionDraft {
  applicantName: string
  idNumber: string
  contactPhone: string
  projectName: string
  attachedProjectName: string
  formLegalRepresentative: string
  licenseLegalRepresentative: string
  waterPurpose: string
  waterLocation: string
  applicationPeriodYears: number | null
  requestedWaterAmount: number | null
  reportIssuedAt: string
  ownershipProofType: string
  materials: string[]
  warnings: string[]
  attachmentSummaries: AttachmentSummary[]
}

export interface MaterialSlot {
  key: SlotKey
  title: string
  hint: string
  docType: string
  materialName: string
  required: boolean
}

export interface KnowledgeUploadResult {
  filename: string
  docId?: string
  parser: string
  chunksAdded: number
  totalVectors: number
  preview: string
  contentText?: string
  contentLength?: number
  message: string
}

export interface KnowledgeDocument {
  docId: string
  filename: string
  source: string
  parser: string
  chunks: number
  preview: string
  deletable: boolean
}

export interface VectorPoint {
  id: string
  x: number
  y: number
  source: string
  parser: string
  docId: string
  chunk: number
  content: string
}

export interface VectorEdge {
  from: string
  to: string
  source: string
  similarity: number
}

export interface VectorResult {
  total: number
  points: VectorPoint[]
  edges: VectorEdge[]
  sources: string[]
  similarityThreshold: number
}
