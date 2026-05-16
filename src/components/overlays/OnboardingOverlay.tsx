import { createSignal, Show } from 'solid-js';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Minimize2, HelpCircle } from 'lucide-solid';
import { useI18n, type T } from '../../i18n';
import { setIsPreferencesOpen, setIsImportOpen } from '../../state/ui';
import {
  onboardingMode,
  onboardingStep,
  nextStep,
  prevStep,
  minimizeOnboarding,
  expandOnboarding,
  dismissOnboarding,
} from '../../state/onboarding';

type ArrowSide = 'left' | 'right' | 'top' | 'bottom';

type I18nKey = Parameters<T>[0];

interface StepDef {
  titleKey: I18nKey;
  bodyKey: I18nKey;
  actionKey: I18nKey;
  onAction: () => void;
  cardClass: string;
  arrowSide: ArrowSide;
}

export default function OnboardingTour() {
  const t = useI18n();
  const [popoverOpen, setPopoverOpen] = createSignal(false);

  // Plain const — keys are static strings; translation happens at render via t()
  const steps: StepDef[] = [
    {
      titleKey: 'onboarding.tip_toolbar_title',
      bodyKey: 'onboarding.tip_toolbar_body',
      actionKey: 'onboarding.tip_toolbar_action',
      onAction: () => setIsPreferencesOpen(true),
      cardClass: 'bottom-8 left-8',
      arrowSide: 'right',
    },
    {
      titleKey: 'onboarding.tip_import_title',
      bodyKey: 'onboarding.tip_import_body',
      actionKey: 'onboarding.tip_import_action',
      onAction: () => setIsImportOpen(true),
      cardClass: 'bottom-8 left-1/2 -translate-x-1/2',
      arrowSide: 'top',
    },
    {
      titleKey: 'onboarding.tip_docs_title',
      bodyKey: 'onboarding.tip_docs_body',
      actionKey: 'onboarding.tip_docs_action',
      onAction: () => openUrl('https://mini-diarium.com/docs/'),
      cardClass: 'bottom-8 right-20',
      arrowSide: 'top',
    },
  ];

  const total = steps.length;
  const step = () => steps[onboardingStep()];
  const isLast = () => onboardingStep() === total - 1;

  return (
    <>
      {/* Tour overlay */}
      <Show when={onboardingMode() === 'tour'}>
        <div class="fixed inset-0 z-50" style={{ 'background-color': 'rgba(0,0,0,0.45)' }} />
        <div
          class={`fixed z-50 w-80 rounded-lg bg-primary p-5 ${step().cardClass}`}
          style={{ 'box-shadow': 'var(--shadow-lg)' }}
        >
          <Arrow side={step().arrowSide} />
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-medium text-tertiary">
              {onboardingStep() + 1} / {total}
            </span>
            <button
              onClick={minimizeOnboarding}
              class="rounded p-1 hover:bg-hover transition-colors"
              aria-label={t('onboarding.minimize')}
            >
              <Minimize2 size={14} class="text-tertiary" />
            </button>
          </div>
          <p class="text-sm font-semibold text-primary mb-1">{t(step().titleKey)}</p>
          <p class="text-sm text-secondary mb-3">{t(step().bodyKey)}</p>
          <button
            onClick={() => step().onAction()}
            class="text-xs font-medium text-interactive hover:underline mb-4 block"
          >
            {t(step().actionKey)}
          </button>
          <div class="flex items-center justify-between">
            <button
              onClick={prevStep}
              disabled={onboardingStep() === 0}
              class="text-xs text-secondary hover:text-primary disabled:opacity-40 transition-colors"
            >
              {t('onboarding.back')}
            </button>
            <button
              onClick={() => nextStep(total)}
              class="rounded-md interactive-primary px-3 py-1.5 text-xs font-medium"
            >
              {isLast() ? t('onboarding.done') : t('onboarding.next')}
            </button>
          </div>
        </div>
      </Show>

      {/* Floating help icon (minimized state) */}
      <Show when={onboardingMode() === 'minimized'}>
        <div class="fixed bottom-4 right-4 z-50">
          <Show when={popoverOpen()}>
            <div
              class="absolute bottom-14 right-0 w-64 rounded-lg bg-primary p-4"
              style={{ 'box-shadow': 'var(--shadow-lg)' }}
            >
              <p class="text-sm font-semibold text-primary mb-1">{t('onboarding.title')}</p>
              <p class="text-xs text-secondary mb-3">{t('onboarding.popoverHint')}</p>
              <div class="flex gap-2">
                <button
                  onClick={() => {
                    setPopoverOpen(false);
                    expandOnboarding();
                  }}
                  class="flex-1 rounded text-xs font-medium py-1.5 bg-tertiary text-secondary hover:bg-hover transition-colors"
                >
                  {t('onboarding.resumeTour')}
                </button>
                <button
                  onClick={dismissOnboarding}
                  class="flex-1 rounded text-xs font-medium py-1.5 interactive-primary"
                >
                  {t('onboarding.dismiss')}
                </button>
              </div>
            </div>
          </Show>
          <button
            onClick={() => setPopoverOpen((p) => !p)}
            class="w-10 h-10 rounded-full interactive-primary flex items-center justify-center shadow-lg"
            aria-label={t('onboarding.helpAria')}
          >
            <HelpCircle size={20} />
          </button>
        </div>
      </Show>
    </>
  );
}

function Arrow(props: { side: ArrowSide }) {
  const positionStyles: Record<ArrowSide, Record<string, string>> = {
    right: { right: '-7px', top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
    left: { left: '-7px', top: '50%', transform: 'translateY(-50%) rotate(45deg)' },
    top: { top: '-7px', left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
    bottom: { bottom: '-7px', left: '50%', transform: 'translateX(-50%) rotate(45deg)' },
  };
  return <div class="absolute w-4 h-4 bg-primary rounded-sm" style={positionStyles[props.side]} />;
}
