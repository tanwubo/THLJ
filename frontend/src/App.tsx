import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect } from 'react'
import Login from './pages/Login/Login'
import { useAuthStore } from './store/authStore'

// 受保护的路由组件
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { token } = useAuthStore()
  if (!token) {
    return <Navigate to="/login" replace />
  }
  return children
}

function App() {
  const { token, loadProfile } = useAuthStore()

  useEffect(() => {
    // 如果有token，加载用户信息
    if (token) {
      loadProfile().catch(() => {
        // 加载失败会自动跳转到登录页
      })
    }
  }, [token, loadProfile])

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <ProtectedRoute>
          <div className="text-center py-20">
            <h1 className="text-2xl font-bold text-wedding-red">💒 婚嫁管家</h1>
            <p className="text-gray-600 mt-4">登录成功！功能开发中...</p>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default App
