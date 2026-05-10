import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '@Core/Services/AuthService';
import App from './App.jsx';
import './globals.css';

// ─── Application entry ──────────────────────────────────────────────────────
// Mounts the React tree under #root. Wraps in StrictMode for double-render
// safety checks during development and AuthProvider so every component can
// `useAuth()` without prop drilling.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
