import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Toast, Tabs } from 'antd-mobile'
import { useAuthStore } from '../../store/authStore'

const Login = () => {
  const [activeTab, setActiveTab] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const { login, register, loading, token } = useAuthStore()

  // 如果已经登录，直接跳转到首页
  if (token) {
    navigate('/')
    return null
  }

  const handleLogin = async () => {
    if (!username || !password) {
      Toast.show('请输入用户名和密码')
      return
    }
    try {
      await login(username, password)
      navigate('/')
    } catch (error) {
      // 错误已经在store中处理了
    }
  }

  const handleRegister = async () => {
    if (!username || !password) {
      Toast.show('请输入用户名和密码')
      return
    }
    if (username.length < 3 || username.length > 20) {
      Toast.show('用户名长度必须在3-20位之间')
      return
    }
    if (password.length < 6 || password.length > 32) {
      Toast.show('密码长度必须在6-32位之间')
      return
    }
    try {
      await register(username, password, email || undefined)
      navigate('/')
    } catch (error) {
      // 错误已经在store中处理了
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-red-50 flex flex-col justify-center px-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-wedding-red mb-2">💒 婚嫁管家</h1>
        <p className="text-gray-600">记录我们的幸福每一步</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-6">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="mb-6"
        >
          <Tabs.Tab title="登录" key="login" />
          <Tabs.Tab title="注册" key="register" />
        </Tabs>

        {activeTab === 'login' ? (
          <div className="space-y-4">
            <Input
              placeholder="用户名"
              value={username}
              onChange={setUsername}
              className="border border-gray-200 rounded-lg p-3"
            />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={setPassword}
              className="border border-gray-200 rounded-lg p-3"
            />
            <Button
              block
              color="danger"
              size="large"
              onClick={handleLogin}
              loading={loading}
              disabled={loading}
              className="bg-wedding-red rounded-lg h-12 text-white font-medium"
            >
              登录
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              placeholder="用户名"
              value={username}
              onChange={setUsername}
              className="border border-gray-200 rounded-lg p-3"
            />
            <Input
              type="password"
              placeholder="密码"
              value={password}
              onChange={setPassword}
              className="border border-gray-200 rounded-lg p-3"
            />
            <Input
              placeholder="邮箱（可选）"
              value={email}
              onChange={setEmail}
              className="border border-gray-200 rounded-lg p-3"
            />
            <Button
              block
              color="danger"
              size="large"
              onClick={handleRegister}
              loading={loading}
              disabled={loading}
              className="bg-wedding-red rounded-lg h-12 text-white font-medium"
            >
              注册
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Login
