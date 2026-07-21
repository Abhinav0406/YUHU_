import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Force dark mode globally
if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark');
}

// If a lazy-loaded chunk is missing (stale deploy/cache), reload for fresh assets.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
