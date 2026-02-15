/* @refresh reload */
import { render } from 'solid-js/web';
import 'virtual:uno.css';
import './index.css';
import './styles/editor.css';
import App from './App';

const root = document.getElementById('root') as HTMLElement;

// Render the app
render(() => <App />, root);

// Remove loading screen and show app once rendered
requestAnimationFrame(() => {
  const loadingScreen = document.getElementById('app-loading');
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    loadingScreen.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => {
      loadingScreen.remove();
      root.classList.add('loaded');
    }, 300);
  } else {
    root.classList.add('loaded');
  }
});
