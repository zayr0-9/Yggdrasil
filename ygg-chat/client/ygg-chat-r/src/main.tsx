// import { StrictMode } from 'react'
// import { createRoot } from 'react-dom/client'
// import './index.css'
// import App from './App.tsx'

// createRoot(document.getElementById('root')!).render(
//   <StrictMode>
//     <App />
//   </StrictMode>
// )

// main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import App from './App'
import './index.css'
import { store } from './store/store'

// Global theme manager: keeps the `dark` class in sync with user preference and system theme
// Runs once per page load (guarded for HMR) so it applies across all routes
;(function initThemeManager() {
  if (typeof window === 'undefined') return
  const w = window as any
  if (w.__yggThemeInit) return
  w.__yggThemeInit = true

  const media = window.matchMedia('(prefers-color-scheme: dark)')

  const apply = () => {
    try {
      const pref = localStorage.getItem('theme') // 'light' | 'dark' | null (null => system)
      const isDark = pref === 'dark' || (pref !== 'light' && media.matches)
      document.documentElement.classList.toggle('dark', isDark)
    } catch {
      // If localStorage is blocked, fall back to system
      document.documentElement.classList.toggle('dark', media.matches)
    }
  }

  // Initial apply
  apply()

  // Update on system theme changes only when following system (no explicit preference)
  const onMediaChange = () => {
    try {
      if (!localStorage.getItem('theme')) apply()
    } catch {
      apply()
    }
  }
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', onMediaChange)
  } else if (typeof (media as any).addListener === 'function') {
    ;(media as any).addListener(onMediaChange)
  }

  // React to preference changes from other tabs/windows
  window.addEventListener('storage', e => {
    if (e.key === 'theme') apply()
  })
})()

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element not found')
}

const root = ReactDOM.createRoot(rootElement)

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
)
