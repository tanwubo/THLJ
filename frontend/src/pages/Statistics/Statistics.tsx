import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
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
  const [loading, setLoading] = useState(true)

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
        completedTodos: nodes.reduce((sum: number, n: any) =>
          sum + (n.todos?.filter((t: any) => t.status === 'completed').length || 0), 0),
        overallProgress: res.data.overallProgress || 0,
      })
    } catch (error) {
      console.error('获取统计失败:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* 头部 */}
      <div className="bg-wedding-red text-white p-4">
        <h1 className="text-xl font-bold">📊 统计中心</h1>
        <p className="text-sm mt-1">{user?.username} {partnerId && '💑'}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* 整体进度 */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3">整体进度</h2>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="12"
                />
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="12"
                  strokeDasharray={`${(stats.overallProgress / 100) * 352} 352`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-bold text-wedding-red">{stats.overallProgress}%</span>
              </div>
            </div>
          </div>
          <p className="text-center text-gray-500 mt-2">已完成 {stats.completedNodes}/{stats.totalNodes} 个节点</p>
        </div>

        {/* 节点状态 */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3">节点状态</h2>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.completedNodes}</div>
              <div className="text-xs text-green-600">已完成</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.inProgressNodes}</div>
              <div className="text-xs text-blue-600">进行中</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingNodes}</div>
              <div className="text-xs text-yellow-600">待处理</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-600">{stats.cancelledNodes}</div>
              <div className="text-xs text-gray-600">已取消</div>
            </div>
          </div>
        </div>

        {/* 待办统计 */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3">待办统计</h2>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-gray-500 text-sm">总待办</div>
              <div className="text-2xl font-bold">{stats.totalTodos}</div>
            </div>
            <div>
              <div className="text-gray-500 text-sm">已完成</div>
              <div className="text-2xl font-bold text-green-600">{stats.completedTodos}</div>
            </div>
            <div>
              <div className="text-gray-500 text-sm">完成率</div>
              <div className="text-2xl font-bold text-wedding-red">
                {stats.totalTodos > 0 ? Math.round((stats.completedTodos / stats.totalTodos) * 100) : 0}%
              </div>
            </div>
          </div>
          {stats.totalTodos > 0 && (
            <div className="mt-3 h-2 bg-gray-200 rounded-full">
              <div
                className="h-full bg-wedding-red rounded-full"
                style={{ width: `${(stats.completedTodos / stats.totalTodos) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2">
        <button onClick={() => navigate('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">时间线</span>
        </button>
        <button className="flex flex-col items-center text-wedding-red">
          <span className="text-xl">📊</span>
          <span className="text-xs">统计</span>
        </button>
        <button onClick={() => navigate('/settings')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">设置</span>
        </button>
      </div>
    </div>
  )
}