import { Accessor, Setter } from 'solid-js';
import {
  navigatePreviousDay,
  navigateNextDay,
  navigateToToday,
  navigatePreviousMonth,
  navigateNextMonth,
} from './tauri';
import { setIsGoToDateOpen } from '../state/ui';
import { preferences } from '../state/preferences';
import { getTodayString } from './dates';

/**
 * Detect if we're on macOS
 */
function isMac(): boolean {
  return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
}

/**
 * Check if an element is an input-like element where we shouldn't capture shortcuts
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;
  const tagName = element.tagName.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    element.getAttribute('contenteditable') === 'true'
  );
}

/**
 * Set up global keyboard shortcuts for navigation
 * Returns a cleanup function to remove the event listener
 */
export function setupNavigationShortcuts(
  selectedDate: Accessor<string>,
  setSelectedDate: Setter<string>,
): () => void {
  const handleKeyDown = async (e: KeyboardEvent) => {
    // Don't capture shortcuts when typing in an input field
    if (isInputElement(e.target as Element)) {
      return;
    }

    const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey;

    // Ctrl/Cmd + Left: Previous Day
    if (cmdOrCtrl && e.key === 'ArrowLeft' && !e.shiftKey) {
      e.preventDefault();
      try {
        const newDate = await navigatePreviousDay(selectedDate());
        setSelectedDate(newDate);
      } catch (error) {
        console.error('Failed to navigate to previous day:', error);
      }
    }
    // Ctrl/Cmd + Right: Next Day
    else if (cmdOrCtrl && e.key === 'ArrowRight' && !e.shiftKey) {
      e.preventDefault();
      try {
        const newDate = await navigateNextDay(selectedDate());
        // Clamp to today if future entries are not allowed
        const today = getTodayString();
        const finalDate = !preferences().allowFutureEntries && newDate > today ? today : newDate;
        setSelectedDate(finalDate);
      } catch (error) {
        console.error('Failed to navigate to next day:', error);
      }
    }
    // Ctrl/Cmd + T: Go to Today
    else if (cmdOrCtrl && e.key === 't' && !e.shiftKey) {
      e.preventDefault();
      try {
        const newDate = await navigateToToday();
        setSelectedDate(newDate);
      } catch (error) {
        console.error('Failed to navigate to today:', error);
      }
    }
    // Ctrl/Cmd + G: Open Go to Date overlay
    else if (cmdOrCtrl && e.key === 'g' && !e.shiftKey) {
      e.preventDefault();
      setIsGoToDateOpen(true);
    }
    // Ctrl/Cmd + Shift + Left: Previous Month
    else if (cmdOrCtrl && e.shiftKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      try {
        const newDate = await navigatePreviousMonth(selectedDate());
        setSelectedDate(newDate);
      } catch (error) {
        console.error('Failed to navigate to previous month:', error);
      }
    }
    // Ctrl/Cmd + Shift + Right: Next Month
    else if (cmdOrCtrl && e.shiftKey && e.key === 'ArrowRight') {
      e.preventDefault();
      try {
        const newDate = await navigateNextMonth(selectedDate());
        // Clamp to today if future entries are not allowed
        const today = getTodayString();
        const finalDate = !preferences().allowFutureEntries && newDate > today ? today : newDate;
        setSelectedDate(finalDate);
      } catch (error) {
        console.error('Failed to navigate to next month:', error);
      }
    }
  };

  // Add event listener
  window.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
