<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

type Page = 'list' | 'create' | 'result'
type SlotKey = 'application_form' | 'id_card' | 'business_license' | 'report' | 'ownership_proof' | 'other'
type Role = 'user' | 'admin'

interface ApplicationItem {
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

interface PrecheckResult {
  applicationId: number | null
  status: 'PASS' | 'FAIL'
  issues: string[]
  suggestion: string
  workflowStatus: string
  manualStatus: string
  finalStatus: string
  ragReferences: string[]
}

interface AttachmentPayload {
  docType: string
  filename: string
  mimeType: string
  size: number
  contentText: string
  base64Content: string
}

interface AttachmentSummary {
  filename: string
  docType: string
  detectedKind: string
  extractedText: string
  extractedFields: Record<string, string>
  warnings: string[]
}

interface ExtractionDraft {
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

interface MaterialSlot {
  key: SlotKey
  title: string
  hint: string
  docType: string
  materialName: string
  required: boolean
}

const apiBase = 'http://localhost:8080/api/applications'
const storedRole = localStorage.getItem('water-current-role')

const slots: MaterialSlot[] = [
  {
    key: 'application_form',
    title: '申请书',
    hint: '必交。建议上传填写后的申请书，用于回填项目名称、取水地点、取水量等字段。',
    docType: 'application_form',
    materialName: '申请书',
    required: true,
  },
  {
    key: 'id_card',
    title: '身份证',
    hint: '必交。用于识别申请人姓名、身份证号，并校验证件是否正确。',
    docType: 'id_card',
    materialName: '身份证',
    required: true,
  },
  {
    key: 'business_license',
    title: '营业执照',
    hint: '必交。用于识别企业名称、法定代表人和营业期限。',
    docType: 'business_license',
    materialName: '营业执照',
    required: true,
  },
  {
    key: 'report',
    title: '水资源论证报告',
    hint: '建议上传。系统会尝试提取报告中的项目名称和相关说明。',
    docType: 'report',
    materialName: '水资源论证报告',
    required: false,
  },
  {
    key: 'ownership_proof',
    title: '权属证明',
    hint: '建议上传。不动产权证、租赁合同等都可以放在这里。',
    docType: 'ownership_proof',
    materialName: '权属证明',
    required: false,
  },
  {
    key: 'other',
    title: '其他支撑材料',
    hint: '可选。放承诺书、补充说明等额外材料。',
    docType: 'unknown',
    materialName: '其他材料',
    required: false,
  },
]

const currentPage = ref<Page>('create')
const currentRole = ref<Role>(storedRole === 'admin' ? 'admin' : 'user')
const loading = ref(false)
const submitting = ref(false)
const extracting = ref(false)
const applications = ref<ApplicationItem[]>([])
const result = ref<PrecheckResult | null>(null)
const extractionDraft = ref<ExtractionDraft | null>(null)
const reviewingId = ref<number | null>(null)

const form = reactive({
  applicantName: '',
  idNumber: '',
  contactPhone: '',
  projectName: '',
  attachedProjectName: '',
  formLegalRepresentative: '',
  licenseLegalRepresentative: '',
  waterPurpose: '',
  customPurpose: '',
  waterLocation: '',
  applicationPeriodYears: '',
  projectApprovalPeriodYears: '',
  requestedWaterAmount: '',
  reportEstimatedWaterAmount: '',
  thirdPartyImpactDescription: '',
  mitigationMeasures: '',
  reportIssuedAt: '',
  legalBasisVersion: '水法2023版',
  ownershipProofType: '',
})

const slotFiles = ref<Record<SlotKey, File | null>>({
  application_form: null,
  id_card: null,
  business_license: null,
  report: null,
  ownership_proof: null,
  other: null,
})

const attachmentOcrTexts = ref<Record<SlotKey, string>>({
  application_form: '',
  id_card: '',
  business_license: '',
  report: '',
  ownership_proof: '',
  other: '',
})

const allSelectedSlots = computed(() =>
  slots.filter((slot) => slotFiles.value[slot.key]).map((slot) => ({ slot, file: slotFiles.value[slot.key] as File })),
)

const normalizedMaterials = computed(() => {
  const names = new Set<string>(extractionDraft.value?.materials ?? [])
  for (const { slot } of allSelectedSlots.value) {
    if (slot.key !== 'other') {
      names.add(slot.materialName)
    } else if (slotFiles.value.other) {
      names.add(slotFiles.value.other.name)
    }
  }
  return Array.from(names)
})

const extractionWarnings = computed(() => extractionDraft.value?.warnings ?? [])

const attachmentSummaries = computed(() => {
  const summaries = extractionDraft.value?.attachmentSummaries ?? []
  return allSelectedSlots.value.map(({ slot, file }) => {
    const matched =
      summaries.find((item) => item.filename === file.name && item.docType === slot.docType) ||
      summaries.find((item) => item.filename === file.name)
    return {
      slotKey: slot.key,
      slotTitle: slot.title,
      filename: file.name,
      docType: matched?.docType ?? slot.docType,
      detectedKind: matched?.detectedKind ?? slot.docType,
      extractedText: attachmentOcrTexts.value[slot.key] || matched?.extractedText || '',
      extractedFields: matched?.extractedFields ?? {},
      warnings: matched?.warnings ?? [],
    }
  })
})

const missingRequiredSlots = computed(() => slots.filter((slot) => slot.required && !slotFiles.value[slot.key]))

async function loadApplications() {
  loading.value = true
  try {
    const resp = await fetch(apiBase)
    applications.value = await resp.json()
  } finally {
    loading.value = false
  }
}

function switchRole(role: Role) {
  currentRole.value = role
  localStorage.setItem('water-current-role', role)
  if (role === 'admin') {
    currentPage.value = 'list'
  } else if (currentPage.value === 'list') {
    currentPage.value = 'create'
  }
}

function workflowLabel(value: string) {
  const labels: Record<string, string> = {
    AI_REJECTED: 'AI 初审未通过',
    PENDING_MANUAL_REVIEW: '待人工审核',
    MANUAL_APPROVED: '人工审核通过',
    MANUAL_REJECTED: '人工审核驳回',
  }
  return labels[value] ?? value
}

function manualLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: '待审核',
    APPROVED: '已通过',
    REJECTED: '已驳回',
    NOT_REQUIRED: '无需人工',
  }
  return labels[value] ?? value
}

function finalLabel(value: string) {
  const labels: Record<string, string> = {
    PENDING: '处理中',
    APPROVED: '通过',
    REJECTED: '不通过',
  }
  return labels[value] ?? value
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      resolve(result.includes(',') ? result.split(',')[1] : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error(`读取文件失败: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

async function buildAttachments(): Promise<AttachmentPayload[]> {
  return Promise.all(
    allSelectedSlots.value.map(async ({ slot, file }) => ({
      docType: slot.docType,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      contentText: attachmentOcrTexts.value[slot.key] ?? '',
      base64Content: await fileToBase64(file),
    })),
  )
}

function applyDraftToForm(draft: ExtractionDraft) {
  form.applicantName = draft.applicantName || form.applicantName
  form.idNumber = draft.idNumber || form.idNumber
  form.contactPhone = draft.contactPhone || form.contactPhone
  form.projectName = draft.projectName || form.projectName
  form.attachedProjectName = draft.attachedProjectName || form.attachedProjectName
  form.formLegalRepresentative = draft.formLegalRepresentative || form.formLegalRepresentative
  form.licenseLegalRepresentative = draft.licenseLegalRepresentative || form.licenseLegalRepresentative
  form.waterPurpose = draft.waterPurpose || form.waterPurpose
  form.waterLocation = draft.waterLocation || form.waterLocation
  form.applicationPeriodYears = draft.applicationPeriodYears != null ? String(draft.applicationPeriodYears) : form.applicationPeriodYears
  form.requestedWaterAmount = draft.requestedWaterAmount != null ? String(draft.requestedWaterAmount) : form.requestedWaterAmount
  form.reportIssuedAt = draft.reportIssuedAt || form.reportIssuedAt
  form.ownershipProofType = draft.ownershipProofType || form.ownershipProofType

  for (const summary of attachmentSummaries.value) {
    const matched =
      draft.attachmentSummaries.find((item) => item.filename === summary.filename && item.docType === summary.docType) ||
      draft.attachmentSummaries.find((item) => item.filename === summary.filename)
    if (matched?.extractedText) {
      attachmentOcrTexts.value[summary.slotKey] = matched.extractedText
    }
  }
}

function buildRequestBody(attachments: AttachmentPayload[]) {
  const waterPurpose =
    form.waterPurpose === '其他' && form.customPurpose.trim()
      ? `其他:${form.customPurpose.trim()}`
      : form.waterPurpose

  return {
    applicantName: form.applicantName,
    idNumber: form.idNumber,
    contactPhone: form.contactPhone,
    projectName: form.projectName,
    attachedProjectName: form.attachedProjectName,
    formLegalRepresentative: form.formLegalRepresentative,
    licenseLegalRepresentative: form.licenseLegalRepresentative,
    waterPurpose,
    waterLocation: form.waterLocation,
    applicationPeriodYears: form.applicationPeriodYears ? Number(form.applicationPeriodYears) : null,
    projectApprovalPeriodYears: form.projectApprovalPeriodYears ? Number(form.projectApprovalPeriodYears) : null,
    requestedWaterAmount: form.requestedWaterAmount ? Number(form.requestedWaterAmount) : null,
    reportEstimatedWaterAmount: form.reportEstimatedWaterAmount ? Number(form.reportEstimatedWaterAmount) : null,
    thirdPartyImpactDescription: form.thirdPartyImpactDescription,
    mitigationMeasures: form.mitigationMeasures,
    reportIssuedAt: form.reportIssuedAt,
    legalBasisVersion: form.legalBasisVersion,
    ownershipProofType: form.ownershipProofType,
    materials: normalizedMaterials.value,
    attachments,
  }
}

async function runExtraction() {
  if (allSelectedSlots.value.length === 0) {
    extractionDraft.value = null
    return
  }

  extracting.value = true
  try {
    const attachments = await buildAttachments()
    const resp = await fetch(`${apiBase}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequestBody(attachments)),
    })
    if (!resp.ok) {
      throw new Error(`识别失败：${resp.status}`)
    }
    const draft = (await resp.json()) as ExtractionDraft
    extractionDraft.value = draft
    applyDraftToForm(draft)
  } catch (error) {
    extractionDraft.value = {
      applicantName: '',
      idNumber: '',
      contactPhone: '',
      projectName: '',
      attachedProjectName: '',
      formLegalRepresentative: '',
      licenseLegalRepresentative: '',
      waterPurpose: '',
      waterLocation: '',
      applicationPeriodYears: null,
      requestedWaterAmount: null,
      reportIssuedAt: '',
      ownershipProofType: '',
      materials: normalizedMaterials.value,
      warnings: [error instanceof Error ? error.message : '智能识别失败'],
      attachmentSummaries: allSelectedSlots.value.map(({ slot, file }) => ({
        filename: file.name,
        docType: slot.docType,
        detectedKind: slot.docType,
        extractedText: attachmentOcrTexts.value[slot.key] ?? '',
        extractedFields: {},
        warnings: ['暂未拿到自动识别结果，可手动补充关键内容。'],
      })),
    }
  } finally {
    extracting.value = false
  }
}

async function onSlotFileChange(slotKey: SlotKey, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  slotFiles.value[slotKey] = file
  if (!file) {
    attachmentOcrTexts.value[slotKey] = ''
  }
  await runExtraction()
}

function clearSlot(slotKey: SlotKey) {
  slotFiles.value[slotKey] = null
  attachmentOcrTexts.value[slotKey] = ''
  void runExtraction()
}

function updateAttachmentText(slotKey: SlotKey, text: string) {
  attachmentOcrTexts.value[slotKey] = text
}

async function submitPrecheck() {
  if (currentRole.value !== 'user') {
    result.value = {
      applicationId: null,
      status: 'FAIL',
      issues: ['当前身份为管理员，不能提交申请。'],
      suggestion: '请切换到申请人身份后提交材料。',
      workflowStatus: 'AI_REJECTED',
      manualStatus: 'NOT_REQUIRED',
      finalStatus: 'REJECTED',
      ragReferences: [],
    }
    currentPage.value = 'result'
    return
  }

  if (missingRequiredSlots.value.length > 0) {
    result.value = {
      applicationId: null,
      status: 'FAIL',
      issues: missingRequiredSlots.value.map((slot) => `缺少必交材料：${slot.title}`),
      suggestion: '请先补齐申请书、身份证、营业执照后再提交初审。',
      workflowStatus: 'AI_REJECTED',
      manualStatus: 'NOT_REQUIRED',
      finalStatus: 'REJECTED',
      ragReferences: [],
    }
    currentPage.value = 'result'
    return
  }

  submitting.value = true
  try {
    const attachments = await buildAttachments()
    const resp = await fetch(`${apiBase}/precheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequestBody(attachments)),
    })
    if (!resp.ok) {
      throw new Error(`初审失败：${resp.status}`)
    }
    result.value = await resp.json()
    currentPage.value = 'result'
    await loadApplications()
  } catch (error) {
    result.value = {
      applicationId: null,
      status: 'FAIL',
      issues: [error instanceof Error ? error.message : '提交失败'],
      suggestion: '请确认前端、Spring Boot、FastAPI 服务均已启动后重试。',
      workflowStatus: 'AI_REJECTED',
      manualStatus: 'NOT_REQUIRED',
      finalStatus: 'REJECTED',
      ragReferences: [],
    }
    currentPage.value = 'result'
  } finally {
    submitting.value = false
  }
}

async function submitManualReview(id: number, decision: 'APPROVE' | 'REJECT') {
  if (currentRole.value !== 'admin') {
    return
  }
  reviewingId.value = id
  try {
    const resp = await fetch(`${apiBase}/${id}/manual-review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Role': currentRole.value },
      body: JSON.stringify({
        decision,
        comment: decision === 'APPROVE' ? '人工复核通过' : '人工复核驳回',
      }),
    })
    if (!resp.ok) {
      throw new Error(`人工审核提交失败：${resp.status}`)
    }
    applications.value = await resp.json()
  } finally {
    reviewingId.value = null
  }
}

function resetForm() {
  form.applicantName = ''
  form.idNumber = ''
  form.contactPhone = ''
  form.projectName = ''
  form.attachedProjectName = ''
  form.formLegalRepresentative = ''
  form.licenseLegalRepresentative = ''
  form.waterPurpose = ''
  form.customPurpose = ''
  form.waterLocation = ''
  form.applicationPeriodYears = ''
  form.projectApprovalPeriodYears = ''
  form.requestedWaterAmount = ''
  form.reportEstimatedWaterAmount = ''
  form.thirdPartyImpactDescription = ''
  form.mitigationMeasures = ''
  form.reportIssuedAt = ''
  form.legalBasisVersion = '水法2023版'
  form.ownershipProofType = ''
  slotFiles.value = {
    application_form: null,
    id_card: null,
    business_license: null,
    report: null,
    ownership_proof: null,
    other: null,
  }
  attachmentOcrTexts.value = {
    application_form: '',
    id_card: '',
    business_license: '',
    report: '',
    ownership_proof: '',
    other: '',
  }
  extractionDraft.value = null
}

onMounted(loadApplications)
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">Direction Module Practice</p>
        <h1>涉水审批智能初审系统</h1>
        <p class="hero-copy">上传流程调整为材料清单式提交。每种材料都有独立上传位，不会互相覆盖，最终会一起进入申请初审。</p>
      </div>
      <div class="top-actions">
        <div class="role-switch" aria-label="身份切换">
          <button :class="{ active: currentRole === 'user' }" type="button" @click="switchRole('user')">user 申请人</button>
          <button :class="{ active: currentRole === 'admin' }" type="button" @click="switchRole('admin')">admin 审核员</button>
        </div>
        <nav>
          <button v-if="currentRole === 'user'" :class="{ active: currentPage === 'create' }" @click="currentPage = 'create'">新建申请</button>
          <button :class="{ active: currentPage === 'result' }" @click="currentPage = 'result'">初审结果</button>
          <button :class="{ active: currentPage === 'list' }" @click="currentPage = 'list'">
            {{ currentRole === 'admin' ? '审核工作台' : '我的申请' }}
          </button>
        </nav>
      </div>
    </header>

    <section v-if="currentPage === 'create' && currentRole === 'user'" class="panel workflow">
      <div class="workflow-head">
        <div>
          <p class="section-kicker">按材料清单提交</p>
          <h2>逐项上传，统一识别，统一提交</h2>
        </div>
        <button class="minor" type="button" @click="resetForm">重新开始</button>
      </div>

      <div class="workflow-grid">
        <aside class="intake">
          <div class="step-card">
            <span class="step-index">1</span>
            <div>
              <h3>材料上传区</h3>
              <p>必交材料固定为申请书、身份证、营业执照。每种材料单独上传，互不覆盖。</p>
            </div>

            <div class="slot-stack">
              <article v-for="slot in slots" :key="slot.key" class="upload-slot">
                <div class="slot-head">
                  <div>
                    <strong>{{ slot.title }}</strong>
                    <span :class="['chip', slot.required ? 'solid' : '']">{{ slot.required ? '必交' : '选交' }}</span>
                  </div>
                  <button
                    v-if="slotFiles[slot.key]"
                    class="minor slot-clear"
                    type="button"
                    @click="clearSlot(slot.key)"
                  >
                    移除
                  </button>
                </div>
                <p class="slot-hint">{{ slot.hint }}</p>
                <label class="upload-box">
                  <input type="file" @change="onSlotFileChange(slot.key, $event)" />
                  <span>{{ slotFiles[slot.key] ? '重新选择该材料' : `上传${slot.title}` }}</span>
                </label>
                <div v-if="slotFiles[slot.key]" class="slot-file">
                  <strong>{{ slotFiles[slot.key]?.name }}</strong>
                  <span>{{ slotFiles[slot.key]?.type || 'application/octet-stream' }}</span>
                </div>
              </article>
            </div>
          </div>

          <div class="step-card">
            <span class="step-index">2</span>
            <div class="step-header">
              <div>
                <h3>自动识别与材料检查</h3>
                <p>每次新增或替换某一项材料后，系统都会重新识别，但不会清空其他已上传材料。</p>
              </div>
              <button class="minor" type="button" @click="runExtraction" :disabled="extracting || allSelectedSlots.length === 0">
                {{ extracting ? '识别中...' : '重新识别全部材料' }}
              </button>
            </div>
            <ul class="warning-list">
              <li v-for="slot in missingRequiredSlots" :key="slot.key">缺少必交材料：{{ slot.title }}</li>
              <li v-for="warning in extractionWarnings" :key="warning">{{ warning }}</li>
              <li v-if="missingRequiredSlots.length === 0 && extractionWarnings.length === 0 && allSelectedSlots.length > 0" class="ok-line">
                材料已上传，可继续核对识别结果并提交初审。
              </li>
              <li v-if="allSelectedSlots.length === 0" class="muted">还没有上传任何材料。</li>
            </ul>
          </div>

          <div class="step-card">
            <span class="step-index">3</span>
            <div>
              <h3>每份材料的识别结果</h3>
              <p>每个材料位对应一份识别结果，方便你核对哪一份识别得好，哪一份需要手动补充。</p>
            </div>

            <div class="attachment-stack" v-if="attachmentSummaries.length > 0">
              <article v-for="item in attachmentSummaries" :key="`${item.slotKey}-${item.filename}`" class="attachment-card">
                <div class="attachment-head">
                  <div class="attachment-title">
                    <strong>{{ item.slotTitle }}</strong>
                    <span class="filename">{{ item.filename }}</span>
                  </div>
                  <span class="chip">{{ item.detectedKind || item.docType }}</span>
                </div>
                <div v-if="Object.keys(item.extractedFields).length > 0" class="field-pills">
                  <span v-for="(value, key) in item.extractedFields" :key="`${item.slotKey}-${key}`">{{ key }}：{{ value }}</span>
                </div>
                <ul v-if="item.warnings.length > 0" class="warning-list compact">
                  <li v-for="warning in item.warnings" :key="warning">{{ warning }}</li>
                </ul>
                <textarea
                  rows="5"
                  :value="attachmentOcrTexts[item.slotKey] || item.extractedText"
                  @input="updateAttachmentText(item.slotKey, ($event.target as HTMLTextAreaElement).value)"
                  placeholder="这里会显示该材料的自动提取文本；如果为空，可以手动补充关键内容。"
                />
              </article>
            </div>
          </div>
        </aside>

        <section class="form-panel">
          <div class="step-card spacious">
            <span class="step-index">4</span>
            <div>
              <h3>确认并修正申请表</h3>
              <p>系统会基于当前所有已上传材料自动回填，你确认无误后再统一提交初审。</p>
            </div>

            <div class="material-strip">
              <span v-for="item in normalizedMaterials" :key="item" class="chip solid">{{ item }}</span>
              <span v-if="normalizedMaterials.length === 0" class="muted">上传材料后会在这里汇总本次申请的提交清单</span>
            </div>

            <form class="form" @submit.prevent="submitPrecheck">
              <label>
                申请人姓名
                <input v-model="form.applicantName" placeholder="可由身份证或申请书自动回填" />
              </label>
              <label>
                证件号
                <input v-model="form.idNumber" placeholder="可由身份证自动回填" />
              </label>
              <label>
                联系方式
                <input v-model="form.contactPhone" placeholder="申请书中若有手机号会自动回填" />
              </label>
              <label>
                申请表项目名称
                <input v-model="form.projectName" placeholder="申请书中的项目名称" />
              </label>
              <label>
                附件报告项目名称
                <input v-model="form.attachedProjectName" placeholder="论证报告中的项目名称" />
              </label>
              <label>
                申请表法定代表人
                <input v-model="form.formLegalRepresentative" placeholder="申请书中的法定代表人" />
              </label>
              <label>
                营业执照法定代表人
                <input v-model="form.licenseLegalRepresentative" placeholder="营业执照中的法定代表人" />
              </label>
              <label>
                取水用途
                <select v-model="form.waterPurpose">
                  <option value="">请选择</option>
                  <option>农业灌溉</option>
                  <option>工业用水</option>
                  <option>生活用水</option>
                  <option>其他</option>
                </select>
              </label>
              <label v-if="form.waterPurpose === '其他'">
                其他用途说明
                <input v-model="form.customPurpose" placeholder="按指导书要求，选其他时必须补充说明" />
              </label>
              <label>
                取水地点
                <input v-model="form.waterLocation" placeholder="如：某饮用水水源保护区二级区" />
              </label>
              <label>
                申请期限（年）
                <input v-model="form.applicationPeriodYears" type="number" min="0" step="1" placeholder="如：3" />
              </label>
              <label>
                项目批准期限（年）
                <input v-model="form.projectApprovalPeriodYears" type="number" min="0" step="1" placeholder="用于校验有效期冲突" />
              </label>
              <label>
                申请取水量（万m3/年）
                <input v-model="form.requestedWaterAmount" type="number" min="0" step="0.01" placeholder="申请书中的取水量" />
              </label>
              <label>
                报告测算用水量（万m3/年）
                <input v-model="form.reportEstimatedWaterAmount" type="number" min="0" step="0.01" placeholder="论证报告中的用水量" />
              </label>
              <label>
                第三方影响说明
                <input v-model="form.thirdPartyImpactDescription" placeholder="用于实质合规性检查" />
              </label>
              <label>
                补救措施
                <input v-model="form.mitigationMeasures" placeholder="用于实质合规性检查" />
              </label>
              <label>
                论证报告出具日期
                <input v-model="form.reportIssuedAt" type="date" />
              </label>
              <label>
                法规依据版本
                <input v-model="form.legalBasisVersion" placeholder="如：水法2023版" />
              </label>
              <label>
                权属证明类型
                <input v-model="form.ownershipProofType" placeholder="如：不动产权证、租赁合同" />
              </label>

              <div class="actions">
                <button type="submit" :disabled="submitting || allSelectedSlots.length === 0">
                  {{ submitting ? '初审中...' : '提交整套材料并生成初审结果' }}
                </button>
                <button class="minor" type="button" @click="currentPage = 'result'" :disabled="!result">查看最近结果</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </section>

    <section v-if="currentPage === 'create' && currentRole === 'admin'" class="panel">
      <h2>管理员不能提交申请</h2>
      <p class="empty">当前身份是 admin 审核员，请进入“审核工作台”处理 AI 初审通过后的申请。</p>
    </section>

    <section v-if="currentPage === 'result'" class="panel">
      <h2>初审结果页面</h2>
      <div v-if="!result" class="empty">请先在“新建申请”上传整套材料并提交初审。</div>
      <div v-else class="result-board">
        <div class="review-flow">
          <div class="review-step">
            <span :class="['tag', result.status === 'PASS' ? 'pass' : 'fail']">AI 初审：{{ result.status === 'PASS' ? '通过' : '未通过' }}</span>
          </div>
          <div class="review-step">
            <span class="tag pending">人工审核：{{ manualLabel(result.manualStatus) }}</span>
          </div>
          <div class="review-step">
            <span :class="['tag', result.finalStatus === 'APPROVED' ? 'pass' : result.finalStatus === 'REJECTED' ? 'fail' : 'pending']">
              最终状态：{{ finalLabel(result.finalStatus) }}
            </span>
          </div>
        </div>
        <p class="suggestion">建议：{{ result.suggestion }}</p>
        <ul v-if="result.issues.length > 0" class="issues">
          <li v-for="issue in result.issues" :key="issue">{{ issue }}</li>
        </ul>
        <p v-else>未发现不合规项。</p>
        <div v-if="result.ragReferences.length > 0" class="rag-box">
          <h3>RAG 检索依据</h3>
          <ul>
            <li v-for="ref in result.ragReferences" :key="ref">{{ ref }}</li>
          </ul>
        </div>
      </div>
    </section>

    <section v-if="currentPage === 'list'" class="panel">
      <div class="panel-head">
        <h2>{{ currentRole === 'admin' ? '审核工作台' : '我的申请' }}</h2>
        <button class="minor" @click="loadApplications">刷新</button>
      </div>
      <p v-if="loading">加载中...</p>
      <table v-else>
        <thead>
          <tr>
            <th>ID</th>
            <th>申请人</th>
            <th>证件号</th>
            <th>联系方式</th>
            <th>取水用途</th>
            <th>AI 初审</th>
            <th>流程状态</th>
            <th>人工审核</th>
            <th>问题</th>
            <th v-if="currentRole === 'admin'">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in applications" :key="item.id">
            <td>{{ item.id }}</td>
            <td>{{ item.applicantName }}</td>
            <td>{{ item.idNumber }}</td>
            <td>{{ item.contactPhone }}</td>
            <td>{{ item.waterPurpose }}</td>
            <td><span :class="['tag', item.status === 'PASS' ? 'pass' : 'fail']">{{ item.status }}</span></td>
            <td><span class="tag pending">{{ workflowLabel(item.workflowStatus) }}</span></td>
            <td>{{ manualLabel(item.manualStatus) }}</td>
            <td>{{ item.issues || '无' }}</td>
            <td v-if="currentRole === 'admin'">
              <div v-if="item.workflowStatus === 'PENDING_MANUAL_REVIEW'" class="table-actions">
                <button type="button" @click="submitManualReview(item.id, 'APPROVE')" :disabled="reviewingId === item.id">通过</button>
                <button class="danger" type="button" @click="submitManualReview(item.id, 'REJECT')" :disabled="reviewingId === item.id">驳回</button>
              </div>
              <span v-else class="muted">{{ finalLabel(item.finalStatus) }}</span>
            </td>
          </tr>
          <tr v-if="applications.length === 0">
            <td :colspan="currentRole === 'admin' ? 10 : 9" class="empty">暂无申请记录</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>
