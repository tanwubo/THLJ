const labelMap = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
} as const

type StatusPillProps = {
  status: keyof typeof labelMap
}

export default function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill status-pill--${status}`}>{labelMap[status]}</span>
}
