export function workflowLabel(value: string) {
  return (
    {
      AI_REJECTED: 'AI 初审未通过',
      PENDING_MANUAL_REVIEW: '待人工审核',
      MANUAL_APPROVED: '人工审核通过',
      MANUAL_REJECTED: '人工审核驳回',
    }[value] ?? value
  )
}

export function manualLabel(value: string) {
  return ({ PENDING: '待审核', APPROVED: '已通过', REJECTED: '已驳回', NOT_REQUIRED: '无需人工' }[value] ?? value)
}

export function finalLabel(value: string) {
  return ({ PENDING: '处理中', APPROVED: '通过', REJECTED: '不通过' }[value] ?? value)
}

export function displaySourceName(source: string) {
  if (/^\?+(\.[^.]*)?$/.test(source)) {
    return `${source}（历史文件名编码异常，建议删除后重新上传）`
  }
  return source === 'seed_rules' ? '内置课堂规则' : source
}
