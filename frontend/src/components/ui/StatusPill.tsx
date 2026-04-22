export const statusLabelMap = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
} as const

type StatusPillProps = {
  status: keyof typeof statusLabelMap
}

export default function StatusPill({ status }: StatusPillProps) {
  return <span className={`status-pill whitespace-nowrap status-pill--${status}`}>{statusLabelMap[status]}</span>
}
