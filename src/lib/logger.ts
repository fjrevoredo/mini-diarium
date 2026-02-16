interface Logger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;
  return {
    error: (...args: unknown[]) => console.error(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    info: (...args: unknown[]) => console.info(prefix, ...args),
    debug: import.meta.env.DEV ? (...args: unknown[]) => console.debug(prefix, ...args) : () => {},
  };
}
