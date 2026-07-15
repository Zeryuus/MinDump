import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import CapturePage from './pages/CapturePage'
import FluxPage from './pages/FluxPage'
import { replanAllReminders } from './services/reminderScheduler'

export default function App() {
  useEffect(() => {
    void replanAllReminders()
  }, [])

  return (
    <BrowserRouter>
      <div className="app-shell">
        <Routes>
          <Route path="/" element={<CapturePage />} />
          <Route path="/flux" element={<FluxPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
