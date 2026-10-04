import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { renderWithI18n } from '../../test/i18n-test-utils';

const { mockOpenUrlSuppressingFocusLoss, mockGetVersion } = vi.hoisted(() => ({
  mockOpenUrlSuppressingFocusLoss: vi.fn(),
  mockGetVersion: vi.fn(() => Promise.resolve('9.8.7')),
}));
vi.mock('../../lib/dialog', () => ({
  openUrlSuppressingFocusLoss: mockOpenUrlSuppressingFocusLoss,
}));
vi.mock('@tauri-apps/api/app', () => ({
  getVersion: mockGetVersion,
}));

import FeedbackOverlay from './FeedbackOverlay';

describe('FeedbackOverlay', () => {
  afterEach(() => {
    mockOpenUrlSuppressingFocusLoss.mockClear();
    mockGetVersion.mockClear();
  });

  it.each([
    [
      'feedback-bug',
      'https://github.com/fjrevoredo/mini-diarium/issues/new?template=bug_report.md',
    ],
    [
      'feedback-feature',
      'https://github.com/fjrevoredo/mini-diarium/issues/new?template=feature_request.md',
    ],
    ['feedback-email', 'mailto:minidiarium@gmail.com?subject=Mini%20Diarium%20feedback%20(v9.8.7)'],
  ] as const)('clicking %s opens %s via openUrlSuppressingFocusLoss', async (testId, url) => {
    renderWithI18n(() => <FeedbackOverlay isOpen={true} onClose={vi.fn()} />);
    // The email subject depends on the version, so wait until it has resolved.
    await waitFor(() => expect(mockGetVersion).toHaveBeenCalled());
    await Promise.resolve();

    fireEvent.click(screen.getByTestId(testId));

    expect(mockOpenUrlSuppressingFocusLoss).toHaveBeenCalledTimes(1);
    expect(mockOpenUrlSuppressingFocusLoss).toHaveBeenCalledWith(url);
  });

  it('the footer Close button calls onClose', () => {
    const onClose = vi.fn();
    renderWithI18n(() => <FeedbackOverlay isOpen={true} onClose={onClose} />);

    // The footer button; the title-row X shares the accessible name.
    fireEvent.click(screen.getByText('Close'));

    expect(onClose).toHaveBeenCalled();
  });
});
