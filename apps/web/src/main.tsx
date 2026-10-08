import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import './design/tokens.css';
import './design/base.css';
import './design/motion.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { preloadParts, preloadRoute } from './app/lazyParts';
import { onFirstPress } from './lib/onFirstPress';
import { parseRoute } from './navigation';
import './pwa/register';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

preloadRoute(parseRoute(window.location.pathname));
onFirstPress(() => void preloadParts());

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
