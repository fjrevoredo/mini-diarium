import { Match, Switch, onMount } from 'solid-js';
import { authState, initializeAuth } from './state/auth';
import PasswordCreation from './components/auth/PasswordCreation';
import PasswordPrompt from './components/auth/PasswordPrompt';
import MainLayout from './components/layout/MainLayout';

function App() {
  onMount(() => {
    initializeAuth();
  });

  return (
    <Switch>
      <Match when={authState() === 'checking'}>
        <div class="flex min-h-screen items-center justify-center bg-gray-50">
          <div class="text-center">
            <div class="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto" />
            <p class="text-gray-600">Loading...</p>
          </div>
        </div>
      </Match>

      <Match when={authState() === 'no-diary'}>
        <PasswordCreation />
      </Match>

      <Match when={authState() === 'locked'}>
        <PasswordPrompt />
      </Match>

      <Match when={authState() === 'unlocked'}>
        <MainLayout />
      </Match>
    </Switch>
  );
}

export default App;
