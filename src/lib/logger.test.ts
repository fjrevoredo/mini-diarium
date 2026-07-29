import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createLogger, getRecentUiLogs, clearRecentUiLogs } from './logger';

describe('logger UI ring buffer', () => {
  beforeEach(() => {
    clearRecentUiLogs();
    // The buffer is the unit under test; console noise is not.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearRecentUiLogs();
  });

  it('captures info, warn, and error with their module and level', () => {
    const log = createLogger('editor');
    log.info('saved');
    log.warn('slow');
    log.error('failed');

    const records = getRecentUiLogs();
    expect(records.map((r) => r.level)).toEqual(['info', 'warn', 'error']);
    expect(records.map((r) => r.module)).toEqual(['editor', 'editor', 'editor']);
    expect(records.map((r) => r.message)).toEqual(['saved', 'slow', 'failed']);
    expect(records[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('never captures debug — that level is where entry-shaped data appears', () => {
    const log = createLogger('editor');
    log.debug('title=Secret diary heading');
    expect(getRecentUiLogs()).toHaveLength(0);
  });

  it('caps the buffer and evicts the oldest record first', () => {
    const log = createLogger('spam');
    for (let i = 0; i < 205; i++) log.info(`record ${i}`);

    const records = getRecentUiLogs();
    expect(records).toHaveLength(200);
    expect(records[0].message).toBe('record 5');
    expect(records[199].message).toBe('record 204');
  });

  it('truncates a long message so one argument cannot crowd out the buffer', () => {
    createLogger('m').info('x'.repeat(1000));
    expect(getRecentUiLogs()[0].message).toHaveLength(500);
  });

  it('reduces an Error to its message, never its stack', () => {
    const error = new Error('disk full');
    createLogger('m').error('save failed', error);

    const message = getRecentUiLogs()[0].message;
    expect(message).toBe('save failed disk full');
    expect(message).not.toContain('at ');
  });

  it('serialises objects and survives cyclic ones', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    const log = createLogger('m');
    log.info({ id: 7 });
    log.info(cyclic);

    const records = getRecentUiLogs();
    expect(records[0].message).toBe('{"id":7}');
    expect(records[1].message).toBe('[unserializable]');
  });

  it('returns a copy, so a caller cannot mutate the buffer', () => {
    createLogger('m').info('one');
    const records = getRecentUiLogs();
    records.pop();
    expect(getRecentUiLogs()).toHaveLength(1);
  });
});
