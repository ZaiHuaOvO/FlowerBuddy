import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import './styles/pet.css'
import './styles/menu.css'
import './styles/bubble.css'
import './styles/settings.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('Root container is missing')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
