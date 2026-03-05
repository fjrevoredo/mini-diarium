import { Show, createMemo } from 'solid-js';

export function PasswordStrengthIndicator(props: { password: string }) {
  const strength = createMemo(() => {
    if (props.password.length === 0) {
      return { level: 'none', label: '', color: 'text-tertiary', warning: false };
    }

    let score = Math.min(props.password.length, 12) / 2; // 0-6 points from length

    // Character type bonuses
    const hasLower = /[a-z]/.test(props.password);
    const hasUpper = /[A-Z]/.test(props.password);
    const hasNumber = /[0-9]/.test(props.password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(props.password);

    const typeCount = [hasLower, hasUpper, hasNumber, hasSpecial].filter(Boolean).length;
    score += typeCount;

    // Clamp to 0-10
    score = Math.min(10, score);

    // Determine level
    if (score <= 2) {
      return {
        level: 'very-weak',
        label: 'Very weak - prefer a longer, more complex password',
        color: 'text-error',
        warning: true,
      };
    } else if (score <= 5) {
      return {
        level: 'weak',
        label: 'Weak - consider adding complexity',
        color: 'text-warning',
        warning: false,
      };
    } else if (score <= 8) {
      return {
        level: 'medium',
        label: 'Medium - good balance',
        color: 'text-info',
        warning: false,
      };
    } else {
      return {
        level: 'strong',
        label: 'Strong - excellent',
        color: 'text-success',
        warning: false,
      };
    }
  });

  return (
    <Show when={props.password.length > 0}>
      <div class="mt-2 text-xs">
        <span class={strength().color}>● {strength().label}</span>
        <Show when={strength().warning}>
          <div class="mt-2 rounded-md bg-warning p-3 text-sm text-warning">
            We strongly recommend using a stronger password (12+ characters with a mix of letters,
            numbers, and symbols).
          </div>
        </Show>
      </div>
    </Show>
  );
}
