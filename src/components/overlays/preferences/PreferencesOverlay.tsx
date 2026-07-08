import { createSignal, createEffect, Show } from 'solid-js';
import { Dialog } from '@kobalte/core/dialog';
import { X } from 'lucide-solid';
import { authState } from '../../../state/auth';
import { useI18n } from '../../../i18n';
import type { Tab } from './shared';
import PreferencesGeneralTab from './PreferencesGeneralTab';
import PreferencesWritingTab from './PreferencesWritingTab';
import PreferencesSecurityTab from './PreferencesSecurityTab';
import PreferencesDataTab from './PreferencesDataTab';
import PreferencesAdvancedTab from './PreferencesAdvancedTab';

interface PreferencesOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PreferencesOverlay(props: PreferencesOverlayProps) {
  const t = useI18n();
  const [activeTab, setActiveTab] = createSignal<Tab>('general');

  // Reactive accessor passed to child tabs via TabProps.isOpen so their
  // createEffect re-runs on overlay re-open without a mirror signal.
  const isOpenAccessor = () => props.isOpen;

  // Reset to General whenever the dialog opens.
  createEffect(() => {
    if (props.isOpen) setActiveTab('general');
  });

  const isUnlocked = () => authState() === 'unlocked';

  // Force-select an allowed tab when the journal transitions to locked while open.
  createEffect(() => {
    if (
      !isUnlocked() &&
      (activeTab() === 'writing' || activeTab() === 'security' || activeTab() === 'advanced')
    ) {
      setActiveTab('general');
    }
  });

  const handleOpenChange = (open: boolean) => {
    if (!open) props.onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') props.onClose();
  };

  const tabClass = (tab: Tab) =>
    activeTab() === tab
      ? 'w-full text-left px-3 py-2 text-sm font-medium rounded-md bg-active text-primary'
      : 'w-full text-left px-3 py-2 text-sm font-medium rounded-md text-secondary hover:bg-hover hover:text-primary';

  // Vertical tablist keyboard nav (ArrowUp/Down per ARIA vertical orientation)
  const handleTabListKeyDown = (e: KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const tabs: Tab[] = [
      'general',
      ...(isUnlocked() ? (['writing', 'security'] as Tab[]) : []),
      'data',
      ...(isUnlocked() ? (['advanced'] as Tab[]) : []),
    ];
    const currentIndex = tabs.indexOf(activeTab());
    let nextIndex = currentIndex;
    if (e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
    if (e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') nextIndex = 0;
    if (e.key === 'End') nextIndex = tabs.length - 1;
    setActiveTab(tabs[nextIndex]);
    requestAnimationFrame(() => {
      const btn = document.querySelector<HTMLButtonElement>(`#pref-tab-${tabs[nextIndex]}`);
      btn?.focus();
    });
  };

  return (
    <Dialog open={props.isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          class="fixed inset-0 z-50"
          style={{ 'background-color': 'var(--overlay-bg)' }}
        />
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            data-testid="preferences-overlay"
            class="relative w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl rounded-lg bg-primary p-8 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
            style={{ 'box-shadow': 'var(--shadow-lg)' }}
            onKeyDown={handleKeyDown}
          >
            <Dialog.Title class="text-lg font-semibold text-primary mb-6">
              {t('prefs.title')}
            </Dialog.Title>
            <Dialog.Description class="sr-only">{t('prefs.srDescription')}</Dialog.Description>
            {/* Main content: sidebar tabs + pane */}
            <div class="flex flex-row min-h-0 pb-6">
              {/* Tab sidebar */}
              <nav
                role="tablist"
                aria-label={t('prefs.sectionsAria')}
                aria-orientation="vertical"
                class="w-36 shrink-0 border-r border-primary pr-2 space-y-1"
                onKeyDown={handleTabListKeyDown}
              >
                <button
                  id="pref-tab-general"
                  type="button"
                  role="tab"
                  aria-selected={activeTab() === 'general'}
                  aria-controls="pref-panel-general"
                  tabIndex={activeTab() === 'general' ? 0 : -1}
                  onClick={() => setActiveTab('general')}
                  class={tabClass('general')}
                >
                  {t('prefs.tabGeneral')}
                </button>

                <Show
                  when={isUnlocked()}
                  fallback={
                    <button
                      id="pref-tab-writing"
                      type="button"
                      role="tab"
                      disabled
                      aria-selected={false}
                      aria-controls="pref-panel-writing"
                      tabIndex={-1}
                      class="w-full text-left px-3 py-2 text-sm font-medium rounded-md text-tertiary cursor-not-allowed select-none opacity-50"
                    >
                      {t('prefs.tabWriting')}
                    </button>
                  }
                >
                  <button
                    id="pref-tab-writing"
                    type="button"
                    role="tab"
                    aria-selected={activeTab() === 'writing'}
                    aria-controls="pref-panel-writing"
                    tabIndex={activeTab() === 'writing' ? 0 : -1}
                    onClick={() => setActiveTab('writing')}
                    class={tabClass('writing')}
                  >
                    {t('prefs.tabWriting')}
                  </button>
                </Show>

                <Show
                  when={isUnlocked()}
                  fallback={
                    <button
                      id="pref-tab-security"
                      type="button"
                      role="tab"
                      disabled
                      aria-selected={false}
                      aria-controls="pref-panel-security"
                      tabIndex={-1}
                      class="w-full text-left px-3 py-2 text-sm font-medium rounded-md text-tertiary cursor-not-allowed select-none opacity-50"
                    >
                      {t('prefs.tabSecurity')}
                    </button>
                  }
                >
                  <button
                    id="pref-tab-security"
                    type="button"
                    role="tab"
                    aria-selected={activeTab() === 'security'}
                    aria-controls="pref-panel-security"
                    tabIndex={activeTab() === 'security' ? 0 : -1}
                    onClick={() => setActiveTab('security')}
                    class={tabClass('security')}
                  >
                    {t('prefs.tabSecurity')}
                  </button>
                </Show>

                <button
                  id="pref-tab-data"
                  type="button"
                  role="tab"
                  aria-selected={activeTab() === 'data'}
                  aria-controls="pref-panel-data"
                  tabIndex={activeTab() === 'data' ? 0 : -1}
                  onClick={() => setActiveTab('data')}
                  class={tabClass('data')}
                >
                  {t('prefs.tabData')}
                </button>

                <Show when={isUnlocked()}>
                  <button
                    id="pref-tab-advanced"
                    type="button"
                    role="tab"
                    aria-selected={activeTab() === 'advanced'}
                    aria-controls="pref-panel-advanced"
                    tabIndex={activeTab() === 'advanced' ? 0 : -1}
                    onClick={() => setActiveTab('advanced')}
                    class={tabClass('advanced')}
                  >
                    {t('prefs.tabAdvanced')}
                  </button>
                </Show>
              </nav>

              <div class="flex-1 overflow-y-auto max-h-[55vh] sm:max-h-[65vh] md:max-h-[70vh] lg:max-h-[75vh] px-6">
                <div hidden={activeTab() !== 'general'}>
                  <PreferencesGeneralTab isOpen={isOpenAccessor} onClose={props.onClose} />
                </div>
                <Show when={isUnlocked()}>
                  <div hidden={activeTab() !== 'writing'}>
                    <PreferencesWritingTab isOpen={isOpenAccessor} onClose={props.onClose} />
                  </div>
                  <div hidden={activeTab() !== 'security'}>
                    <PreferencesSecurityTab isOpen={isOpenAccessor} onClose={props.onClose} />
                  </div>
                </Show>
                <div hidden={activeTab() !== 'data'}>
                  <PreferencesDataTab isOpen={isOpenAccessor} onClose={props.onClose} />
                </div>
                <Show when={isUnlocked()}>
                  <div hidden={activeTab() !== 'advanced'}>
                    <PreferencesAdvancedTab isOpen={isOpenAccessor} onClose={props.onClose} />
                  </div>
                </Show>
              </div>
            </div>

            <Dialog.CloseButton class="absolute top-5 right-5 rounded-md p-1 text-tertiary hover:bg-hover hover:text-secondary focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors">
              <span class="sr-only">{t('common.close')}</span>
              <X size={20} />
            </Dialog.CloseButton>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog>
  );
}
