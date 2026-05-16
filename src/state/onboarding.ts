import { createSignal } from 'solid-js';
import { activeJournalId } from './journals';

const storageKey = () => {
  const id = activeJournalId();
  return id ? `onboarding-shown-${id}` : 'onboarding-shown';
};

export type OnboardingMode = 'tour' | 'minimized' | 'dismissed';

const [onboardingMode, setOnboardingMode] = createSignal<OnboardingMode>('dismissed');
const [onboardingStep, setOnboardingStep] = createSignal(0);

export function startOnboarding(): void {
  setOnboardingStep(0);
  setOnboardingMode('tour');
}

export function showOnboardingIfFirstRun(): void {
  if (localStorage.getItem(storageKey()) !== 'true') {
    startOnboarding();
  }
}

export function nextStep(total: number): void {
  if (onboardingStep() < total - 1) setOnboardingStep((s) => s + 1);
  else dismissOnboarding();
}

export function prevStep(): void {
  setOnboardingStep((s) => Math.max(0, s - 1));
}

export function minimizeOnboarding(): void {
  setOnboardingMode('minimized');
}

export function expandOnboarding(): void {
  setOnboardingStep(0);
  setOnboardingMode('tour');
}

export function dismissOnboarding(): void {
  localStorage.setItem(storageKey(), 'true');
  setOnboardingMode('dismissed');
}

export function replayOnboarding(): void {
  localStorage.removeItem(storageKey());
  setOnboardingStep(0);
  setOnboardingMode('tour');
}

export { onboardingMode, onboardingStep };
