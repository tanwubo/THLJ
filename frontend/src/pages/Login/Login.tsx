import { useState } from 'react'
import { Button, Input, Toast, Tabs } from 'antd-mobile'

const Login = () => {
  const [activeTab, setActiveTab] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')

  const handleLogin = () => {
    if (!username || !password) {
      Toast.show('请输入用户名和密码')
      return
    }
    // TODO: 实现登录逻辑
    Toast.show('登录功能开发中...')
  }

  const handleRegister = () => {
    if (!username || !password) {
      Toast.show('请输入用户名和密码')
      return
    }
    // TODO: 实现注册逻辑
    Toast.show('注册功能开发中...')
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
