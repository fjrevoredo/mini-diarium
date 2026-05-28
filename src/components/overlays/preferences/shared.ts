import type { Accessor } from 'solid-js';

export type Tab = 'general' | 'writing' | 'security' | 'data' | 'advanced';

export interface TabProps {
  isOpen: Accessor<boolean>;
  onClose: () => void;
}
