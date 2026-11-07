import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// SUPABASE: import { CloudAuthProvider } from './context/CloudAuthProvider'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* SUPABASE: wrap with <CloudAuthProvider> when sync is enabled (see src/lib/cloud/cloudConfig.ts) */}
    <App />
  </React.StrictMode>,
)
