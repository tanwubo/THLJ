import { useParams } from 'react-router-dom'

export default function NodeDetail() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <h1>节点详情 - {id}</h1>
      <p>功能开发中...</p>
    </div>
  )
}
