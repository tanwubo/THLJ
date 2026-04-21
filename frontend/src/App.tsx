import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login/Login'
import Timeline from './pages/Timeline/Timeline'
import Statistics from './pages/Statistics/Statistics'
import Settings from './pages/Settings/Settings'
import NodeDetail from './pages/NodeDetail/NodeDetail'
import { useAuthStore } from './store/authStore'
import { useAuthSocketLifecycle } from './hooks/useAuthSocketLifecycle'

// 受保护的路由组件
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { token, _hasHydrated } = useAuthStore()
  if (!_hasHydrated) {
    return <div className="app-loading-screen">加载中...</div>
  }
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function App() {
  const { token, loadProfile, _hasHydrated } = useAuthStore()
  useAuthSocketLifecycle()

  useEffect(() => {
    if (token && _hasHydrated) {
      loadProfile().catch(() => {
        // 加载失败会自动跳转到登录页
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, _hasHydrated])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Timeline />
        </ProtectedRoute>
      } />
      <Route path="/statistics" element={
        <ProtectedRoute>
          <Statistics />
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/node/:id" element={
        <ProtectedRoute>
          <NodeDetail />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default App
