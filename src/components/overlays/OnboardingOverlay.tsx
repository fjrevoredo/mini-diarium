import { createSignal, createEffect, createMemo, onMount, onCleanup, Show, batch } from 'solid-js';
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
  targetSelector: string | null;
}

interface CardPosition {
  top: number;
  left: number;
  arrowSide: ArrowSide;
  arrowPercent: number;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const CARD_W = 320;
const CARD_H = 210;
const GAP = 14;
const PADDING = 10;
const SPOTLIGHT_PAD = 6;

function clampPercent(p: number) {
  return Math.max(0.12, Math.min(0.88, p));
}

function computePositions(rect: DOMRect): { card: CardPosition; spotlight: SpotlightRect } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  const spotlight: SpotlightRect = {
    top: rect.top - SPOTLIGHT_PAD,
    left: rect.left - SPOTLIGHT_PAD,
    width: rect.width + SPOTLIGHT_PAD * 2,
    height: rect.height + SPOTLIGHT_PAD * 2,
  };

  const clampLeft = (x: number) => Math.max(PADDING, Math.min(vw - CARD_W - PADDING, x));
  const clampTop = (y: number) => Math.max(PADDING, Math.min(vh - CARD_H - PADDING, y));

  // Try below
  if (rect.bottom + GAP + CARD_H <= vh - PADDING) {
    const left = clampLeft(cx - CARD_W / 2);
    return {
      spotlight,
      card: {
        top: rect.bottom + GAP,
        left,
        arrowSide: 'top',
        arrowPercent: clampPercent((cx - left) / CARD_W),
      },
    };
  }
  // Try above
  if (rect.top - GAP - CARD_H >= PADDING) {
    const left = clampLeft(cx - CARD_W / 2);
    const top = rect.top - GAP - CARD_H;
    return {
      spotlight,
      card: { top, left, arrowSide: 'bottom', arrowPercent: clampPercent((cx - left) / CARD_W) },
    };
  }
  // Try right
  if (rect.right + GAP + CARD_W <= vw - PADDING) {
    const top = clampTop(cy - CARD_H / 2);
    return {
      spotlight,
      card: {
        top,
        left: rect.right + GAP,
        arrowSide: 'left',
        arrowPercent: clampPercent((cy - top) / CARD_H),
      },
    };
  }
  // Fallback: left
  const top = clampTop(cy - CARD_H / 2);
  const left = Math.max(PADDING, rect.left - GAP - CARD_W);
  return {
    spotlight,
    card: { top, left, arrowSide: 'right', arrowPercent: clampPercent((cy - top) / CARD_H) },
  };
}

function centeredPosition(): CardPosition {
  return {
    top: window.innerHeight / 2 - CARD_H / 2,
    left: window.innerWidth / 2 - CARD_W / 2,
    arrowSide: 'top',
    arrowPercent: 0.5,
  };
}

export default function OnboardingTour() {
  const t = useI18n();
  const [popoverOpen, setPopoverOpen] = createSignal(false);
  const [cardPos, setCardPos] = createSignal<CardPosition>(centeredPosition());
  const [spotlightRect, setSpotlightRect] = createSignal<SpotlightRect | null>(null);

  // Plain const — keys are static strings; translation happens at render via t()
  const steps: StepDef[] = [
    {
      titleKey: 'onboarding.tip_toolbar_title',
      bodyKey: 'onboarding.tip_toolbar_body',
      actionKey: 'onboarding.tip_toolbar_action',
      onAction: () => setIsPreferencesOpen(true),
      targetSelector: '[data-tour-target="toolbar"]',
    },
    {
      titleKey: 'onboarding.tip_import_title',
      bodyKey: 'onboarding.tip_import_body',
      actionKey: 'onboarding.tip_import_action',
      onAction: () => setIsImportOpen(true),
      // The "⋮" overflow-menu trigger, which owns Import since the native menu was
      // reduced to Preferences + Quit (TODO-0065). It always renders, so no fallback
      // hint is needed for a native menu bar that no longer holds this action.
      targetSelector: '[data-tour-target="import"]',
    },
    {
      titleKey: 'onboarding.tip_docs_title',
      bodyKey: 'onboarding.tip_docs_body',
      actionKey: 'onboarding.tip_docs_action',
      onAction: () => openUrl('https://mini-diarium.com/docs/'),
      targetSelector: '[data-tour-target="about"]',
    },
  ];

  const total = steps.length;
  const step = () => steps[onboardingStep()];
  const isLast = () => onboardingStep() === total - 1;

  const measure = () => {
    const stepDef = steps[onboardingStep()];

    // DOM element target
    if (stepDef.targetSelector) {
      const el = document.querySelector(stepDef.targetSelector);
      if (el) {
        const { card, spotlight } = computePositions(el.getBoundingClientRect());
        batch(() => {
          setCardPos(card);
          setSpotlightRect(spotlight);
        });
        return;
      }
    }

    // No target at all — center the card
    batch(() => {
      setSpotlightRect(null);
      setCardPos(centeredPosition());
    });
  };

  createEffect(() => {
    if (onboardingMode() !== 'tour') return;
    void onboardingStep(); // track reactive dep
    const id = requestAnimationFrame(measure);
    onCleanup(() => cancelAnimationFrame(id));
  });

  onMount(() => {
    window.addEventListener('resize', measure);
    onCleanup(() => window.removeEventListener('resize', measure));
  });

  return (
    <>
      {/* Tour overlay */}
      <Show when={onboardingMode() === 'tour'}>
        {/* Spotlight: box-shadow creates the dark overlay with a transparent hole over the target */}
        <Show
          when={spotlightRect() !== null}
          fallback={
            <div
              class="fixed inset-0 z-50 pointer-events-none"
              style={{ 'background-color': 'var(--tour-overlay-bg)' }}
            />
          }
        >
          <div
            class="fixed z-50 pointer-events-none"
            style={{
              top: `${spotlightRect()!.top}px`,
              left: `${spotlightRect()!.left}px`,
              width: `${spotlightRect()!.width}px`,
              height: `${spotlightRect()!.height}px`,
              'box-shadow': '0 0 0 9999px var(--tour-overlay-bg)',
              outline: '2px solid rgba(255,255,255,0.18)',
              'border-radius': '4px',
            }}
          />
        </Show>

        {/* Card — positioned via inline top/left */}
        <div
          class="fixed z-50 w-80 rounded-lg bg-primary p-5"
          style={{
            top: `${cardPos().top}px`,
            left: `${cardPos().left}px`,
            'box-shadow': 'var(--shadow-lg)',
          }}
        >
          <Show when={spotlightRect() !== null}>
            <Arrow side={cardPos().arrowSide} percent={cardPos().arrowPercent} />
          </Show>
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
              data-testid="onboarding-next-btn"
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

function Arrow(props: { side: ArrowSide; percent: number }) {
  const pos = createMemo(() => {
    const pct = `${props.percent * 100}%`;
    const map: Record<ArrowSide, Record<string, string>> = {
      top: { top: '-7px', left: pct, transform: 'translateX(-50%) rotate(45deg)' },
      bottom: { bottom: '-7px', left: pct, transform: 'translateX(-50%) rotate(45deg)' },
      left: { left: '-7px', top: pct, transform: 'translateY(-50%) rotate(45deg)' },
      right: { right: '-7px', top: pct, transform: 'translateY(-50%) rotate(45deg)' },
    };
    return map[props.side];
  });
  return <div class="absolute w-4 h-4 bg-primary rounded-sm" style={pos()} />;
}
