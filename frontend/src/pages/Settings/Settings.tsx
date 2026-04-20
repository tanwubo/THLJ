import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { authAPI } from '../../services/api'
import { Button, Toast, Dialog, Input } from 'antd-mobile'

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout, loadProfile } = useAuthStore()
  const [showBind, setShowBind] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogout = () => {
    Dialog.confirm({
      content: '确定退出登录？',
      onConfirm: () => {
        logout()
        navigate('/login')
      },
    })
  }

  const handleBindPartner = async () => {
    if (!inviteCode.trim()) {
      Toast.show('请输入邀请码')
      return
    }
    setLoading(true)
    try {
      await authAPI.bindPartner({ inviteCode: inviteCode.trim() })
      Toast.show('绑定成功')
      setShowBind(false)
      setInviteCode('')
      await loadProfile()
    } catch (error: any) {
      Toast.show(error.response?.data?.error || '绑定失败')
    } finally {
      setLoading(false)
    }
  }

  const handleUnbindPartner = () => {
    Dialog.confirm({
      content: '确定解除绑定？解除后双方数据仍然保留，但不再同步。',
      onConfirm: async () => {
        try {
          await authAPI.unbindPartner()
          Toast.show('已解除绑定')
          await loadProfile()
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '解除失败')
        }
      },
    })
  }

  const copyInviteCode = () => {
    if (user?.inviteCode) {
      navigator.clipboard.writeText(user.inviteCode)
      Toast.show('邀请码已复制')
    }
  }

  const handleBackup = async () => {
    try {
      Toast.show('正在导出数据...')
      const res = await authAPI.getBackup()
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `wedding-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      Toast.show('备份已下载')
    } catch (error) {
      Toast.show('备份失败')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* 头部 */}
      <div className="bg-wedding-red text-white p-4">
        <h1 className="text-xl font-bold">⚙️ 设置</h1>
        <p className="text-sm mt-1">{user?.username}</p>
      </div>

      <div className="p-4 space-y-4">
        {/* 账号信息 */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3">账号信息</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">用户名</span>
              <span>{user?.username}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">邀请码</span>
              <div className="flex items-center gap-2">
                <span className="font-mono">{user?.inviteCode}</span>
                <button onClick={copyInviteCode} className="text-blue-500 text-xs">复制</button>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">绑定状态</span>
              <span>{user?.partnerId ? '💑 已绑定' : '❌ 未绑定'}</span>
            </div>
          </div>
        </div>

        {/* 情侣绑定 */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3">情侣绑定</h2>
          {user?.partnerId ? (
            <div className="space-y-3">
              <div className="text-sm text-gray-600">
                已绑定用户: {user.partner?.username}
              </div>
              <Button color="danger" size="small" onClick={handleUnbindPartner}>
                解除绑定
              </Button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-500 mb-3">
                将您的邀请码发送给另一半，或输入对方的邀请码进行绑定
              </p>
              {showBind ? (
                <div className="space-y-2">
                  <Input
                    placeholder="输入对方邀请码"
                    value={inviteCode}
                    onChange={setInviteCode}
                  />
                  <div className="flex gap-2">
                    <Button size="small" onClick={() => setShowBind(false)}>取消</Button>
                    <Button color="danger" size="small" onClick={handleBindPartner} loading={loading}>确认绑定</Button>
                  </div>
                </div>
              ) : (
                <Button color="danger" onClick={() => setShowBind(true)}>
                  绑定情侣账号
                </Button>
              )}
            </div>
          )}
        </div>

        {/* 数据管理 */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3">数据管理</h2>
          <div className="space-y-2">
            <Button size="small" onClick={handleBackup}>
              📥 备份数据
            </Button>
            <p className="text-xs text-gray-400">
              导出所有数据为 JSON 文件，方便迁移或备份
            </p>
          </div>
        </div>

        {/* 系统操作 */}
        <div className="bg-white rounded-lg p-4">
          <h2 className="font-medium mb-3 text-red-600">系统</h2>
          <Button color="danger" onClick={handleLogout}>
            退出登录
          </Button>
        </div>
      </div>

      {/* 底部导航 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2">
        <button onClick={() => navigate('/')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📋</span>
          <span className="text-xs">时间线</span>
        </button>
        <button onClick={() => navigate('/statistics')} className="flex flex-col items-center text-gray-400">
          <span className="text-xl">📊</span>
          <span className="text-xs">统计</span>
        </button>
        <button className="flex flex-col items-center text-wedding-red">
          <span className="text-xl">⚙️</span>
          <span className="text-xs">设置</span>
        </button>
      </div>
    </div>
  )
}
