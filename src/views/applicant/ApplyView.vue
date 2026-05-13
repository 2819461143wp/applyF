<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { materialSlots } from '../../constants/materials'
import { extractDraft, submitPrecheckRequest } from '../../services/api'
import { useApplicationStore } from '../../stores/applications'
import type { AttachmentPayload, ExtractionDraft, SlotKey } from '../../types/domain'
import { fileToBase64 } from '../../utils/files'

const router = useRouter()
const applicationStore = useApplicationStore()
const submitting = ref(false)
const extracting = ref(false)
const extractionDraft = ref<ExtractionDraft | null>(null)
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
  materialSlots.filter((slot) => slotFiles.value[slot.key]).map((slot) => ({ slot, file: slotFiles.value[slot.key] as File })),
)
const missingRequiredSlots = computed(() => materialSlots.filter((slot) => slot.required && !slotFiles.value[slot.key]))
const extractionWarnings = computed(() => extractionDraft.value?.warnings ?? [])
const normalizedMaterials = computed(() => {
  const names = new Set<string>(extractionDraft.value?.materials ?? [])
  for (const { slot, file } of allSelectedSlots.value) {
    names.add(slot.key === 'other' ? file.name : slot.materialName)
  }
  return Array.from(names)
})
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
  for (const summary of draft.attachmentSummaries) {
    const slot = materialSlots.find((item) => item.docType === summary.docType || item.docType === summary.detectedKind)
    if (slot && summary.extractedText) {
      attachmentOcrTexts.value[slot.key] = summary.extractedText
    }
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
    const draft = await extractDraft(buildRequestBody(attachments))
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
      attachmentSummaries: [],
    }
  } finally {
    extracting.value = false
  }
}

async function onSlotFileChange(slotKey: SlotKey, event: Event) {
  const input = event.target as HTMLInputElement
  slotFiles.value[slotKey] = input.files?.[0] ?? null
  attachmentOcrTexts.value[slotKey] = ''
  await runExtraction()
}

function clearSlot(slotKey: SlotKey) {
  slotFiles.value[slotKey] = null
  attachmentOcrTexts.value[slotKey] = ''
  void runExtraction()
}

async function submitPrecheck() {
  if (missingRequiredSlots.value.length > 0) {
    applicationStore.latestResult.value = {
      applicationId: null,
      status: 'FAIL',
      issues: missingRequiredSlots.value.map((slot) => `缺少必交材料：${slot.title}`),
      suggestion: '请先补齐申请书、身份证、营业执照后再提交。',
      workflowStatus: 'AI_REJECTED',
      manualStatus: 'NOT_REQUIRED',
      finalStatus: 'REJECTED',
      ragReferences: [],
    }
    await router.push('/applicant/result')
    return
  }
  submitting.value = true
  try {
    const attachments = await buildAttachments()
    applicationStore.latestResult.value = await submitPrecheckRequest(buildRequestBody(attachments))
    await applicationStore.loadApplications()
    await router.push('/applicant/result')
  } catch (error) {
    applicationStore.latestResult.value = {
      applicationId: null,
      status: 'FAIL',
      issues: [error instanceof Error ? error.message : '提交失败'],
      suggestion: '请确认 Spring Boot 与 FastAPI 服务均已启动。',
      workflowStatus: 'AI_REJECTED',
      manualStatus: 'NOT_REQUIRED',
      finalStatus: 'REJECTED',
      ragReferences: [],
    }
    await router.push('/applicant/result')
  } finally {
    submitting.value = false
  }
}

function resetForm() {
  Object.assign(form, {
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
  for (const slot of materialSlots) {
    slotFiles.value[slot.key] = null
    attachmentOcrTexts.value[slot.key] = ''
  }
  extractionDraft.value = null
  applicationStore.latestResult.value = null
}
</script>

<template>
  <section class="panel workflow">
    <div class="workflow-head">
      <div>
        <p class="section-kicker">Step 1 / Upload</p>
        <h2>按材料清单上传，OCR 自动回填申请表</h2>
      </div>
      <button class="minor" type="button" @click="resetForm">重置申请</button>
    </div>

    <div class="workflow-grid">
      <aside class="intake">
        <article v-for="slot in materialSlots" :key="slot.key" class="upload-slot">
          <div class="slot-head">
            <strong>{{ slot.title }}</strong>
            <span :class="['chip', slot.required ? 'solid' : '']">{{ slot.required ? '必交' : '选交' }}</span>
          </div>
          <p>{{ slot.hint }}</p>
          <label class="upload-box">
            <input type="file" @change="onSlotFileChange(slot.key, $event)" />
            <span>{{ slotFiles[slot.key]?.name || `上传${slot.title}` }}</span>
          </label>
          <button v-if="slotFiles[slot.key]" class="minor tiny" type="button" @click="clearSlot(slot.key)">移除</button>
        </article>
      </aside>

      <section class="form-panel">
        <div class="step-card">
          <div class="step-header">
            <div>
              <h3>识别结果</h3>
              <p>每个材料独立识别，不会覆盖其他材料；右侧表单可人工修正。</p>
            </div>
            <button class="minor" type="button" :disabled="extracting || allSelectedSlots.length === 0" @click="runExtraction">
              {{ extracting ? '识别中...' : '重新识别' }}
            </button>
          </div>
          <ul class="warning-list">
            <li v-for="slot in missingRequiredSlots" :key="slot.key">缺少必交材料：{{ slot.title }}</li>
            <li v-for="warning in extractionWarnings" :key="warning">{{ warning }}</li>
          </ul>
          <div class="attachment-stack">
            <article v-for="item in attachmentSummaries" :key="`${item.slotKey}-${item.filename}`" class="attachment-card">
              <div class="attachment-head">
                <strong>{{ item.slotTitle }} / {{ item.filename }}</strong>
                <span class="chip">{{ item.detectedKind }}</span>
              </div>
              <div v-if="Object.keys(item.extractedFields).length" class="field-pills">
                <span v-for="(value, key) in item.extractedFields" :key="key">{{ key }}：{{ value }}</span>
              </div>
              <textarea
                rows="4"
                :value="attachmentOcrTexts[item.slotKey] || item.extractedText"
                placeholder="该材料的 OCR/解析文本会显示在这里"
                @input="attachmentOcrTexts[item.slotKey] = ($event.target as HTMLTextAreaElement).value"
              />
            </article>
          </div>
        </div>

        <form class="form step-card spacious" @submit.prevent="submitPrecheck">
          <h3 class="full">申请表信息</h3>
          <label>申请人姓名<input v-model="form.applicantName" /></label>
          <label>证件号<input v-model="form.idNumber" /></label>
          <label>联系方式<input v-model="form.contactPhone" /></label>
          <label>申请表项目名称<input v-model="form.projectName" /></label>
          <label>附件报告项目名称<input v-model="form.attachedProjectName" /></label>
          <label>申请表法定代表人<input v-model="form.formLegalRepresentative" /></label>
          <label>营业执照法定代表人<input v-model="form.licenseLegalRepresentative" /></label>
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
          <label v-if="form.waterPurpose === '其他'">其他用途说明<input v-model="form.customPurpose" /></label>
          <label>取水地点<input v-model="form.waterLocation" /></label>
          <label>申请期限（年）<input v-model="form.applicationPeriodYears" type="number" min="0" /></label>
          <label>项目批准期限（年）<input v-model="form.projectApprovalPeriodYears" type="number" min="0" /></label>
          <label>申请取水量<input v-model="form.requestedWaterAmount" type="number" min="0" step="0.01" /></label>
          <label>报告测算用水量<input v-model="form.reportEstimatedWaterAmount" type="number" min="0" step="0.01" /></label>
          <label>第三方影响说明<input v-model="form.thirdPartyImpactDescription" /></label>
          <label>补救措施<input v-model="form.mitigationMeasures" /></label>
          <label>报告出具日期<input v-model="form.reportIssuedAt" type="date" /></label>
          <label>法规依据版本<input v-model="form.legalBasisVersion" /></label>
          <label>权属证明类型<input v-model="form.ownershipProofType" /></label>
          <div class="material-strip full">
            <span v-for="item in normalizedMaterials" :key="item" class="chip solid">{{ item }}</span>
          </div>
          <div class="actions full">
            <button type="submit" :disabled="submitting || allSelectedSlots.length === 0">{{ submitting ? '提交中...' : '提交 AI 初审' }}</button>
            <RouterLink class="button-link minor" to="/applicant/result">查看结果</RouterLink>
          </div>
        </form>
      </section>
    </div>
  </section>
</template>
