import { describe, it, expect } from 'vitest';
import {
  BUG_REPORT_URL,
  FEATURE_REQUEST_URL,
  FEEDBACK_EMAIL,
  buildFeedbackMailto,
} from './feedback-links';

describe('feedback-links', () => {
  it('points the issue links at the repo issue templates', () => {
    expect(BUG_REPORT_URL).toBe(
      'https://github.com/fjrevoredo/mini-diarium/issues/new?template=bug_report.md',
    );
    expect(FEATURE_REQUEST_URL).toBe(
      'https://github.com/fjrevoredo/mini-diarium/issues/new?template=feature_request.md',
    );
  });

  it('builds a mailto link with the version in an encoded subject', () => {
    expect(buildFeedbackMailto('0.7.4')).toBe(
      `mailto:${FEEDBACK_EMAIL}?subject=Mini%20Diarium%20feedback%20(v0.7.4)`,
    );
  });

  it('omits the version when it is empty', () => {
    expect(buildFeedbackMailto('')).toBe(
      'mailto:minidiarium@gmail.com?subject=Mini%20Diarium%20feedback',
    );
  });
});
