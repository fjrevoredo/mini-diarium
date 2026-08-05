import BackupsPanel from '../../backups/BackupsPanel';
import { useI18n } from '../../../i18n';
import type { TabProps } from './shared';

/**
 * Preferences → Backups.
 *
 * A tabpanel shell around the shared {@link BackupsPanel}; the panel itself is also mounted
 * pre-auth from the unlock screen, which is why the logic does not live here.
 */
export default function PreferencesBackupsTab(props: TabProps) {
  const t = useI18n();

  return (
    <div
      id="pref-panel-backups"
      role="tabpanel"
      aria-labelledby="pref-tab-backups"
      tabIndex={0}
      class="space-y-6 focus:outline-none"
    >
      <h3 class="text-sm font-medium text-primary">{t('prefs.backups.title')}</h3>
      <BackupsPanel isVisible={props.isOpen} />
    </div>
  );
}
