import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'bootstrap/dist/css/bootstrap.min.css'
import App from './App.jsx'
import './index.css'
import { DeckCacheProvider } from './state/DeckCacheContext.jsx'
import { PlayerTagProvider } from './state/PlayerTagContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter basename="/p58/">
      <PlayerTagProvider>
        <DeckCacheProvider>
          <App />
        </DeckCacheProvider>
      </PlayerTagProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

