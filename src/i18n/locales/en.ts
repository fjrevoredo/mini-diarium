/**
 * English locale — canonical source of truth for all UI strings.
 *
 * ADDING NEW KEYS
 * ───────────────
 * 1. Add the key under the appropriate namespace (or create a new one).
 * 2. Use lowerCamelCase for key names.
 * 3. Suffix conventions: `.label` for form labels, `.hint` for helper text,
 *    `.placeholder` for input placeholders, `.aria` for aria-label strings.
 *    Button text uses the verb directly (e.g. `common.save`).
 * 4. Interpolation: `{{ name }}` (spaces required) — e.g. `"Hello {{ name }}"`.
 * 5. Plurals: use explicit `_one` / `_other` key suffixes; pick the right key
 *    in the component: `t(count === 1 ? 'ns.key_one' : 'ns.key_other', { count })`.
 *
 * See docs/TRANSLATIONS.md for the full translator guide.
 */

const en = {
  /** Shared buttons and actions used across multiple components */
  common: {
    save: 'Save',
    cancel: 'Cancel',
    close: 'Close',
    add: 'Add',
    remove: 'Remove',
    open: 'Open',
    browse: 'Browse',
    browseDotDotDot: 'Browse...',
    browseFolderDotDotDot: 'Browse Folder...',
  },

  /** App-level and layout strings */
  layout: {
    loading: 'Loading...',
    header: {
      toggleMenu: 'Toggle menu',
      about: 'About',
      lockJournal: 'Lock journal',
    },
    sidebar: {
      navigation: 'Navigation',
      title: 'Mini Diarium',
      closeMenu: 'Close menu',
      goToToday: 'Go to Today',
    },
  },

  /** Calendar widget */
  calendar: {
    /** Short month names shown in the month picker grid (3-letter abbreviations) */
    jan: 'Jan',
    feb: 'Feb',
    mar: 'Mar',
    apr: 'Apr',
    may: 'May',
    jun: 'Jun',
    jul: 'Jul',
    aug: 'Aug',
    sep: 'Sep',
    oct: 'Oct',
    nov: 'Nov',
    dec: 'Dec',
    /** Short weekday column headers */
    sun: 'Sun',
    mon: 'Mon',
    tue: 'Tue',
    wed: 'Wed',
    thu: 'Thu',
    fri: 'Fri',
    sat: 'Sat',
    /** Full weekday names used in aria-label attributes */
    sunday: 'Sunday',
    monday: 'Monday',
    tuesday: 'Tuesday',
    wednesday: 'Wednesday',
    thursday: 'Thursday',
    friday: 'Friday',
    saturday: 'Saturday',
    /** Navigation aria-labels */
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    prevYear: 'Previous year',
    nextYear: 'Next year',
    openPicker: 'Open month picker',
    closePicker: 'Close month picker',
    /** Appended to calendar day aria-label when the day has an entry */
    hasEntry: ', has entry',
    /** Month + year aria-label used in month picker button: e.g. "Jan 2026" */
    monthYearAria: '{{ name }} {{ year }}',
  },

  /** Auth screens */
  auth: {
    /** JournalPicker */
    picker: {
      title: 'Mini Diarium',
      yourJournals: 'Your Journals',
      yourJournalsAria: 'Your journals',
      empty: 'No journals yet. Create a new journal or open an existing one.',
      lastUsed: 'Last used',
      openButton: 'Open',
      removeButton: 'Remove',
      renameAria: 'Rename {{ name }}',
      createNew: '+ Create New Journal',
      openExisting: '+ Open Existing',
      createFormTitle: 'Create New Journal',
      openFormTitle: 'Open Existing Journal',
      nameLabel: 'Name',
      namePlaceholder: 'e.g. My Journal',
      journalNamePlaceholder: 'Journal name',
      locationLabel: 'Location',
      confirmRemoveMessage:
        'Remove this journal from the list? The journal file will not be deleted.',
      confirmRemoveTitle: 'Remove Journal',
      noJournalFound:
        'No journal found in the selected folder. Make sure the folder contains a diary.db file.',
      nameRequired: 'Journal name is required',
      folderRequired: 'Please choose a folder first',
      chooseFolderTitle: 'Choose Journal Folder',
      selectFolderTitle: 'Select Journal Folder',
      creating: 'Creating...',
      opening: 'Opening...',
    },
    /** PasswordPrompt */
    prompt: {
      title: 'Mini Diarium',
      unlockFallback: 'Unlock your journal',
      /** Used as "Unlock <name>" — only the prefix word */
      unlockPrefix: 'Unlock',
      backToJournals: '← Back to Journals',
      passwordMode: 'Password',
      keyFileMode: 'Key File',
      unlockMethodAria: 'Unlock method',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      unlockButton: 'Unlock Journal',
      unlocking: 'Unlocking...',
      keyFileLabel: 'Private Key File',
      keyFilePlaceholder: 'No file selected',
      keyFileBrowseAria: 'Browse for key file',
      keyFileHint: 'Select the private key file (.key) registered with this journal.',
      unlockWithKeyFile: 'Unlock with Key File',
      selectKeyFileError: 'Please select a key file',
      openFilePickerError: 'Failed to open file picker',
      passwordRequired: 'Password is required',
    },
    /** PasswordCreation */
    creation: {
      title: 'Welcome to Mini Diarium',
      subtitle: 'Create a password to secure your journal',
      passwordLabel: 'Password',
      passwordHint: '(1+ characters, 12+ recommended)',
      passwordPlaceholder: 'Enter your password',
      repeatLabel: 'Repeat Password',
      repeatPlaceholder: 'Repeat your password',
      createButton: 'Create Journal',
      creating: 'Creating...',
      localStorageNote: 'Your journal will be encrypted and stored locally on your device.',
      backToJournals: '← Back to Journals',
      passwordRequired: 'Password is required',
      passwordsMismatch: 'Passwords do not match',
    },
    /** PasswordStrengthIndicator */
    strength: {
      veryWeak: 'Very weak - prefer a longer, more complex password',
      weak: 'Weak - consider adding complexity',
      medium: 'Medium - good balance',
      strong: 'Strong - excellent',
      warningText:
        'We strongly recommend using a stronger password (12+ characters with a mix of letters, numbers, and symbols).',
    },
  },

  /** Editor components */
  editor: {
    /** EditorToolbar */
    toolbar: {
      aria: 'Formatting options',
      textStyle: 'Text style',
      normal: 'Normal',
      heading1: 'Heading 1',
      heading2: 'Heading 2',
      heading3: 'Heading 3',
      bold: 'Bold',
      boldTitle: 'Bold (Ctrl/Cmd+B)',
      italic: 'Italic',
      italicTitle: 'Italic (Ctrl/Cmd+I)',
      underline: 'Underline (Ctrl/Cmd+U)',
      strikethrough: 'Strikethrough (Ctrl/Cmd+Shift+S)',
      highlight: 'Highlight (Ctrl/Cmd+Shift+H)',
      blockquote: 'Blockquote (Ctrl/Cmd+Shift+B)',
      inlineCode: 'Inline Code (Ctrl/Cmd+E)',
      bulletList: 'Bullet List',
      numberedList: 'Numbered List',
      horizontalRule: 'Insert horizontal rule',
      insertImage: 'Insert image',
      alignLeft: 'Align left',
      alignCenter: 'Align center',
      alignRight: 'Align right',
      justify: 'Justify',
    },
    /** WordCount — plural pair */
    wordCount_one: '{{ count }} word',
    wordCount_other: '{{ count }} words',
    /** TitleEditor */
    titlePlaceholder: 'Title',
    /** EntryNavBar aria-labels (fallbacks) */
    prevEntry: 'Previous entry',
    nextEntry: 'Next entry',
    deleteEntry: 'Delete entry',
    addEntry: 'Add entry',
    /** EditorPanel — add/delete button titles */
    addEntryCreating: 'Creating entry…',
    addEntryHint: 'Write something first to add another entry for this day',
    addEntryTitle: 'Add another entry for this day',
    /** EditorPanel — placeholders */
    titleOptionalPlaceholder: 'Title (optional)',
    editorPlaceholder: "What's on your mind today?",
    /** EditorPanel — saving status */
    saving: 'Saving...',
    /** EditorPanel — entry timestamps */
    timestampCreated: 'Created: {{ timestamp }}',
    timestampUpdated: 'Updated: {{ timestamp }}',
    /** EditorPanel — delete entry confirm dialog */
    deleteConfirmMessage: 'Are you sure you want to delete this entry?',
    deleteConfirmTitle: 'Delete Entry',
  },

  /** Search components */
  search: {
    placeholder: 'Search entries...',
    clearAria: 'Clear search',
    searching: 'Searching...',
    noResults: 'No results found for "{{ query }}"',
    noTitle: 'No title',
  },

  /** StatsOverlay */
  stats: {
    title: 'Statistics',
    closeAria: 'Close',
    description: 'Overview of your journal entries and writing habits',
    loadingAria: 'Loading statistics',
    totalEntries: 'Total Entries',
    entriesPerWeek: 'Entries per Week',
    bestStreak: 'Best Streak',
    currentStreak: 'Current Streak',
    totalWords: 'Total Words',
    avgWordsPerEntry: 'Avg. Words per Entry',
    day_one: '{{ count }} day',
    day_other: '{{ count }} days',
    failedToLoad: 'Failed to load statistics',
  },

  /** PreferencesOverlay — grouped by tab */
  prefs: {
    title: 'Preferences',
    srDescription: 'Customize your journaling experience.',
    sectionsAria: 'Preferences sections',
    tabGeneral: 'General',
    tabWriting: 'Writing',
    tabSecurity: 'Security',
    tabData: 'Data',
    tabAdvanced: 'Advanced',
    general: {
      themeLabel: 'Theme',
      themeAuto: 'Auto (System Default)',
      themeLight: 'Light',
      themeDark: 'Dark',
      themeHint: 'Choose how the app should look. Auto follows your system theme.',
      escLabel: 'ESC key action',
      escNone: 'Do nothing',
      escQuit: 'Quit the app',
      escHint: 'When set to "Quit", pressing Escape closes the app while no dialog is open.',
    },
    writing: {
      firstDayLabel: 'First Day of Week',
      firstDaySystem: 'System Default',
      firstDaySunday: 'Sunday',
      firstDayMonday: 'Monday',
      firstDayTuesday: 'Tuesday',
      firstDayWednesday: 'Wednesday',
      firstDayThursday: 'Thursday',
      firstDayFriday: 'Friday',
      firstDaySaturday: 'Saturday',
      allowFutureLabel: 'Allow future entries',
      allowFutureHint: 'When disabled, you cannot create entries for future dates.',
      hideTitlesLabel: 'Hide entry titles',
      hideTitlesHint: 'When enabled, the title editor will be hidden. Title data is still saved.',
      showTimestampsLabel: 'Show entry timestamps',
      showTimestampsHint:
        'Displays the creation and last updated time below the title for the current entry.',
      spellcheckLabel: 'Enable spellcheck',
      spellcheckHint: 'When enabled, browser spellcheck will highlight misspelled words.',
      advancedToolbarLabel: 'Show advanced formatting toolbar',
      advancedToolbarHint:
        'When enabled, the toolbar shows additional controls: headings, underline, strikethrough, blockquote, inline code, and horizontal rule.',
      fontSizeLabel: 'Editor font size',
      fontSizePxSuffix: 'px',
      fontSizeMin: '12 px',
      fontSizeMax: '24 px',
    },
    security: {
      authMethodsTitle: 'Authentication Methods',
      authMethodsHint: 'Registered methods that can unlock this journal. At least one must remain.',
      password: 'Password',
      keyFile: 'Key File',
      lastUsed: 'Last used: {{ date }}',
      removeMethod: 'Remove',
      currentPwdRequired: 'Current Password (required to remove)',
      currentPwdPlaceholder: 'Enter current password',
      removeError: 'Current password is required to remove an auth method',
      confirmRemoveMessage: 'Are you sure you want to remove this authentication method?',
      confirmRemoveTitle: 'Remove Authentication Method',
      addPasswordTitle: 'Add Password Auth',
      addPasswordHint:
        'No password method is registered. Add one so you can unlock with a password.',
      passwordLabel: 'Password',
      passwordHint: '(1+ characters, 12+ recommended)',
      passwordPlaceholder: 'Enter your password',
      confirmPasswordLabel: 'Confirm Password',
      confirmPasswordPlaceholder: 'Repeat password',
      addPasswordSuccess: 'Password registered successfully!',
      addPasswordButton: 'Add Password',
      addKeyTitle: 'Add Key File Auth',
      labelLabel: 'Label',
      labelPlaceholder: 'e.g. My YubiKey',
      currentPasswordLabel: 'Current Password',
      currentPasswordPlaceholder: 'Verify identity',
      addKeySuccess: 'Key file registered successfully!',
      generateRegister: 'Generate & Register Key File',
      generateHint:
        'Generates a new keypair and saves the private key file locally. Register the public key with your journal so you can unlock without a password.',
      savePrivateKeyTitle: 'Save Private Key File',
      keypairFileCancelled: 'Key file save cancelled',
      changePasswordTitle: 'Change Password',
      currentPasswordLabel2: 'Current Password',
      currentPasswordPlaceholder2: 'Enter current password',
      newPasswordLabel: 'New Password',
      newPasswordHint: '(1+ characters, 12+ recommended)',
      newPasswordPlaceholder: 'Enter new password',
      confirmNewPasswordLabel: 'Confirm New Password',
      confirmNewPasswordPlaceholder: 'Confirm new password',
      changePasswordSuccess: 'Password changed successfully!',
      changePasswordButton: 'Change Password',
      autoLockTitle: 'Auto-Lock',
      autoLockLabel: 'Lock after inactivity',
      autoLockTimeoutLabel: 'Timeout (seconds)',
      autoLockRange: '(1–999)',
      allFieldsRequired: 'All fields are required',
      passwordsMismatch: 'New passwords do not match',
      keypairPasswordRequired: 'Current password is required',
      keypairLabelRequired: 'Label is required',
      addPasswordBothRequired: 'Both fields are required',
      addPasswordMismatch: 'Passwords do not match',
    },
    data: {
      currentLocationLabel: 'Current Location',
      changeLocation: 'Change Location',
      moving: 'Moving...',
      changeLocationHint:
        "Moves your journal file to a new folder. The journal will be locked — you'll need to unlock it again from the new location.",
      resetJournal: 'Reset Journal',
      resetJournalHint:
        'Warning: This will permanently delete all entries. This action cannot be undone.',
      resetConfirmMessage:
        'Are you sure you want to reset your journal? This will permanently delete all entries and cannot be undone.',
      resetConfirmTitle: 'Reset Journal',
      resetDoubleConfirmMessage:
        'This is your last chance. Are you absolutely sure you want to delete all your journal entries?',
      resetDoubleConfirmTitle: 'Reset Journal — Final Warning',
      changeDirectoryTitle: 'Choose Journal Directory',
      resetFailedAlert: 'Failed to reset journal: {{ message }}',
    },
    advanced: {
      themeOverridesTitle: 'Theme Overrides',
      themeOverridesHint:
        "Override individual theme color tokens. Enter a JSON object with 'light' and/or 'dark' keys. Only documented tokens ('--bg-*', '--text-*', etc.) are supported. Invalid tokens are silently ignored.",
      seeUserGuide: 'See User Guide',
      overridesParseError: 'Invalid JSON. Check for syntax errors.',
      overridesApplied: 'Overrides applied.',
      applyOverrides: 'Apply Overrides',
      resetToDefault: 'Reset to Default',
      diagnosticsTitle: 'Diagnostics',
      diagnosticsHint:
        'Generates a JSON file with app metadata to help diagnose issues. No journal content, passwords, or encryption keys are included.',
      generateDump: 'Generate Debug Dump',
      generating: 'Generating…',
      dumpSuccess: 'Debug dump saved successfully.',
    },
    footer: {
      cancel: 'Cancel',
      save: 'Save',
    },
  },

  /** ExportOverlay */
  export: {
    title: 'Export Entries',
    closeAria: 'Close',
    description: 'Export all journal entries to a file',
    securityWarning:
      'Exported files contain your journal entries as plain text. Store them in a secure location.',
    formatLabel: 'Format',
    failedTitle: 'Export Failed',
    successTitle: 'Export Successful!',
    entriesExported: 'Entries exported:',
    savedTo: 'Saved to:',
    exporting: 'Exporting...',
    startExport: 'Start Export',
    exportFailed: 'Export failed',
  },

  /** ImportOverlay */
  import: {
    title: 'Import Entries',
    closeAria: 'Close',
    description: 'Import journal entries from a file',
    formatLabel: 'Format',
    fileLabel: 'File',
    noFileSelected: 'No file selected',
    failedTitle: 'Import Failed',
    successTitle: 'Import Successful!',
    entriesImported: 'Entries imported:',
    entriesSkipped: 'Entries skipped:',
    importing: 'Importing...',
    startImport: 'Start Import',
    importFailed: 'Import failed',
    selectFilePlease: 'Please select a file first',
    selectFormatPlease: 'Please select an import format',
  },

  /** AboutOverlay */
  about: {
    title: 'About',
    closeAria: 'Close',
    appName: 'Mini Diarium',
    version: 'Version {{ version }}',
    description: 'An encrypted, local-first desktop journaling app.',
    license: 'MIT License',
    copyright: 'Copyright © 2026 Francisco J. Revoredo',
    githubLink: 'github.com/fjrevoredo/mini-diarium',
  },

  /** GoToDateOverlay */
  goToDate: {
    title: 'Go to Date',
    description: 'Jump to a specific date in your journal.',
    selectDateLabel: 'Select Date',
    goToDate: 'Go to Date',
    closeAria: 'Close',
  },

  /**
   * User-facing error messages mapped from raw Tauri/backend errors.
   * Used by mapTauriError() in src/lib/errors.ts.
   * Translators: keep these messages clear and end them with a period.
   */
  errors: {
    incorrectPassword: 'Incorrect password.',
    decryptionFailed:
      'Could not decrypt. The key file may be incorrect or the data may be corrupted.',
    journalNotUnlocked: 'Please unlock your journal first.',
    cannotRemoveLastAuth: 'Cannot remove the last authentication method.',
    cannotReadKeyFile:
      'Could not read key file. Check that the file exists and you have permission to read it.',
    cannotSaveKeyFile: 'Could not save key file. Check folder permissions.',
    fileOperationFailed: 'A file operation failed. Check that you have the necessary permissions.',
    internalError: 'An internal error occurred.',
    unexpectedError: 'An unexpected error occurred.',
  },
} as const;

export default en;
export type Locale = typeof en;
