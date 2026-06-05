import { type JSX, type ParentProps } from 'solid-js';

interface FloatingTooltipProps extends ParentProps {
  x: number;
  y: number;
  /** Gap in px between anchor bottom and tooltip top. Default: 4 */
  offset?: number;
  class?: string;
}

export function FloatingTooltip(props: FloatingTooltipProps): JSX.Element {
  return (
    <div
      class={`fixed z-50 pointer-events-none rounded-md border border-primary bg-secondary shadow-sm px-2 py-1 text-xs ${props.class ?? ''}`}
      style={{ left: `${props.x}px`, top: `${props.y + (props.offset ?? 4)}px` }}
    >
      {props.children}
    </div>
  );
}
