import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

export function useAuthSocketLifecycle() {
  const {
    token,
    user,
    socket,
    _hasHydrated,
    connectSocket,
    disconnectSocket,
  } = useAuthStore()

  useEffect(() => {
    const canConnect = Boolean(token && _hasHydrated && user?.partnerId)

    if (canConnect && !socket) {
      connectSocket()
      return
    }

    if (!canConnect && socket) {
      disconnectSocket()
    }
  }, [token, user?.partnerId, socket, _hasHydrated, connectSocket, disconnectSocket])
}
