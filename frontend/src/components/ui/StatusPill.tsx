export const statusLabelMap = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
} as const

type StatusPillProps = {
  status: keyof typeof statusLabelMap
  inverse?: boolean
}

export default function StatusPill({ status, inverse }: StatusPillProps) {
  const className = `status-pill whitespace-nowrap status-pill--${status}${inverse ? ' status-pill--inverse' : ''}`
  return <span className={className}>{statusLabelMap[status]}</span>
}
