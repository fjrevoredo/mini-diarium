interface Logger {
  error: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export interface UiLogRecord {
  ts: string;
  level: 'info' | 'warn' | 'error';
  module: string;
  message: string;
}

/** Matches the backend ring buffer (`src-tauri/src/log_capture.rs`). */
const CAPACITY = 200;

/** Per-record message cap, so one huge argument cannot crowd out the rest of the buffer. */
const MAX_MESSAGE_LENGTH = 500;

/**
 * Recent UI log records, for the debug dump.
 *
 * The WebView console is invisible in a packaged build, so these records otherwise vanish.
 * `debug` is deliberately never captured — in production `createLogger` compiles it out
 * entirely, and it is the level where entry-shaped data appears.
 */
const buffer: UiLogRecord[] = [];

/** Serialises one argument defensively: an `Error` contributes its message, nothing else. */
function stringifyArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.message;
  if (arg === null || arg === undefined || typeof arg !== 'object') return String(arg);
  try {
    return JSON.stringify(arg);
  } catch {
    // Cyclic or otherwise unserialisable — a placeholder beats throwing inside a logger.
    return '[unserializable]';
  }
}

function capture(level: UiLogRecord['level'], module: string, args: unknown[]) {
  const message = args.map(stringifyArg).join(' ').slice(0, MAX_MESSAGE_LENGTH);
  if (buffer.length === CAPACITY) buffer.shift();
  buffer.push({ ts: new Date().toISOString(), level, module, message });
}

/** Returns the retained UI log records, oldest first. */
export function getRecentUiLogs(): UiLogRecord[] {
  return buffer.slice();
}

export function clearRecentUiLogs(): void {
  buffer.length = 0;
}

export function createLogger(module: string): Logger {
  const prefix = `[${module}]`;
  return {
    error: (...args: unknown[]) => {
      capture('error', module, args);
      console.error(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      capture('warn', module, args);
      console.warn(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      capture('info', module, args);
      console.info(prefix, ...args);
    },
    debug: import.meta.env.DEV ? (...args: unknown[]) => console.log(prefix, ...args) : () => {},
  };
}
