// Feedback channels shown in the Feedback dialog. Each one only hands a URL to the
// OS (browser or mail client); nothing is sent from the app itself.

const REPO_URL = 'https://github.com/fjrevoredo/mini-diarium';

export const BUG_REPORT_URL = `${REPO_URL}/issues/new?template=bug_report.md`;
export const FEATURE_REQUEST_URL = `${REPO_URL}/issues/new?template=feature_request.md`;
export const FEEDBACK_EMAIL = 'minidiarium@gmail.com';

/**
 * Builds a `mailto:` link with a prefilled subject. Only the app version is
 * included — no OS details and no journal data.
 */
export function buildFeedbackMailto(version: string): string {
  const subject = version ? `Mini Diarium feedback (v${version})` : 'Mini Diarium feedback';
  return `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
