import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dialog, Input, Toast } from 'antd-mobile'
import AppShell from '../../components/layout/AppShell'
import BrandHeader from '../../components/layout/BrandHeader'
import ThemePreviewCard from '../../components/ui/ThemePreviewCard'
import SurfaceCard from '../../components/ui/SurfaceCard'
import { authAPI } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { themes } from '../../theme/themes'
import { useTheme } from '../../theme/useTheme'

export default function Settings() {
  const navigate = useNavigate()
  const { user, logout, bindPartner, unbindPartner, loading } = useAuthStore()
  const { theme, setTheme } = useTheme()
  const [showBind, setShowBind] = useState(false)
  const [inviteCode, setInviteCode] = useState('')

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

    Dialog.confirm({
      content: '绑定后，双方将共用同一份筹备数据。当前版本中，输入谁的邀请码，就会保留谁当前的数据作为绑定后的共享数据；另一方当前数据不会自动合并。确定继续绑定吗？',
      confirmText: '确定绑定',
      onConfirm: async () => {
        try {
          await bindPartner(inviteCode.trim())
          setShowBind(false)
          setInviteCode('')
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '绑定失败')
        }
      },
    })
  }

  const handleUnbindPartner = () => {
    Dialog.confirm({
      content: '确定解除绑定？解除后双方数据仍然保留，但不再同步。',
      onConfirm: async () => {
        try {
          await unbindPartner()
        } catch (error: any) {
          Toast.show(error.response?.data?.error || '解除失败')
        }
      },
    })
  }

  const copyInviteCode = async () => {
    if (user?.inviteCode) {
      await navigator.clipboard.writeText(user.inviteCode)
      Toast.show('邀请码已复制')
    }
  }

  const handleBackup = async () => {
    try {
      Toast.show('正在导出数据...')
      const res = await authAPI.getBackup()
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `wedding-backup-${new Date().toISOString().split('T')[0]}.json`
      link.click()
      URL.revokeObjectURL(url)
      Toast.show('备份已下载')
    } catch (_error) {
      Toast.show('备份失败')
    }
  }

  return (
    <AppShell
      withBottomNav
      header={<BrandHeader eyebrow="Preferences" title="设置" subtitle={user?.username || 'Wedding Manager'} />}
    >
      <div className="settings-page">
        <SurfaceCard className="settings-section">
          <p className="section-label">Theme</p>
          <h2 className="section-title">外观主题</h2>
          <div className="theme-preview-grid">
            <ThemePreviewCard
              themeKey="ceremony-red"
              title={themes['ceremony-red'].label}
              description={themes['ceremony-red'].description}
              swatches={[
                themes['ceremony-red'].preview.hero,
                themes['ceremony-red'].preview.surface,
                themes['ceremony-red'].preview.accent,
              ]}
              selected={theme === 'ceremony-red'}
              onSelect={setTheme}
            />
            <ThemePreviewCard
              themeKey="champagne-light"
              title={themes['champagne-light'].label}
              description={themes['champagne-light'].description}
              swatches={[
                themes['champagne-light'].preview.hero,
                themes['champagne-light'].preview.surface,
                themes['champagne-light'].preview.accent,
              ]}
              selected={theme === 'champagne-light'}
              onSelect={setTheme}
            />
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Account</p>
          <h2 className="section-title">账号信息</h2>
          <div className="settings-meta">
            <div><span>用户名</span><strong>{user?.username}</strong></div>
            <div>
              <span>邀请码</span>
              <strong>{user?.inviteCode}</strong>
              <button type="button" className="brand-inline-button" onClick={copyInviteCode}>复制</button>
            </div>
            <div><span>绑定状态</span><strong>{user?.partnerId ? '已绑定' : '未绑定'}</strong></div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Partner</p>
          <h2 className="section-title">情侣绑定</h2>
          {user?.partnerId ? (
            <div className="settings-stack">
              <p className="section-copy">已绑定用户：{user.partner?.username}</p>
              <p className="section-copy">想保留谁当前的筹备数据，就输入谁的邀请码进行绑定。</p>
              <button type="button" className="brand-secondary-button" onClick={handleUnbindPartner}>
                解除绑定
              </button>
            </div>
          ) : (
            <div className="settings-stack">
              <p className="section-copy">将您的邀请码发送给另一半，或输入对方的邀请码进行绑定。</p>
              <p className="section-copy">想保留谁当前的筹备数据，就输入谁的邀请码进行绑定。</p>
              {showBind ? (
                <>
                  <label className="auth-form__field">
                    <span>对方邀请码</span>
                    <Input placeholder="输入邀请码" value={inviteCode} onChange={setInviteCode} />
                  </label>
                  <div className="timeline-form-actions">
                    <button type="button" className="brand-secondary-button" onClick={() => setShowBind(false)}>
                      取消
                    </button>
                    <button type="button" className="brand-primary-button" onClick={handleBindPartner} disabled={loading}>
                      {loading ? '绑定中...' : '确认绑定'}
                    </button>
                  </div>
                </>
              ) : (
                <button type="button" className="brand-primary-button" onClick={() => setShowBind(true)}>
                  绑定情侣账号
                </button>
              )}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">Data</p>
          <h2 className="section-title">数据管理</h2>
          <div className="settings-stack">
            <button type="button" className="brand-secondary-button" onClick={handleBackup}>
              备份数据
            </button>
            <p className="section-copy">导出所有数据为 JSON 文件，方便迁移或备份。</p>
          </div>
        </SurfaceCard>

        <SurfaceCard className="settings-section">
          <p className="section-label">System</p>
          <h2 className="section-title">系统操作</h2>
          <button type="button" className="brand-primary-button" onClick={handleLogout}>
            退出登录
          </button>
        </SurfaceCard>
      </div>
    </AppShell>
  )
}
