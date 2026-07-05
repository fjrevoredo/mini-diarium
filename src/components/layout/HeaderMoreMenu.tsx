import { DropdownMenu } from '@kobalte/core/dropdown-menu';
import { EllipsisVertical, Settings } from 'lucide-solid';
import { setIsPreferencesOpen, isMoreMenuOpen, setIsMoreMenuOpen } from '../../state/ui';
import { useI18n } from '../../i18n';

export default function HeaderMoreMenu() {
  const t = useI18n();
  return (
    <DropdownMenu open={isMoreMenuOpen()} onOpenChange={setIsMoreMenuOpen}>
      <DropdownMenu.Trigger
        data-testid="header-more-menu-trigger"
        class="rounded p-2 hover:bg-hover text-tertiary transition-colors"
        aria-label={t('layout.header.moreOptions')}
      >
        <EllipsisVertical size={20} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          data-testid="header-more-menu-content"
          class="min-w-[10rem] rounded-lg bg-primary p-1 data-[expanded]:animate-in data-[closed]:animate-out data-[closed]:fade-out-0 data-[expanded]:fade-in-0 data-[closed]:zoom-out-95 data-[expanded]:zoom-in-95"
          style={{ 'box-shadow': 'var(--shadow-lg)' }}
        >
          <DropdownMenu.Item
            data-testid="header-more-menu-preferences-item"
            class="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-primary hover:bg-hover cursor-pointer outline-none"
            onSelect={() => setIsPreferencesOpen(true)}
          >
            <Settings size={16} />
            {t('prefs.title')}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  );
}
