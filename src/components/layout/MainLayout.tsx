import { createSignal } from 'solid-js';
import Header from './Header';
import Sidebar from './Sidebar';
import EditorPanel from './EditorPanel';

export default function MainLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = createSignal(true);

  return (
    <div class="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <Sidebar isCollapsed={isSidebarCollapsed()} onClose={() => setIsSidebarCollapsed(true)} />

      {/* Main content area */}
      <div class="flex flex-1 flex-col">
        {/* Header */}
        <Header showMenu onMenuClick={() => setIsSidebarCollapsed(!isSidebarCollapsed())} />

        {/* Editor panel */}
        <main class="flex-1 overflow-hidden">
          <EditorPanel />
        </main>
      </div>
    </div>
  );
}
