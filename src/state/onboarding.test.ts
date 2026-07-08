import { describe, it, expect, beforeEach, vi } from 'vitest';

// onboarding.ts derives its localStorage key from the active journal id. Mock
// the journals module so we can drive that id directly without the tauri stack.
const journalState = vi.hoisted(() => ({ activeId: null as string | null }));
vi.mock('./journals', () => ({
  activeJournalId: () => journalState.activeId,
}));

import {
  onboardingMode,
  onboardingStep,
  startOnboarding,
  showOnboardingIfFirstRun,
  nextStep,
  prevStep,
  minimizeOnboarding,
  expandOnboarding,
  dismissOnboarding,
  replayOnboarding,
} from './onboarding';

describe('state/onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    journalState.activeId = null;
  });

  it('startOnboarding opens the tour at step 0', () => {
    startOnboarding();
    expect(onboardingMode()).toBe('tour');
    expect(onboardingStep()).toBe(0);
  });

  it('showOnboardingIfFirstRun starts the tour when the shown flag is unset', () => {
    minimizeOnboarding();
    showOnboardingIfFirstRun();
    expect(onboardingMode()).toBe('tour');
  });

  it('showOnboardingIfFirstRun does nothing when already shown', () => {
    localStorage.setItem('onboarding-shown', 'true');
    minimizeOnboarding();
    showOnboardingIfFirstRun();
    expect(onboardingMode()).toBe('minimized');
  });

  it('nextStep advances until the last step, then dismisses and records the flag', () => {
    startOnboarding();
    nextStep(3);
    expect(onboardingStep()).toBe(1);
    nextStep(3);
    expect(onboardingStep()).toBe(2);
    nextStep(3); // already at total - 1 → dismiss
    expect(onboardingMode()).toBe('dismissed');
    expect(localStorage.getItem('onboarding-shown')).toBe('true');
  });

  it('prevStep decrements and floors at 0', () => {
    startOnboarding();
    nextStep(3);
    nextStep(3);
    expect(onboardingStep()).toBe(2);
    prevStep();
    expect(onboardingStep()).toBe(1);
    prevStep();
    prevStep();
    expect(onboardingStep()).toBe(0);
  });

  it('minimizeOnboarding moves to the minimized mode', () => {
    startOnboarding();
    minimizeOnboarding();
    expect(onboardingMode()).toBe('minimized');
  });

  it('expandOnboarding restarts the tour at step 0', () => {
    startOnboarding();
    nextStep(5);
    minimizeOnboarding();
    expandOnboarding();
    expect(onboardingMode()).toBe('tour');
    expect(onboardingStep()).toBe(0);
  });

  it('dismissOnboarding records the shown flag and dismisses', () => {
    startOnboarding();
    dismissOnboarding();
    expect(onboardingMode()).toBe('dismissed');
    expect(localStorage.getItem('onboarding-shown')).toBe('true');
  });

  it('replayOnboarding clears the shown flag and restarts the tour', () => {
    localStorage.setItem('onboarding-shown', 'true');
    replayOnboarding();
    expect(localStorage.getItem('onboarding-shown')).toBeNull();
    expect(onboardingMode()).toBe('tour');
    expect(onboardingStep()).toBe(0);
  });

  it('scopes the shown flag per journal id', () => {
    journalState.activeId = 'abc';
    dismissOnboarding();
    expect(localStorage.getItem('onboarding-shown-abc')).toBe('true');
    expect(localStorage.getItem('onboarding-shown')).toBeNull();

    // Switching to a different journal is treated as a fresh first run.
    journalState.activeId = 'xyz';
    minimizeOnboarding();
    showOnboardingIfFirstRun();
    expect(onboardingMode()).toBe('tour');
  });
});
