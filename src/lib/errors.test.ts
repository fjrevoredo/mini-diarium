import { describe, expect, it } from 'vitest';
import { mapTauriError } from './errors';
import { defaultT } from '../i18n';

const en = (key: string) => defaultT(key as Parameters<typeof defaultT>[0]);

describe('mapTauriError', () => {
  describe('branch ordering', () => {
    // The regression this whole file exists for. A rusqlite failure is phrased
    // "Failed to create schema: …", which the filesystem bucket's `failed to create` pattern
    // matched first — reporting a database fault as a permissions problem. That mislabelling
    // is why a Flathub user's broken journal creation went undiagnosed for two weeks.
    it('reports a schema failure as an internal error, not a permissions problem', () => {
      const mapped = mapTauriError('Failed to create schema: disk I/O error');

      expect(mapped).toBe(en('errors.internalError'));
      expect(mapped).not.toBe(en('errors.fileOperationFailed'));
    });

    it('reports a schema-version failure as an internal error', () => {
      expect(mapTauriError('Failed to set schema version: database is locked')).toBe(
        en('errors.internalError'),
      );
    });

    it('still reports a genuine file failure as a file operation failure', () => {
      expect(mapTauriError('Failed to write config: Access is denied. (os error 5)')).toBe(
        en('errors.fileOperationFailed'),
      );
    });

    it('keeps the key-file branch ahead of the generic file branch', () => {
      expect(mapTauriError('Failed to read key file: os error 2')).toBe(
        en('errors.cannotReadKeyFile'),
      );
      expect(mapTauriError('Failed to write key file: os error 13')).toBe(
        en('errors.cannotSaveKeyFile'),
      );
    });
  });

  describe('journal-location rejections', () => {
    it('explains a rejected document-portal path', () => {
      expect(mapTauriError('Path is a temporary sandbox location')).toBe(
        en('errors.portalPathRejected'),
      );
    });

    it('explains a rejected backup snapshot', () => {
      expect(mapTauriError('Path is a backup snapshot')).toBe(en('errors.backupFileRejected'));
    });

    it('explains a journal that is already registered', () => {
      const mapped = mapTauriError('Journal is already in your list');

      expect(mapped).toBe(en('errors.journalAlreadyRegistered'));
      // Not a permissions problem — the filesystem bucket would be a lie here.
      expect(mapped).not.toBe(en('errors.fileOperationFailed'));
    });

    it('explains a refused journal filename', () => {
      expect(mapTauriError('Invalid journal filename')).toBe(en('errors.invalidJournalFilename'));
    });
  });

  describe('reveal_backups_folder with nothing to open', () => {
    it.each(['The backups folder does not exist yet', 'There are no backups to show yet'])(
      'localizes %j',
      (raw) => {
        expect(mapTauriError(raw)).toBe(en('errors.noBackupsYet'));
      },
    );

    it('uses the active locale, not the raw English string', () => {
      const t = ((key: string) => `translated:${key}`) as Parameters<typeof mapTauriError>[1];
      expect(mapTauriError('There are no backups to show yet', t)).toBe(
        'translated:errors.noBackupsYet',
      );
    });
  });

  describe('forward-compatibility guard', () => {
    it('maps a journal written by a newer app', () => {
      expect(
        mapTauriError(
          'This journal requires a newer version of the app. Update the app to open it.',
        ),
      ).toBe(en('errors.journalTooNew'));
    });

    it('maps a backup written by a newer app', () => {
      expect(
        mapTauriError(
          'This backup requires a newer version of the app. Update the app to inspect or restore it.',
        ),
      ).toBe(en('errors.backupTooNew'));
    });
  });

  describe('auth errors', () => {
    it('maps a wrong password', () => {
      expect(mapTauriError('Wrong password')).toBe(en('errors.incorrectPassword'));
    });

    it('maps a decryption failure', () => {
      expect(mapTauriError('Failed to decrypt entry')).toBe(en('errors.decryptionFailed'));
    });

    it('maps the locked-journal guard', () => {
      expect(mapTauriError('Journal must be unlocked')).toBe(en('errors.journalNotUnlocked'));
    });

    it('maps the per-entry lock rejection', () => {
      expect(mapTauriError('entry is locked')).toBe(en('errors.entryLocked'));
    });

    it('maps the attachment validation errors', () => {
      expect(mapTauriError('Attachment is too large. Maximum supported size is 20 MB.')).toBe(
        en('errors.attachmentTooLarge'),
      );
      expect(mapTauriError('Attachment file is empty')).toBe(en('errors.attachmentEmpty'));
      expect(mapTauriError('Attachment path is not a file')).toBe(en('errors.attachmentNotAFile'));
      expect(mapTauriError('Attachment not found')).toBe(en('errors.attachmentNotFound'));
      expect(mapTauriError('Destination file must have the .pdf extension')).toBe(
        en('errors.attachmentExtensionMismatch'),
      );
      expect(mapTauriError('Destination file must have no extension')).toBe(
        en('errors.attachmentExtensionMismatch'),
      );
    });

    it('maps the journal-protection and export-journal-changed errors', () => {
      expect(mapTauriError('This location is used by the journal and cannot be overwritten')).toBe(
        en('errors.attachmentProtectedDestination'),
      );
      expect(mapTauriError('The journal changed during the export')).toBe(
        en('errors.exportJournalChanged'),
      );
    });

    it('does not leak the path from an attachment write failure', () => {
      expect(mapTauriError('Failed to write attachment copy: Access is denied. (os error 5)')).toBe(
        en('errors.fileOperationFailed'),
      );
    });

    it('maps the last-auth-method guard', () => {
      expect(mapTauriError('Cannot remove the last auth method')).toBe(
        en('errors.cannotRemoveLastAuth'),
      );
    });
  });

  describe('sanitization', () => {
    it('passes through a message that carries no path and no OS detail', () => {
      expect(mapTauriError('Journal already exists')).toBe('Journal already exists');
    });

    it('does not leak a path that reached no earlier branch', () => {
      const mapped = mapTauriError('Something odd at /home/jon/Diarys & Journals/diary.db');

      expect(mapped).toBe(en('errors.unexpectedError'));
      expect(mapped).not.toContain('/home/jon');
    });

    it('accepts an Error instance as well as a string', () => {
      expect(mapTauriError(new Error('Wrong password'))).toBe(en('errors.incorrectPassword'));
    });

    it('stringifies a non-Error, non-string value', () => {
      expect(mapTauriError(undefined)).toBe('undefined');
    });
  });
});
