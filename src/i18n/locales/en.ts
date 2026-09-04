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
    or: 'or',
  },

  /** App-level and layout strings */
  layout: {
    loading: 'Loading...',
    header: {
      toggleMenu: 'Toggle menu',
      previousDay: 'Previous day',
      nextDay: 'Next day',
      goToDate: 'Go to date',
      about: 'About',
      lockJournal: 'Lock journal',
      notificationsNone: 'Notifications',
      notificationsUnread: 'Notifications, {{ count }} unread',
      showTimeline: 'Show timeline',
      showEditor: 'Show editor',
      search: 'Search',
      moreOptions: 'More options',
      menuStatistics: 'Statistics',
      menuImport: 'Import',
      menuExport: 'Export',
    },
    sidebar: {
      navigation: 'Navigation',
      title: 'Mini Diarium',
      closeMenu: 'Close menu',
      goToToday: 'Go to Today',
    },
  },

  /** Timeline list view */
  timeline: {
    title: 'Timeline',
    empty: 'No entries yet.',
    untitled: 'Untitled',
    openEntry: 'Open entry from {{ date }}',
    lockedIndicator: 'Locked entry',
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
    /** Appended to calendar day aria-label when the day has a locked entry */
    hasLockedEntry: ', has locked entry',
    /** Title/aria-label hint shown on a disabled future day when future entries are off */
    futureDisabledHint: 'Future entries are disabled — enable them in Preferences → Writing',
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
      useDefaultLocation: 'Use default location',
      defaultLocationHint:
        'The default location gives each journal a folder of its own. You only need to browse if you want a different folder.',
      confirmRemoveMessage:
        'Remove this journal from the list? The journal file will not be deleted.',
      confirmRemoveTitle: 'Remove Journal',
      noJournalFound: 'The selected file is not a valid diary database.',
      nameRequired: 'Journal name is required',
      folderRequired: 'Please choose a folder first',
      chooseFolderTitle: 'Choose Location',
      selectFolderTitle: 'Select Journal File',
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
      toolsAria: 'Tools available without unlocking',
      viewBackups: 'View backups',
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
      multiAuthNote: 'This journal requires all authentication methods.',
      multiAuthBothRequired: 'Both a password and a key file are required.',
      multiAuthAllRequired: 'All authentication credentials must be provided.',
      multiAuthLoadError: 'Failed to load authentication methods.',
      autoUnlocking: 'Opening journal\u2026',
      autoUnlockFailed:
        'Could not auto-unlock this journal. The local key may be missing. You can add a password in Preferences.',
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
      modeGroupAria: 'Journal protection mode',
      passwordMode: 'Password',
      localOnlyMode: 'Local-only',
      localOnlyTitle: 'This journal is protected by your OS account, not a password.',
      localOnlyPoint1: 'Opens automatically on this device, no password to remember.',
      localOnlyPoint2:
        'The encryption key is stored in your current OS user account. Copying the journal file to another device will not allow it to be opened.',
      localOnlyPoint3:
        'Anyone who can log in to this OS account can open the journal without a password.',
      localOnlyPoint4:
        'If you lose access to this OS account (forgotten system password, account deletion, or OS reinstall), the encryption key will be lost and the journal cannot be recovered.',
      localOnlyAck:
        'I understand that losing access to this OS user account means this journal cannot be recovered.',
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
      textColor: 'Text color',
      highlightColor: 'Highlight color',
      blockquote: 'Blockquote (Ctrl/Cmd+Shift+B)',
      inlineCode: 'Inline Code (Ctrl/Cmd+E)',
      link: 'Link',
      linkTitle: 'Link (Ctrl/Cmd+K)',
      bulletList: 'Bullet List',
      numberedList: 'Numbered List',
      horizontalRule: 'Insert horizontal rule',
      insertImage: 'Insert image',
      insertExistingImage: 'Insert existing image',
      importMarkdown: 'Import Markdown file',
      alignLeft: 'Align left',
      alignCenter: 'Align center',
      alignRight: 'Align right',
      justify: 'Justify',
      insertTimestamp: 'Insert timestamp',
      insertTimestampTitle: 'Insert current timestamp',
      textDirection: 'Text direction',
      textDirectionTitle: 'Toggle text direction (Ctrl+Shift+D)',
      fontFamily: 'Font family',
      fontSize: 'Font size',
      setEntryFontDefault: 'Set as entry default',
      clearEntryFontDefault: 'Clear entry default',
    },
    /** ImagePickerOverlay */
    imagePicker: {
      title: 'Saved Images',
      description: 'Choose a saved image to insert.',
      sortLabel: 'Sort',
      libraryTab: 'Library',
      sortNewest: 'Newest',
      sortOldest: 'Oldest',
      sortMostUsed: 'Most used',
      monthLabel: 'Month',
      loading: 'Loading saved images...',
      loadMore: 'Load more',
      insertButton: 'Insert',
      loadError: 'Failed to load saved images.',
      insertError: 'Failed to insert image.',
      noImages: 'No saved images yet. Insert an image to save it here.',
      error: 'Failed to load images.',
      previewTitle: 'Preview',
      previewEmpty: 'Select an image to preview it.',
      createdLabel: 'Created',
      dimensionsLabel: 'Dimensions',
      formatLabel: 'Format',
      sizeLabel: 'Size',
      usageLabel: 'Used in entries',
      linkedDatesLabel: 'Linked dates',
      thumbnailUnavailable: 'Preview unavailable',
      linkedDateSingle: '{{ date }}',
      linkedDateRange: '{{ from }} to {{ to }}',
    },
    /** WordCount — plural pair */
    wordCount_one: '{{ count }} word',
    wordCount_other: '{{ count }} words',
    /** TitleEditor */
    titlePlaceholder: 'Title',
    /** EntryNavBar aria-labels (fallbacks) */
    prevEntry: 'Previous entry',
    nextEntry: 'Next entry',
    goToEntry: 'Go to entry {{ number }}',
    deleteEntry: 'Delete entry',
    addEntry: 'Add entry',
    /** EntryNavBar lock toggle */
    lockEntry: 'Lock entry',
    unlockEntry: 'Unlock entry',
    entryLockedHint: 'This entry is locked. Unlock it to make changes.',
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
    /** EditorPanel — import markdown error */
    importMarkdownNoEditor: 'No active editor to import into.',
    /** DiaryEditor — dropped image from web page (HTTPS URL, cannot embed without network) */
    dropRejectedWebImage:
      "This image can't be embedded: it would require a network request, which this app never makes to protect your privacy. Right-click the image → Copy Image, then paste with Ctrl+V.",
  },

  /** Search components */
  search: {
    title: 'Search',
    placeholder: 'Search entries...',
    clearAria: 'Clear search',
    searching: 'Searching...',
    noResults: 'No results found for "{{ query }}"',
    noTitle: 'No title',
    resultCount_one: '{{ count }} result found',
    resultCount_other: '{{ count }} results found',
    truncated: 'Showing first {{ max }} — refine your query to see more',
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
    tabBackups: 'Backups',
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
      languageLabel: 'Language',
      languageHint: 'Select the display language.',
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
      spellcheckDictionaryMissing:
        "Spell check needs the English language pack. Open your computer's Software app and search for “English spell checking.” Install the language support it suggests, then restart Mini Diarium.",
      spellcheckDictionaryMissingFlatpak:
        "Spell check should be included with Mini Diarium. Open your computer's Software app, update Mini Diarium, then restart it. If this warning remains, reinstall Mini Diarium.",
      spellcheckDictionaryHelp: 'Open the spell-check setup guide',
      toolbarItemsLabel: 'Toolbar items',
      toolbarItemsHint:
        'Customize which formatting controls appear in the editor toolbar and their order.',
      toolbarItemSelectAll: 'Select all',
      toolbarItemSelectNone: 'Select none',
      toolbarItemMoveUp: 'Move up',
      toolbarItemMoveDown: 'Move down',
      toolbarItem: {
        headings: 'Headings',
        underline: 'Underline',
        strikethrough: 'Strikethrough',
        textColor: 'Text color',
        highlightColor: 'Highlight color',
        blockquote: 'Blockquote',
        inlineCode: 'Inline code',
        link: 'Link',
        bulletList: 'Bullet list',
        orderedList: 'Numbered list',
        horizontalRule: 'Horizontal rule',
        insertImage: 'Insert image',
        insertExistingImage: 'Insert existing image',
        importMarkdown: 'Import Markdown',
        insertTimestamp: 'Insert timestamp',
        textDirection: 'Text direction',
        alignment: 'Alignment controls',
        fontFamily: 'Font family',
        fontSize: 'Font size',
      },
      fontSizeLabel: 'Default editor font size',
      fontSizePxSuffix: 'px',
      fontSizeMin: '12 px',
      fontSizeMax: '24 px',
      fontFamilyLabel: 'Default editor font',
      fontFamilySystemDefault: 'System Default',
      fontFamilyHint:
        'App-wide default font for new and existing entries. Individual entries can override this from the toolbar.',
      fontFamilyCustomFontsNote: 'To add custom fonts, go to the Advanced tab.',
      customFontsGroupLabel: 'Custom',
      customFontsLabel: 'Custom fonts',
      customFontsHint:
        'Custom fonts are stored inside your journal, imported or removed immediately, and travel with the journal to other devices. They also increase the size of your journal file and backups.',
      customFontBoldPairHint:
        'For correct bold text, provide both a Regular and a Bold weight file.',
      customFontRegularLabel: 'Regular weight (.ttf / .otf / .woff / .woff2)',
      customFontBoldLabel: 'Bold weight (.ttf / .otf / .woff / .woff2)',
      customFontChooseFile: 'Choose file…',
      customFontFamilyLabel: 'Font family name',
      customFontAddButton: 'Add font',
      customFontMissingBold:
        'Bold weight missing — Mini Diarium will let the browser synthesize bold text, which may look incorrect.',
      customFontDeleteButton: 'Remove',
      customFontDeleteAriaLabel: 'Remove {{ family }} custom font',
      customFontFamilyRequired: 'Font family name is required.',
      customFontRegularRequired: 'Regular weight file is required.',
      timelineTitle: 'Timeline',
      timelineDateFormatLabel: 'Date format',
      timelineDateFormatHint:
        'Sets how the date is written next to each timeline entry. All styles except ISO follow your interface language.',
      timelineDateFormatFull: 'Full',
      timelineDateFormatLong: 'Long',
      timelineDateFormatMedium: 'Medium',
      timelineDateFormatShort: 'Short',
      timelineDateFormatIso: 'ISO (YYYY-MM-DD)',
      timelinePreviewLabel: 'Show entry preview',
      timelinePreviewHint:
        'When disabled, each timeline row shows only the date and the title, without the first line of the entry.',
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
      confirmRemoveMessage:
        'Are you sure you want to remove this authentication method? It will still open every backup taken while it was registered — removing it here does not revoke it from existing backups.',
      confirmRemoveTitle: 'Remove Authentication Method',
      removedMethodStillValidWarning:
        'The removed method still opens every backup taken before you removed it. If it was compromised, delete those backups too.',
      reviewBackupsButton: 'Review backups',
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
      changePasswordSnapshotWarning:
        'Backups taken before this change will still require your current (old) password to open. Keep it somewhere safe, or take a fresh backup right after changing your password.',
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
      autoLockRange: '(5–999)',
      autoLockTimeoutTooLow:
        'Minimum is {{ min }} seconds. The value will be raised when you leave the field.',
      autoLockOnFocusLossLabel: 'Lock when the window loses focus',
      allFieldsRequired: 'All fields are required',
      passwordsMismatch: 'New passwords do not match',
      keypairPasswordRequired: 'Current password is required',
      keypairLabelRequired: 'Label is required',
      addPasswordBothRequired: 'Both fields are required',
      addPasswordMismatch: 'Passwords do not match',
      requireAllAuthTitle: 'Require All Authentication Methods',
      requireAllAuthHint:
        'When enabled, you must provide both your password and key file every time you unlock this journal. Similar to VeraCrypt combined-key mode.',
      requireAllAuthLabel: 'Require all authentication methods for unlock',
      requireAllAuthNeedsTwo: 'Add at least two authentication methods to enable this option.',
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
      moveBackupsConfirmTitle: 'Move Backups Too?',
      moveBackupsConfirmMessage:
        "This journal has existing backups. Move them to the new location along with the journal? If you don't, they will stay where they are.",
      backupsStayedAlert: 'Your existing backups were left at the old location: {{ path }}',
      previousLocationFallback: "the journal's previous folder",
    },
    backups: {
      title: 'Backups',
      hint: 'A backup is a complete, encrypted copy of this journal, taken automatically before anything risky and kept on this device only.',
      retentionPolicy:
        'Kept: the {{ recent }} most recent, plus one per day for {{ dailyDays }} days, one per week for {{ weeklyWeeks }} weeks, and one per month for {{ monthlyMonths }} months.',
      loading: 'Loading backups…',
      loadError: 'Could not read the backups folder.',
      empty: 'No backups yet. One is taken automatically the first time this journal changes.',
      emptyLocked: 'No backups found for this journal.',

      backUpNow: 'Back up now',
      backingUp: 'Backing up…',
      verify: 'Check',
      verifying: 'Checking…',
      delete: 'Delete',
      restore: 'Restore',
      restoring: 'Restoring…',
      revealFolder: 'Open backups folder',
      confirmDelete: 'Delete this backup? This cannot be undone.',
      confirmRestore:
        'Restore the journal to the backup from {{ when }}? Entries written since then will be replaced. A safety snapshot of the current state will be taken first, so this can be undone.',
      restoreSuccess:
        'Journal restored to the backup from {{ when }}. Your previous state was saved as a new backup from {{ safetyWhen }} in case you need to undo this.',
      restoreSuccessGeneric:
        'Journal restored to the backup from {{ when }}. Your previous state was saved as a new backup in case you need to undo this.',
      actionsNeedUnlock: 'Unlock this journal to create, check, restore, or delete backups.',

      statusTitle: 'Status',
      lastBackup: 'Last backup: {{ when }}',
      lastBackupNever: 'No backup has been taken yet.',
      totalSize: 'Using {{ used }} of {{ budget }}.',
      countSummary_one: '{{ count }} backup',
      countSummary_other: '{{ count }} backups',
      healthOk: 'Backups are working.',
      pendingFirstBackup: 'Backups will start automatically after your first change.',
      healthFailed:
        'The last backup attempt failed ({{ when }}). Open the backups folder to check it is reachable and has free space.',
      healthUnreachable:
        'The backups folder cannot be used. If the journal is on a removable or synced drive, reconnect it; otherwise check that the folder still exists and nothing has taken its place.',
      healthBudget:
        'Backups are over their storage limit. The most recent ones will be trimmed first; older ones are kept.',

      entryCount_one: '{{ count }} entry',
      entryCount_other: '{{ count }} entries',
      dateRange: '{{ from }} to {{ to }}',
      requiredCredentialHint: 'Requires: {{ credentials }}',
      verified: 'Checked',
      unverified: 'Not checked',
      unverifiedHint:
        'Not yet checked against this journal’s key. This is normal for backups made by an older version.',

      triggerUnlock: 'After unlocking',
      triggerLock: 'On locking',
      triggerMigration: 'Before a database upgrade',
      triggerManual: 'Manual',
      triggerPreRestore: 'Before a restore',
      triggerAdopted: 'Made by an earlier version',
      triggerDestructive: 'Before {{ operation }}',

      localOnlyTitle: 'This journal has no password',
      localOnlyNotice:
        'Its backups are encrypted with a key stored in this app’s settings on this device. Copying the backups folder to another machine is not enough to open them there.',

      listAria: 'Backups, newest first',

      restoreEntriesButton: 'Restore entries…',
      restoreEntriesTitle: 'Restore individual entries',
      restoreEntriesDescription:
        'Browse this backup and copy specific entries into your journal, without touching anything else.',
      credentialPrompt: 'Enter the credential this backup was taken with.',
      credentialDiffersNotice:
        'This backup was taken with a different password or key than your journal uses today. Enter the one it was taken with, not today’s.',
      viewEntriesButton: 'View entries',
      viewingEntriesFor: 'Viewing entries from {{ when }}',
      readOnlyNotice: 'Read-only. Nothing changes until you choose to restore.',
      loadingEntries: 'Loading entries…',
      noEntries: 'This backup has no entries.',
      statusMissing: 'Missing from your journal',
      statusShorter: 'Shorter in your journal',
      statusPresent: 'Already in your journal',
      selectAllMissing: 'Select all missing or shorter',
      entriesSelectedCount_one: '{{ count }} entry selected',
      entriesSelectedCount_other: '{{ count }} entries selected',
      restoreSelectedButton: 'Restore selected',
      restoringEntries: 'Restoring…',
      restoreEntriesSuccess_one:
        '{{ count }} entry added. Nothing already in your journal was overwritten.',
      restoreEntriesSuccess_other:
        '{{ count }} entries added. Nothing already in your journal was overwritten.',
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
      recalculateTitle: 'Word Counts',
      recalculateHint:
        "Recalculates the word count for every entry in this journal. Locked entries are skipped, and this does not change any entry's last-modified date.",
      recalculateButton: 'Recalculate Word Counts',
      recalculating: 'Recalculating…',
      recalculateSummary_one: 'Checked {{ scanned }} entry, updated {{ updated }}.',
      recalculateSummary_other: 'Checked {{ scanned }} entries, updated {{ updated }}.',
      recalculateSkippedLocked_one: '{{ count }} locked entry was skipped.',
      recalculateSkippedLocked_other: '{{ count }} locked entries were skipped.',
      recalculateError: 'Failed to recalculate word counts.',
      experimentalTitle: 'Experimental Features',
      experimentalHint:
        'These features are still in development and may change or be removed. Enable them at your own risk.',
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
    description: 'Export journal entries to a file',
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
    filterModeLabel: 'Filter',
    filterAll: 'All entries',
    filterDateRange: 'Date range',
    filterMonth: 'Single month',
    dateFromLabel: 'From',
    dateToLabel: 'To',
    monthLabel: 'Month',
    printFormat: 'Print / PDF',
    print: 'Print',
    printing: 'Printing...',
    printGeneratedLabel: 'Generated:',
    printTagsLabel: 'Tags:',
    printNoEntries: 'No entries found.',
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
    githubLink: 'GitHub',
    docsLink: 'Documentation',
    opensInBrowser: 'opens in system browser',
    showTour: 'Show Welcome Tour',
    supportLink: 'Support Mini Diarium',
  },

  /** NotificationsOverlay */
  notifications: {
    title: "What's New",
    closeAria: 'Close notifications',
    empty: 'No announcements yet.',
    markRead: 'Mark read',
    markReadAria: 'Mark this notification as read',
    dismissAll: 'Mark all read',
    typeRelease: 'Release',
    typeAnnouncement: 'Announcement',
    typeTip: 'Tip',
    readMore: 'Read more',
    readMoreAria: 'Read more about {{ title }}',
    detailCloseAria: 'Close notification detail',
  },

  /** ProjectSupportOverlay — reached via the streak-triggered Header icon or the
   * About screen's "Support Mini Diarium" button. */
  support: {
    title: 'Support Mini Diarium',
    closeAria: 'Close',
    headerIconAria: 'Support Mini Diarium',
    openingLineAbout:
      'Mini Diarium is free, encrypted, and has no ads or tracking. If it has been useful to you, here are a few ways to help it keep going.',
    openingLineMilestone:
      "You've journaled a {{ streak }}-day streak and written {{ words }} words. If Mini Diarium has helped you keep that habit, here are a few ways to support it.",
    footerDefault: 'Any one of these helps more than you might think.',
    footerThanked: 'Thank you for supporting Mini Diarium!',
    itemStarLabel: 'Star the project on GitHub',
    itemStarButton: 'Star on GitHub',
    itemReviewLabel: 'Leave a review on the Microsoft Store',
    itemReviewButton: 'Leave a review',
    itemShareLabel: 'Share Mini Diarium with a friend',
    itemShareButton: 'Copy share message',
    itemNewsletterLabel: 'Subscribe to the newsletter',
    itemNewsletterButton: 'Subscribe',
    itemContributeLabel: 'Contribute code, translations, or ideas',
    itemContributeButton: 'Contribute',
    itemDonateLabel: 'Make a donation',
    itemDonateButton: 'Donate',
    shareMessage:
      "I've been using Mini Diarium, a free encrypted journaling app with no ads or tracking. Worth a look: https://mini-diarium.com/",
    shareCopyFailed: "Couldn't copy — copy this yourself: {{ message }}",
  },

  /** TimestampOverlay */
  timestamp: {
    popupTitle: 'Insert Timestamp',
    formatLabel: 'Time format',
    format12h: '12-hour (AM/PM)',
    format24h: '24-hour',
    precisionLabel: 'Precision',
    precisionHm: 'HH:mm',
    precisionHms: 'HH:mm:ss',
    insert: 'Insert',
  },

  /** LinkOverlay — insert/edit/remove named hyperlinks */
  link: {
    insertTitle: 'Insert link',
    editTitle: 'Edit link',
    wrapSelectionTitle: 'Add link',
    urlLabel: 'URL',
    urlPlaceholder: 'example.com or https://…',
    urlRequiredError: 'Please enter a URL.',
    labelLabel: 'Display text',
    labelPlaceholder: 'Link text (optional)',
    labelHint: 'If left empty, the URL is used as the visible text.',
    openInBrowserHint:
      'Hold Ctrl (Cmd on macOS) and click a link in the editor to open it in your browser. Plain click just places the cursor for editing.',
    tooltipOpen: '{{ shortcut }} to open',
    insert: 'Insert',
    update: 'Update',
    apply: 'Apply',
    remove: 'Remove link',
  },

  /** GoToDateOverlay */
  goToDate: {
    title: 'Go to Date',
    description: 'Jump to a specific date in your journal.',
    selectDateLabel: 'Select Date',
    goToDate: 'Go to Date',
    closeAria: 'Close',
  },

  /** Tags — per-entry tagging and tag management */
  tags: {
    addTag: 'Add tag',
    newTag: 'New tag…',
    create: 'Create "{{ name }}"',
    manageTags: 'Manage tags',
    noTags: 'No tags yet',
    tagManager: 'Tag Manager',
    rename: 'Rename',
    deleteTag: 'Delete tag',
    entriesWithTag_one: '{{ count }} entry',
    entriesWithTag_other: '{{ count }} entries',
    errorLoading: 'Failed to load tags',
    errorSaving: 'Failed to save tag',
    filterByTag: 'Filter by tag',
    filterActiveLabel: 'Tag filter:',
    clearFilter: 'Clear tag filter',
  },

  /** Onboarding tour — first-run step-by-step guide */
  onboarding: {
    title: 'Welcome to Mini Diarium',
    subtitle: 'A few things to get you started:',
    tip_toolbar_title: 'Customize your toolbar',
    tip_toolbar_body:
      'The default toolbar only shows Bold and Italic. Open Preferences → Writing to enable more tools (headings, colors, lists, alignment) and reorder them to your liking.',
    tip_toolbar_action: 'Open Preferences',
    tip_import_title: 'Import your entries',
    tip_import_body: 'Bring in entries from Day One, Obsidian, or plain text files.',
    tip_import_action: 'Open Import',
    tip_docs_title: 'Full documentation online',
    tip_docs_body:
      'The Mini Diarium website has full documentation covering every feature: keyboard shortcuts, toolbar options, import formats, encryption details, and more.',
    tip_docs_action: 'Open Docs',
    dismiss: 'Dismiss',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    minimize: 'Minimize tour',
    helpAria: 'Open onboarding tips',
    popoverHint: 'Resume the quick-start tour or dismiss it permanently.',
    resumeTour: 'Resume Tour',
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
    entryLocked: 'This entry is locked. Unlock it to make changes.',
    cannotRemoveLastAuth: 'Cannot remove the last authentication method.',
    cannotReadKeyFile:
      'Could not read key file. Check that the file exists and you have permission to read it.',
    cannotSaveKeyFile: 'Could not save key file. Check folder permissions.',
    fileOperationFailed: 'A file operation failed. Check that you have the necessary permissions.',
    portalPathRejected:
      'That folder is only shared with Mini Diarium temporarily, so a journal saved there would stop opening later. Use the default location instead.',
    backupFileRejected:
      'That file is a backup snapshot. Opening it directly would change it. Copy it somewhere else first, then open the copy.',
    journalAlreadyRegistered:
      'That journal is already in your list. Open it from the list above instead of adding it again.',
    internalError: 'An internal error occurred.',
    unexpectedError: 'An unexpected error occurred.',
  },
} as const;

export default en;
export type Locale = typeof en;
