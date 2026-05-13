import type { MaterialSlot } from '../types/domain'

export const materialSlots: MaterialSlot[] = [
  {
    key: 'application_form',
    title: '申请书',
    hint: '必交。上传填写后的申请书，用于自动回填项目名称、取水地点、期限和取水量。',
    docType: 'application_form',
    materialName: '申请书',
    required: true,
  },
  {
    key: 'id_card',
    title: '身份证',
    hint: '必交。用于识别申请人姓名和证件号码，并校验证照类型。',
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
    hint: '建议上传。用于比对项目名称、论证内容、第三方影响和用水量。',
    docType: 'report',
    materialName: '水资源论证报告',
    required: false,
  },
  {
    key: 'ownership_proof',
    title: '权属证明',
    hint: '建议上传。不动产权证、租赁合同等支撑文件。',
    docType: 'ownership_proof',
    materialName: '权属证明',
    required: false,
  },
  {
    key: 'other',
    title: '其他支撑材料',
    hint: '可选。承诺书、补充说明等材料。',
    docType: 'unknown',
    materialName: '其他材料',
    required: false,
  },
]
