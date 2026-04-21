import { useEffect, useState } from 'react'
import AppShell from '../../components/layout/AppShell'
import BrandHeader from '../../components/layout/BrandHeader'
import SurfaceCard from '../../components/ui/SurfaceCard'
import { useAuthStore } from '../../store/authStore'
import { timelineAPI } from '../../services/api'

interface Stats {
  totalNodes: number
  completedNodes: number
  inProgressNodes: number
  pendingNodes: number
  cancelledNodes: number
  totalTodos: number
  completedTodos: number
  overallProgress: number
}

export default function Statistics() {
  const { user, partnerId } = useAuthStore()
  const [stats, setStats] = useState<Stats>({
    totalNodes: 0,
    completedNodes: 0,
    inProgressNodes: 0,
    pendingNodes: 0,
    cancelledNodes: 0,
    totalTodos: 0,
    completedTodos: 0,
    overallProgress: 0,
  })

  const fetchStats = async () => {
    try {
      const res = await timelineAPI.getTimeline()
      const nodes = res.data.nodes || []

      setStats({
        totalNodes: nodes.length,
        completedNodes: nodes.filter((n: any) => n.status === 'completed').length,
        inProgressNodes: nodes.filter((n: any) => n.status === 'in_progress').length,
        pendingNodes: nodes.filter((n: any) => n.status === 'pending').length,
        cancelledNodes: nodes.filter((n: any) => n.status === 'cancelled').length,
        totalTodos: nodes.reduce((sum: number, n: any) => sum + (n.todos?.length || 0), 0),
        completedTodos: nodes.reduce(
          (sum: number, n: any) => sum + (n.todos?.filter((t: any) => t.status === 'completed').length || 0),
          0,
        ),
        overallProgress: res.data.overallProgress || 0,
      })
    } catch (error) {
      console.error('获取统计失败:', error)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  if (loading) {
    return <div className="app-loading-screen">加载中...</div>
  }

  const completionRate = stats.totalTodos > 0 ? Math.round((stats.completedTodos / stats.totalTodos) * 100) : 0

  return (
    <AppShell
      withBottomNav
      header={
        <BrandHeader
          eyebrow="Planning Overview"
          title="筹备概览"
          subtitle={`${user?.username ?? ''}${partnerId ? ' · 双人同步中' : ' · 单人模式'}`}
        />
      }
    >
      <div className="statistics-page">
        <SurfaceCard className="stats-hero-card">
          <div className="stats-hero-card__ring">
            <svg viewBox="0 0 120 120" className="stats-progress-ring" aria-hidden="true">
              <circle cx="60" cy="60" r="46" className="stats-progress-ring__track" />
              <circle
                cx="60"
                cy="60"
                r="46"
                className="stats-progress-ring__value"
                strokeDasharray={`${(stats.overallProgress / 100) * 289} 289`}
              />
            </svg>
            <div className="stats-hero-card__ring-value">
              <strong>{stats.overallProgress}%</strong>
              <span>整体进度</span>
            </div>
          </div>
          <div className="stats-hero-card__summary">
            <p className="section-label">Progress</p>
            <h2 className="section-title">已完成 {stats.completedNodes}/{stats.totalNodes} 个节点</h2>
            <p className="section-copy">通过节点和待办的完成情况，快速判断当前筹备节奏是否稳定。</p>
          </div>
        </SurfaceCard>

        <div className="stats-grid">
          <SurfaceCard className="stats-metric-card">
            <span>已完成</span>
            <strong>{stats.completedNodes}</strong>
          </SurfaceCard>
          <SurfaceCard className="stats-metric-card">
            <span>进行中</span>
            <strong>{stats.inProgressNodes}</strong>
          </SurfaceCard>
          <SurfaceCard className="stats-metric-card">
            <span>待处理</span>
            <strong>{stats.pendingNodes}</strong>
          </SurfaceCard>
          <SurfaceCard className="stats-metric-card">
            <span>已取消</span>
            <strong>{stats.cancelledNodes}</strong>
          </SurfaceCard>
        </div>

        <SurfaceCard className="stats-todo-card">
          <div>
            <p className="section-label">Todos</p>
            <h2 className="section-title">待办完成率 {completionRate}%</h2>
          </div>
          <div className="stats-todo-card__summary">
            <div>
              <span>总待办</span>
              <strong>{stats.totalTodos}</strong>
            </div>
            <div>
              <span>已完成</span>
              <strong>{stats.completedTodos}</strong>
            </div>
          </div>
          <div className="timeline-progress__track">
            <div className="timeline-progress__value" style={{ width: `${completionRate}%` }} />
          </div>
        </SurfaceCard>
      </div>
    </AppShell>
  )
}
