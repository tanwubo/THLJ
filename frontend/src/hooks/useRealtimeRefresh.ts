import { useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'

export function useRealtimeRefresh(events: string[], refresh: () => void, enabled = true) {
  const { socket } = useAuthStore()
  const refreshRef = useRef(refresh)

  refreshRef.current = refresh

  useEffect(() => {
    if (!enabled || !socket) {
      return
    }

    const handleRefresh = () => {
      refreshRef.current()
    }

    for (const event of events) {
      socket.on(event, handleRefresh)
    }

    return () => {
      for (const event of events) {
        socket.off(event, handleRefresh)
      }
    }
  }, [enabled, events, socket])
}
