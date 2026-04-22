import { useEffect, useRef, useState } from 'react'
import { timelineAPI, type NodeWorkbench } from '../../services/api'
import type { NodeWorkbenchData } from './types'

function toWorkbenchData(workbench: NodeWorkbench): NodeWorkbenchData {
  return {
    ...workbench,
    node: {
      ...workbench.node,
      budget: Number(workbench.node.budget ?? 0),
      expenses: workbench.node.expenses ?? [],
      attachments: workbench.node.attachments ?? [],
    },
  }
}

export function useNodeWorkbench(nodeId: number) {
  const [data, setData] = useState<NodeWorkbenchData | null>(null)
  const [loading, setLoading] = useState(true)
  const latestRequestIdRef = useRef(0)

  const runWorkbenchRequest = async (options?: { startLoading?: boolean }) => {
    const requestId = latestRequestIdRef.current + 1
    latestRequestIdRef.current = requestId

    if (options?.startLoading) {
      setLoading(true)
    }

    try {
      const response = await timelineAPI.getWorkbench(nodeId)
      const normalized = toWorkbenchData(response.data)

      if (requestId === latestRequestIdRef.current) {
        setData(normalized)
      }

      return normalized
    } finally {
      if (requestId === latestRequestIdRef.current) {
        setLoading(false)
      }
    }
  }

  const refresh = async () => {
    return runWorkbenchRequest()
  }

  useEffect(() => {
    void runWorkbenchRequest({ startLoading: true })

    return () => {
      latestRequestIdRef.current += 1
    }
  }, [nodeId])

  return { data, loading, refresh }
}

export default useNodeWorkbench
