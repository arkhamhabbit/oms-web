import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { readConfig } from '@/lib/runtime-config'

const root = createRoot(document.getElementById('root')!)
const config = readConfig()

if (config.ok) {
  // Imported only now so the API client is never built from an unusable address.
  void import('./App.tsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    )
  })
} else {
  void import('./ConfigErrorPage.tsx').then(({ default: ConfigErrorPage }) => {
    root.render(<ConfigErrorPage message={config.message} />)
  })
}
