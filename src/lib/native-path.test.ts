import { describe, it, expect } from 'vitest';
import { joinDialogPath, splitDialogPath } from './native-path';

describe('splitDialogPath', () => {
  it('keeps a backslash in a Unix filename', () => {
    expect(splitDialogPath('/home/u/work\\notes.db')).toEqual({
      dir: '/home/u',
      filename: 'work\\notes.db',
    });
  });

  it('keeps a backslash in a Unix folder name', () => {
    expect(splitDialogPath('/home/u/my\\dir/work.db')).toEqual({
      dir: '/home/u/my\\dir',
      filename: 'work.db',
    });
  });

  it('splits a Windows drive path on either separator', () => {
    expect(splitDialogPath('C:\\Users\\u\\diary.db')).toEqual({
      dir: 'C:\\Users\\u',
      filename: 'diary.db',
    });
    expect(splitDialogPath('C:/Users/u\\diary.db')).toEqual({
      dir: 'C:/Users/u',
      filename: 'diary.db',
    });
  });

  it('splits a UNC path on backslashes', () => {
    expect(splitDialogPath('\\\\server\\share\\diary.db')).toEqual({
      dir: '\\\\server\\share',
      filename: 'diary.db',
    });
  });

  it('returns the whole input as the filename when there is no separator', () => {
    expect(splitDialogPath('diary.db')).toEqual({ dir: '', filename: 'diary.db' });
  });
});

describe('joinDialogPath', () => {
  it('joins a Unix folder that contains a backslash with a forward slash', () => {
    expect(joinDialogPath('/home/u/my\\dir', 'work.db')).toBe('/home/u/my\\dir/work.db');
  });

  it('joins a Windows folder with a backslash', () => {
    expect(joinDialogPath('C:\\Users\\u', 'diary.db')).toBe('C:\\Users\\u\\diary.db');
    expect(joinDialogPath('\\\\server\\share', 'diary.db')).toBe('\\\\server\\share\\diary.db');
  });

  it('joins a forward-slash Windows folder with a forward slash', () => {
    expect(joinDialogPath('C:/Users/u', 'diary.db')).toBe('C:/Users/u/diary.db');
  });

  it('does not double a trailing separator', () => {
    expect(joinDialogPath('/home/u/', 'diary.db')).toBe('/home/u/diary.db');
    expect(joinDialogPath('C:\\', 'diary.db')).toBe('C:\\diary.db');
  });

  it('round-trips a split path', () => {
    for (const path of ['/home/u/work\\notes.db', 'C:\\Users\\u\\diary.db', '/a/b.db']) {
      const { dir, filename } = splitDialogPath(path);
      expect(joinDialogPath(dir, filename)).toBe(path);
    }
  });
});
