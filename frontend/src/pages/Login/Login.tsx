import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, Toast, Tabs } from 'antd-mobile'
import SurfaceCard from '../../components/ui/SurfaceCard'
import { useAuthStore } from '../../store/authStore'

const Login = () => {
  const [activeTab, setActiveTab] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const navigate = useNavigate()
  const { login, register, loading, token } = useAuthStore()

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
    } catch (_error) {
      // 错误已经在 store 中处理
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
    } catch (_error) {
      // 错误已经在 store 中处理
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-page__hero">
        <p className="auth-page__eyebrow">Wedding Manager</p>
        <h1 className="auth-page__title">婚嫁管家</h1>
        <p className="auth-page__subtitle">
          用高定计划册的方式，记录从决定、筹备到落地的每一程。
        </p>
      </div>

      <SurfaceCard className="auth-page__card">
        <div className="auth-page__card-header">
          <p className="auth-page__card-label">Planner Access</p>
          <h2 className="auth-page__card-title">进入你的筹备空间</h2>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab} className="auth-page__tabs">
          <Tabs.Tab title="登录" key="login" />
          <Tabs.Tab title="注册" key="register" />
        </Tabs>

        {activeTab === 'login' ? (
          <div className="auth-form">
            <label className="auth-form__field">
              <span>用户名</span>
              <Input placeholder="输入用户名" value={username} onChange={setUsername} />
            </label>
            <label className="auth-form__field">
              <span>密码</span>
              <Input type="password" placeholder="输入密码" value={password} onChange={setPassword} />
            </label>
            <Button block color="danger" size="large" onClick={handleLogin} loading={loading} disabled={loading}>
              登录
            </Button>
          </div>
        ) : (
          <div className="auth-form">
            <label className="auth-form__field">
              <span>用户名</span>
              <Input placeholder="输入用户名" value={username} onChange={setUsername} />
            </label>
            <label className="auth-form__field">
              <span>密码</span>
              <Input type="password" placeholder="设置密码" value={password} onChange={setPassword} />
            </label>
            <label className="auth-form__field">
              <span>邮箱（可选）</span>
              <Input placeholder="输入邮箱" value={email} onChange={setEmail} />
            </label>
            <Button block color="danger" size="large" onClick={handleRegister} loading={loading} disabled={loading}>
              注册
            </Button>
          </div>
        )}
      </SurfaceCard>
    </div>
  )
}

export default Login
