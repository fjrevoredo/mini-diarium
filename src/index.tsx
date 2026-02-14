/* @refresh reload */
import { render } from 'solid-js/web';
import 'virtual:uno.css';
import './index.css';
import './styles/editor.css';
import App from './App';

render(() => <App />, document.getElementById('root') as HTMLElement);
