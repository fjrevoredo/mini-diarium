/// <reference types="vite/client" />

interface Navigator {
  readonly userAgentData?: {
    readonly platform?: string;
  };
}
