import { Routes, Route } from 'react-router-dom'
import Login from './pages/Login/Login'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold text-wedding-red">💒 婚嫁管家</h1>
          <p className="text-gray-600 mt-4">正在开发中...</p>
        </div>
      } />
    </Routes>
  )
}

export default App
