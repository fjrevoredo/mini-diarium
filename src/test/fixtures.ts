import type { Tag, DiaryEntry, TimelineEntry } from '../lib/tauri';

/**
 * Shared test-data factories. Each returns a fresh, valid object with sensible
 * defaults; pass `overrides` to customise the fields a given test cares about.
 * Keeping the required-field shape in one place means adding a field to the
 * underlying interface fails only here, not across a dozen inlined literals.
 */

export function makeTag(overrides: Partial<Tag> = {}): Tag {
  return {
    id: 1,
    name: 'work',
    created_at: '2024-01-15T00:00:00Z',
    ...overrides,
  };
}

export function makeEntry(overrides: Partial<DiaryEntry> = {}): DiaryEntry {
  return {
    id: 1,
    date: '2024-01-15',
    title: '',
    text: '',
    word_count: 0,
    date_created: '2024-01-15T00:00:00Z',
    date_updated: '2024-01-15T00:00:00Z',
    locked: false,
    ...overrides,
  };
}

export function makeTimelineEntry(overrides: Partial<TimelineEntry> = {}): TimelineEntry {
  return {
    id: 1,
    date: '2024-01-15',
    title: 'Entry title',
    preview: 'A short preview',
    locked: false,
    ...overrides,
  };
}
