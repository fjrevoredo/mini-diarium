 Implementation Plan: mini-diarium from Scratch

---
## IMPLEMENTATION STATUS (Updated: 2026-02-15)

**Progress: 28/47 Tasks Complete (60%)**

- ✅ **Phase 1: Foundation & Core Infrastructure** (Tasks 1-28) - **COMPLETE**
- ⏳ **Phase 2: Search, Navigation & Preferences** (Tasks 29-33) - **NOT STARTED**
- ⏳ **Phase 3: Import, Export, Theming** (Tasks 34-44) - **NOT STARTED**
- ⏳ **Phase 4: Backup & Advanced Features** (Tasks 45-46) - **NOT STARTED**
- ⏳ **Phase 5: Internationalization** (Task 47) - **NOT STARTED**

**Most Recent Completions:**
- Task 25: Word Count Display
- Task 26: Calendar Navigation (verified existing)
- Task 27: Date Navigation Shortcuts (keyboard + menu)
- Task 28: Go To Date Overlay (Kobalte dialog)

**Next Up:** Task 29 - Future Date Restriction Preference

---

 Context                                                                                                    
                                                                                                            
 Why: Build a modern, encrypted, local-first desktop journaling application as a spiritual successor to Mini
 Diary. The project aims to reimagine journaling software with modern technologies (Tauri 2.x, SolidJS, Rust)    │
 while maintaining privacy and simplicity as core principles.                                               
                                                                                                            
 Current State:                                                                                             
 - Repository has only documentation: README.md, LICENSE, REQUIREMENTS.md, IMPLEMENTATION_PLAN.md           
 - No source code exists (no src/, src-tauri/, configuration files)                                         
 - Branch: initial-implementation                                                                           
                                                                                                            
 What We're Building:                                                                                       
 - Desktop app: Tauri 2.x (Rust backend) + SolidJS (frontend)                                               
 - Encrypted storage: SQLite with AES-256-GCM + Argon2id                                                    
 - Rich text editing: TipTap with Markdown support                                                          
 - Features: Full-text search (FTS5), import/export (4 input formats, 3 output formats), theming, i18n      
 (English/Spanish)                                                                                          
                                                                                                            
 User Requirements:                                                                                         
 1. Implement from scratch (project initialization required)                                                
 2. Incremental feature adding (each step functional and testable)                                          
 3. Leave E2E testing for the end (but include unit/integration tests throughout)                           
                                                                                                            
 ---                                                                                                        
 Implementation Approach                                                                                    
                                                                                                            
 The implementation follows 5 phases with 40+ incremental steps, each producing a working, testable milestone.   │
                                                                                                            
 Phase 1: Foundation & Core Infrastructure (28 tasks) - ✅ COMPLETE

 Goal: Buildable Tauri app with authentication, encrypted database, basic editor, and calendar.

 Project Setup (Tasks 1-3)

 ✅ 1. Initialize Tauri + SolidJS project                                                                      
   - Run bun create tauri-app with SolidJS template                                                         
   - Configure project: name "mini-diarium", identifier "com.minidiarium.app"                               
   - Verify: bun tauri dev opens window with "Hello from Tauri + SolidJS"                                   
 2. Configure development tooling                                                                           
   - Install: ESLint + eslint-plugin-solid, Prettier, TypeScript strict mode                                
   - Set up: Rust clippy and rustfmt, UnoCSS + Vite plugin                                                  
   - Add scripts: lint, format, type-check                                                                  
   - Verify: bun run lint && bun run format:check && bun run type-check                                     
 3. Create project folder structure                                                                         
   - Frontend: src/{components/{auth,layout,editor,calendar,search,overlays,ui}, state, lib, styles, types} 
   - Backend: src-tauri/src/{commands,crypto,db,import,export,backup,i18n}                                  
                                                                                                            
 Rust Backend - Crypto & Database (Increments 1.4-1.7)                                                      
                                                                                                            
 4. Implement Argon2id password hashing                                                                     
   - File: src-tauri/src/crypto/password.rs                                                                 
   - Functions: hash_password(), generate_salt(), verify_password()                                         
   - Params: m=64MB, t=3, p=4                                                                               
   - Test: cargo test --lib crypto::password (100% coverage)                                                
 5. Implement AES-256-GCM encryption                                                                        
   - File: src-tauri/src/crypto/cipher.rs                                                                   
   - Functions: encrypt(), decrypt() with random nonces                                                     
   - Use: aes-gcm crate, zeroize for key clearing                                                           
   - Test: cargo test --lib crypto::cipher (roundtrip, wrong key, tampering)                                
 6. Create SQLite database schema                                                                           
   - File: src-tauri/src/db/schema.rs                                                                       
   - Tables: entries, entries_fts (FTS5), metadata, schema_version                                          
   - Triggers: Auto-sync FTS index on INSERT/UPDATE/DELETE                                                  
   - Functions: create_database(), open_database()                                                          
   - Test: cargo test --lib db:: (create, open, wrong password)                                             
 7. Implement entry CRUD operations                                                                         
   - File: src-tauri/src/db/queries.rs                                                                      
   - Functions: insert_entry(), get_entry(), update_entry(), delete_entry(), get_all_entry_dates()          
   - Test: Rust unit tests for all CRUD operations                                                          
                                                                                                            
 Tauri Commands (Increments 1.8-1.9)                                                                        
                                                                                                            
 8. Implement authentication commands                                                                       
   - File: src-tauri/src/commands/auth.rs                                                                   
   - Commands: create_diary(), unlock_diary(), lock_diary(), change_password(), reset_diary()               
   - Use Tauri managed state for database connection                                                        
   - Register in main.rs                                                                                    
   - Test: Integration tests with Tauri test helpers                                                        
 9. Implement entry CRUD commands                                                                           
   - File: src-tauri/src/commands/entries.rs                                                                
   - Commands: save_entry(), get_entry(), delete_entry_if_empty(), get_all_entry_dates()                    
   - Auto-update date_updated timestamp                                                                     
   - Test: Integration tests                                                                                
                                                                                                            
 Frontend - Authentication & Layout (Increments 1.10-1.12)                                                  
                                                                                                            
 10. Build Password Creation screen                                                                         
   - File: src/components/auth/PasswordCreation.tsx                                                         
   - Form: Two password inputs (Password, Repeat Password)                                                  
   - Validation: Passwords must match                                                                       
   - State: src/state/auth.ts with signals                                                                  
   - IPC: src/lib/tauri.ts with typed wrappers                                                              
   - Test: Solid Testing Library component tests                                                            
 11. Build Password Prompt screen                                                                           
   - File: src/components/auth/PasswordPrompt.tsx                                                           
   - Form: Single password input                                                                            
   - On success: Load entry dates, transition to diary view                                                 
   - Test: Wrong password shows error, correct password transitions                                         
 12. Build two-panel layout                                                                                 
   - Files: src/components/layout/{Sidebar,EditorPanel,Header}.tsx                                          
   - Layout: src/App.tsx with conditional rendering:                                                        
       - No diary → PasswordCreation                                                                        
     - Locked → PasswordPrompt                                                                              
     - Unlocked → Sidebar + EditorPanel                                                                     
   - Style: UnoCSS grid/flex, responsive (sidebar collapses on mobile)                                      
                                                                                                            
 Editor & Calendar (Increments 1.13-1.19)                                                                   
                                                                                                            
 13. Set up TipTap editor with Markdown                                                                     
   - File: src/components/editor/DiaryEditor.tsx                                                            
   - Extensions: StarterKit, Markdown                                                                       
   - Controlled component with SolidJS signals                                                              
   - Methods: getMarkdown(), setMarkdown()                                                                  
   - Test: Component tests for Markdown roundtrip                                                           
 14. Implement title editor                                                                                 
   - File: src/components/editor/TitleEditor.tsx                                                            
   - Plain text only (no formatting)                                                                        
   - Enter key → move focus to body editor                                                                  
   - Integrate into EditorPanel above DiaryEditor                                                           
 15. Implement auto-save with debouncing                                                                    
   - State: src/state/entries.ts                                                                            
   - Utility: src/lib/debounce.ts                                                                           
   - Debounce: 500ms after typing stops                                                                     
   - Also save: On blur, on window unload                                                                   
   - Test: Mock timer, verify save called after 500ms                                                       
 16. Build basic calendar widget                                                                            
   - File: src/components/calendar/Calendar.tsx                                                             
   - Use: @kobalte/core Calendar component                                                                  
   - Highlight: Currently selected date                                                                     
   - On click: Update selectedDate in src/state/ui.ts                                                       
   - Dates: src/lib/dates.ts with Temporal utilities                                                        
   - Test: Clicking day selects date                                                                        
 17. Highlight calendar days with entries                                                                   
   - On unlock: Fetch all entry dates via get_all_entry_dates()                                             
   - Store: src/state/entries.ts                                                                            
   - Style: .has-entry class for days with entries (dot/bold/background)                                    
   - Test: Create entries, verify calendar highlights                                                       
 18. Integrate calendar with editor                                                                         
   - On day click: Update selectedDate, load entry (or clear if empty)                                      
   - On save: Update entry dates list                                                                       
   - Header: Display selected date (formatted: "Tuesday, January 1, 2019")                                  
   - Test: Navigate dates, verify entry loads/clears                                                        
 19. Implement empty entry auto-deletion                                                                    
   - On save: If title and text are empty, call delete_entry_if_empty()                                     
   - Update: Entry dates list, remove calendar highlight                                                    
   - Test: Clear entry content, verify deletion                                                             
                                                                                                            
 Phase 1 Deliverable: Functional journaling app where users can create a password-protected diary, write daily   │
 entries with rich text, navigate dates via a calendar, and have entries auto-saved.                        
                                                                                                            
 ---                                                                                                        
 Phase 2: Core Features (14 increments)                                                                     
                                                                                                            
 Goal: Full-text search, formatting toolbar, statistics, date navigation, preferences.                      
                                                                                                            
 Search (Increments 2.1-2.4)                                                                                
                                                                                                            
 20. Implement SQLite FTS5 search                                                                           
   - File: src-tauri/src/commands/search.rs                                                                 
   - Command: search_entries(query) -> Vec<SearchResult>                                                    
   - Query: SELECT date, title FROM entries_fts WHERE entries_fts MATCH ?                                   
   - Sort: By relevance (rank)                                                                              
   - Test: Rust unit tests (title match, text match, prefix)                                                
 21. Build search bar UI                                                                                    
   - File: src/components/search/SearchBar.tsx                                                              
   - Debounce: 500ms (immediate on clear)                                                                   
   - Store: src/state/search.ts                                                                             
   - Clear button: X icon to reset                                                                          
   - Test: Debounce verification                                                                            
 22. Build search results list                                                                              
   - File: src/components/search/SearchResults.tsx                                                          
   - Display: Date + title (or "No title" faded/italic)                                                     
   - On click: Navigate to date                                                                             
   - Empty state: "No results" banner                                                                       
   - Sort: Newest first                                                                                     
   - Test: Display, navigation, empty state                                                                 
 23. Implement "Go To Today" button                                                                         
   - Location: Sidebar next to search                                                                       
   - On click: Set selectedDate to today                                                                    
   - Disabled: If today already selected                                                                    
   - Icon: Lucide CalendarToday                                                                             
                                                                                                            
 Editor Enhancements (Increments 2.5-2.6)                                                                   
                                                                                                            
 24. Build editor toolbar                                                                                   
   - File: src/components/editor/EditorToolbar.tsx                                                          
   - Buttons: Bold (Ctrl/Cmd+B), Italic (Ctrl/Cmd+I), Unordered List, Ordered List                          
   - Active state: Highlight when formatting applied                                                        
   - Icons: Lucide                                                                                          
   - Test: Toggle formatting, verify active state                                                           
 25. Implement word count display                                                                           
   - File: src/components/editor/WordCount.tsx                                                              
   - Count: From persisted data (not live editor)                                                           
   - Update: After auto-save completes                                                                      
   - Display: "X words"                                                                                     
   - Test: Mock entry, verify display                                                                       
                                                                                                            
 Calendar & Navigation (Increments 2.7-2.9)                                                                 
                                                                                                            
 26. Implement calendar navigation                                                                          
   - File: src/components/calendar/CalendarNav.tsx                                                          
   - Buttons: Previous/next month                                                                           
   - Header: "January 2024"                                                                                 
   - Date math: Temporal API                                                                                
   - Test: Navigate months                                                                                  
 27. Implement date navigation shortcuts                                                                    
   - Create Tauri application menu                                                                          
   - Items: Previous Day (Left), Next Day (Right), Go To Today (Ctrl/Cmd+T), Previous Month (Ctrl/Cmd+Left),
 Next Month (Ctrl/Cmd+Right)                                                                                
   - Platform: macOS app menu, Windows/Linux File menu                                                      
   - Test: Manual keyboard shortcuts                                                                        
 28. Build "Go To Date" overlay                                                                             
   - File: src/components/overlays/GoToDateOverlay.tsx                                                      
   - Use: Kobalte Dialog (accessible modal)                                                                 
   - Input: <input type="date">                                                                             
   - Submit: Disabled if invalid/unchanged/future (if restricted)                                           
   - On submit: Navigate and close                                                                          
   - State: src/state/ui.ts for overlay management                                                          
                                                                                                            
 Preferences (Increments 2.10-2.13)                                                                         
                                                                                                            
 29. Implement future date restriction                                                                      
   - Preference: allowFutureEntries: boolean (default: false)                                               
   - Disable: Future days in calendar when false                                                            
   - Clamp: "Next Day" navigation to today if disabled                                                      
   - Test: Toggle preference, verify behavior                                                               
 30. Implement first day of week preference                                                                 
   - Preference: firstDayOfWeek: 0-6 | null (null = system locale)                                          
   - File: src/components/overlays/PreferencesOverlay.tsx (initial version)                                 
   - Dropdown: Sunday-Saturday, System Default                                                              
   - Apply: Calendar rendering                                                                              
   - Test: Change preference, verify calendar updates                                                       
 31. Implement hide titles preference                                                                       
   - Preference: hideTitles: boolean (default: false)                                                       
   - When enabled: Hide TitleEditor component                                                               
   - Entries: Still store title data                                                                        
   - Test: Toggle, verify visibility                                                                        
 32. Implement spellcheck preference                                                                        
   - Preference: enableSpellcheck: boolean (default: true)                                                  
   - Apply: spellCheck HTML attribute on editors                                                            
   - Test: Manual (browser feature)                                                                         
                                                                                                            
 Statistics (Increment 2.14)                                                                                
                                                                                                            
 33. Build statistics overlay                                                                               
   - File: src-tauri/src/commands/stats.rs                                                                  
   - Command: get_statistics() -> Statistics                                                                
   - Metrics: Total entries, entries/week, best streak, current streak, total words, words/entry            
   - UI: src/components/overlays/StatsOverlay.tsx                                                           
   - Format: Locale separators, max 1 decimal                                                               
   - Test: Rust unit tests for streak calculation                                                           
                                                                                                            
 Phase 2 Deliverable: Feature-complete journaling app with search, formatting toolbar, word count, statistics,   │
 and all calendar navigation features.                                                                      
                                                                                                            
 ---                                                                                                        
 Phase 3: Import, Export, Theming, Backups (13 increments)                                                  
                                                                                                            
 Goal: Full import/export capability (4 formats in, 3 formats out), theming, backups.                       
                                                                                                            
 Import - Mini Diary JSON (Increments 3.1-3.3)                                                              
                                                                                                            
 34. Parse Mini Diary JSON                                                                                  
   - File: src-tauri/src/import/minidiary.rs                                                                
   - Structs: MiniDiaryJson matching schema                                                                 
   - Function: parse_minidiary_json() -> Vec<DiaryEntry>                                                    
   - Handle: Metadata version checking                                                                      
   - Test: Rust unit tests with fixture files                                                               
 35. Implement entry merging                                                                                
   - File: src-tauri/src/import/merge.rs                                                                    
   - Function: merge_entries(existing, imported) -> DiaryEntry                                              
   - Titles: Concatenate with " | "                                                                         
   - Texts: Concatenate with "\n\n––––––––––\n\n"                                                           
   - Test: Rust unit tests                                                                                  
 36. Build import UI for Mini Diary JSON                                                                    
   - Command: import_minidiary_json(file_path) -> Result<usize>                                             
   - UI: src/components/overlays/ImportOverlay.tsx                                                          
   - Elements: Format dropdown, file picker (Tauri dialog), "Start Import" button                           
   - Show: Progress/error, rebuild FTS index after import                                                   
   - Test: Integration test                                                                                 
                                                                                                            
 Import - Other Formats (Increments 3.4-3.6)                                                                
                                                                                                            
 37. Implement Day One JSON import                                                                          
   - File: src-tauri/src/import/dayone.rs                                                                   
   - Parse: creationDate → date, split text on \n\n for title/body                                          
   - Handle: Timezone conversion                                                                            
   - Add: To import command and UI                                                                          
   - Test: Rust unit tests with fixture                                                                     
 38. Implement jrnl JSON import                                                                             
   - File: src-tauri/src/import/jrnl.rs                                                                     
   - Parse: Direct mapping (date, title, body)                                                              
   - Add: To import command and UI                                                                          
   - Test: Rust unit tests with fixture                                                                     
 39. Implement Day One TXT import                                                                           
   - File: src-tauri/src/import/dayone_txt.rs                                                               
   - Parse: Split on \tDate:\t, parse "DD MMMM YYYY" format                                                 
   - Add: To import command and UI                                                                          
   - Test: Rust unit tests with fixture                                                                     
                                                                                                            
 Export (Increments 3.7-3.9)                                                                                
                                                                                                            
 40. Implement JSON export                                                                                  
   - File: src-tauri/src/export/json.rs                                                                     
   - Function: export_to_json() -> String                                                                   
   - Format: Pretty-printed JSON with tabs                                                                  
   - Command: export_json(), menu item, save dialog                                                         
   - Test: Rust unit tests                                                                                  
 41. Implement Markdown export                                                                              
   - File: src-tauri/src/export/markdown.rs                                                                 
   - Format: # Mini Diary\n\n## [Date]\n**[Title]**\n[Text]\n\n                                             
   - Command: export_markdown(), menu item, save dialog                                                     
   - Test: Rust unit tests                                                                                  
 42. Implement PDF export                                                                                   
   - File: src-tauri/src/export/pdf.rs                                                                      
   - Convert: Markdown → HTML → PDF (A4 page size)                                                          
   - Library: Consider chromiumoxide or Tauri webview printing                                              
   - Command: export_pdf(), menu item, save dialog                                                          
   - Note: Complex, may defer to later                                                                      
   - Test: Manual testing                                                                                   
                                                                                                            
 Theming & Preferences (Increments 3.10-3.11)                                                               
                                                                                                            
 43. Implement theme system                                                                                 
   - File: src/lib/theme.ts                                                                                 
   - Preference: themePref: 'auto' | 'light' | 'dark' (default: 'auto')                                     
   - OS detection: Tauri theme() API                                                                        
   - Apply: CSS class .theme-light or .theme-dark                                                           
   - Listen: OS theme changes (Tauri event)                                                                 
   - CSS: Custom properties in src/styles/themes/                                                           
   - Test: Auto follows OS, manual override                                                                 
 44. Build complete preferences overlay                                                                     
   - File: src/components/overlays/PreferencesOverlay.tsx (expanded)                                        
   - Sections:                                                                                              
       - Theme (always visible)                                                                             
     - First day of week (unlocked only)                                                                    
     - Diary entries: future entries, hide titles, spellcheck (unlocked only)                               
     - Diary file: path, change directory, reset diary (always visible, directory hidden in sandboxed builds)    │
     - Password: change password (unlocked only)                                                            
   - Persistence: Tauri settings plugin                                                                     
   - Test: Integration tests for each preference                                                            
                                                                                                            
 Backups & File Management (Increments 3.12-3.13)                                                           
                                                                                                            
 45. Implement backup system                                                                                
   - File: src-tauri/src/backup/mod.rs                                                                      
   - On unlock: Copy DB to <userData>/backups/                                                              
   - Filename: backup-YYYY-MM-DD-HHhMM.db                                                                   
   - Rotation: Keep max 50, delete oldest                                                                   
   - Test: Rust unit tests for rotation                                                                     
 46. Implement diary file directory selection                                                               
   - Command: change_diary_directory(new_path) -> Result<()>                                                
   - Unlocked: Move file to new directory                                                                   
   - Locked: Update preference only                                                                         
   - Check: Existing file at new location                                                                   
   - Test: Integration tests                                                                                
                                                                                                            
 Phase 3 Deliverable: Full import/export support (4 import formats, 3 export formats), complete theming,    
 comprehensive preferences, automatic backups.                                                              
                                                                                                            
 ---                                                                                                        
 Phase 4: Internationalization, Polish, Distribution (12 increments)                                        
                                                                                                            
 Goal: Multi-language support (English/Spanish), accessibility, auto-updates, release packaging.            
                                                                                                            
 Internationalization (Increments 4.1-4.2)                                                                  
                                                                                                            
 47. Set up i18n framework                                                                                  
   - Backend: src-tauri/src/i18n/mod.rs for menu translations                                               
   - Frontend: src/i18n/{en.json,es.json}, src/lib/i18n.ts                                                  
   - Detect: OS language via Tauri locale API                                                               
   - Fallback: English for unsupported locales                                                              
   - Keys: 145+ translation keys                                                                            
   - Test: Translation loading and fallback                                                                 
 48. Translate all UI text                                                                                  
   - Replace: All hardcoded strings with t('key')                                                           
   - Named substitution: t('import-from', { format: 'JSON' })                                               
   - Backend: Translate menu items                                                                          
   - Spanish: Complete translations for all keys                                                            
   - Test: Manual testing in both languages                                                                 
                                                                                                            
 Platform-Specific Features (Increments 4.3-4.5)                                                            
                                                                                                            
 49. Implement platform-specific menus                                                                      
   - File: src-tauri/src/menu.rs                                                                            
   - macOS: App menu (About, Preferences, Quit)                                                             
   - Windows/Linux: File menu (Preferences, Exit)                                                           
   - All: File, Edit, View, Help menus                                                                      
   - State: Disable items when locked                                                                       
   - Shortcuts: Register accelerators                                                                       
   - Test: Manual on each platform                                                                          
 50. Implement screen lock auto-lock                                                                        
   - Listen: Screen lock event (macOS, Windows)                                                             
   - On lock: Call lock_diary(), clear DB connection                                                        
   - Test: Manual (lock screen, verify diary locked)                                                        
 51. Implement auto-update system                                                                           
   - Plugin: Tauri updater                                                                                  
   - On launch: checkUpdate()                                                                               
   - Download: Install with user notification                                                               
   - Skip: Mac App Store builds                                                                             
   - Handle: Network errors gracefully                                                                      
   - Test: Manual with test update server                                                                   
                                                                                                            
 Accessibility & Migration (Increments 4.6-4.7)                                                             
                                                                                                            
 52. Accessibility audit and improvements                                                                   
   - ARIA labels: All interactive elements                                                                  
   - Focus management: Trap inside overlays, return on close                                                
   - Keyboard nav: Calendar arrow keys                                                                      
   - Semantic HTML: Headings, landmarks, labels                                                             
   - Screen reader: Test with NVDA/VoiceOver                                                                
   - Contrast: 4.5:1 ratio                                                                                  
   - Focus indicators: Visible outlines                                                                     
   - Test: Automated (axe-core)                                                                             
 53. Implement Mini Diary legacy migration                                                                  
   - File: src-tauri/src/import/minidiary_legacy.rs                                                         
   - Decrypt: PBKDF2-SHA512 + AES-192-CBC (deprecated)                                                      
   - Command: import_minidiary_legacy(file_path, password) -> Result<usize>                                 
   - Apply: v2.0.0 Markdown migration if needed                                                             
   - Merge: Entries into database                                                                           
   - UI: Add to ImportOverlay                                                                               
   - Test: Rust unit tests with Mini Diary encrypted fixture                                                
                                                                                                            
 CI/CD & Release (Increments 4.8-4.12)                                                                      
                                                                                                            
 54. Set up CI/CD pipeline                                                                                  
   - File: .github/workflows/ci.yml                                                                         
   - Jobs: Lint (ESLint, Prettier, Clippy, rustfmt), Test (frontend, Rust), Build (macOS, Windows, Linux)   
   - Use: tauri-apps/tauri-action@v0                                                                        
   - Artifacts: Upload builds                                                                               
   - Trigger: On push and PR                                                                                
   - Test: Push to GitHub, verify workflow                                                                  
 55. Configure Tauri bundler                                                                                
   - File: tauri.conf.json                                                                                  
   - macOS: DMG, app bundle                                                                                 
   - Windows: MSI, NSIS                                                                                     
   - Linux: AppImage, DEB                                                                                   
   - Code signing: Developer ID (macOS), certificate (Windows)                                              
   - Metadata: Name, version, description, icon                                                             
   - Test: Manual on each platform                                                                          
 56. Write end-user documentation                                                                           
   - README.md: Screenshots, features, installation, downloads, quick start                                 
   - docs/USER_GUIDE.md: Detailed feature explanations, how-to guides, FAQ                                  
   - docs/PRIVACY.md: Privacy policy                                                                        
   - Test: Manual review                                                                                    
 57. Prepare open source release                                                                            
   - Files: LICENSE (MIT), CONTRIBUTING.md, CODE_OF_CONDUCT.md (Contributor Covenant), SECURITY.md, CHANGELOG.md │
  (Keep a Changelog)                                                                                        
   - GitHub: Issue templates (Bug Report, Feature Request), PR template                                     
   - Dependabot: Configure for updates                                                                      
   - Test: Manual review                                                                                    
 58. Final QA pass                                                                                          
   - Test: All workflows on macOS, Windows, Linux                                                           
   - Workflows: Setup, journaling, search, import/export (all formats), stats, preferences, password change,
 theme switching                                                                                            
   - Verify: No critical bugs (P0/P1)                                                                       
   - Benchmarks: Performance targets (see IMPLEMENTATION_PLAN.md section 5.2)                               
   - Installer: < 20 MB                                                                                     
   - Test: Manual QA checklist                                                                              
                                                                                                            
 Phase 4 Deliverable: Production-ready v1.0 release with bilingual support (English/Spanish), accessibility,
 auto-updates, and platform installers.                                                                     
                                                                                                            
 ---                                                                                                        
 Phase 5: End-to-End Testing (2 increments)                                                                 
                                                                                                            
 Goal: Automated E2E tests for all critical user workflows (deferred to end per user request).              
                                                                                                            
 E2E Testing (Increments 5.1-5.2)                                                                           
                                                                                                            
 59. Set up Playwright for E2E testing                                                                      
   - Install: bun add -d @playwright/test                                                                   
   - Config: playwright.config.ts for Tauri app                                                             
   - Fixtures: tests/e2e/fixtures/                                                                          
   - Helpers: tests/e2e/helpers/                                                                            
   - Verify: bun playwright test runs                                                                       
 60. Write E2E tests for critical workflows                                                                 
   - Tests:                                                                                                 
       i. First-time setup (create password, create entry)                                                  
     ii. Unlock diary, navigate dates, edit entry                                                           
     iii. Search entries                                                                                    
     iv. Import Mini Diary JSON                                                                             
     v. Export to JSON and Markdown                                                                         
     vi. Change preferences                                                                                 
     vii. Lock/unlock diary                                                                                 
     viii. Theme switching                                                                                  
   - Run: bun playwright test                                                                               
   - Verify: All tests pass on all platforms                                                                
                                                                                                            
 Phase 5 Deliverable: Comprehensive E2E test coverage for all major features.                               
                                                                                                            
 ---                                                                                                        
 Critical Files to Create (In Order of Implementation)                                                      
                                                                                                            
 Phase 1 - Foundation                                                                                       
                                                                                                            
 1. package.json - Frontend dependencies (SolidJS, TipTap, UnoCSS, Kobalte, testing)                        
 2. src-tauri/Cargo.toml - Rust dependencies (argon2, aes-gcm, rusqlite, zeroize, Tauri plugins)            
 3. src-tauri/src/crypto/password.rs - Argon2id password hashing (security-critical)                        
 4. src-tauri/src/crypto/cipher.rs - AES-256-GCM encryption (security-critical)                             
 5. src-tauri/src/db/schema.rs - Database schema (entries, FTS5, metadata)                                  
 6. src-tauri/src/db/mod.rs - Database initialization and connection management                             
 7. src-tauri/src/db/queries.rs - Entry CRUD operations                                                     
 8. src-tauri/src/commands/auth.rs - Authentication Tauri commands                                          
 9. src-tauri/src/commands/entries.rs - Entry CRUD Tauri commands                                           
 10. src-tauri/src/main.rs - Tauri app entry point with command registration                                
 11. src/App.tsx - Root SolidJS component with routing                                                      
 12. src/state/auth.ts - Authentication state management (signals)                                          
 13. src/state/entries.ts - Entries state management                                                        
 14. src/lib/tauri.ts - Typed Tauri IPC wrappers                                                            
 15. src/components/auth/PasswordCreation.tsx - Password creation UI                                        
 16. src/components/auth/PasswordPrompt.tsx - Password unlock UI                                            
 17. src/components/layout/Sidebar.tsx - Sidebar layout                                                     
 18. src/components/layout/EditorPanel.tsx - Editor panel layout                                            
 19. src/components/editor/DiaryEditor.tsx - TipTap rich text editor                                        
 20. src/components/editor/TitleEditor.tsx - Plain text title field                                         
 21. src/components/calendar/Calendar.tsx - Calendar widget                                                 
                                                                                                            
 Phase 2 - Core Features                                                                                    
                                                                                                            
 22. src-tauri/src/commands/search.rs - FTS5 search command                                                 
 23. src-tauri/src/commands/stats.rs - Statistics calculation                                               
 24. src/components/search/SearchBar.tsx - Search input                                                     
 25. src/components/search/SearchResults.tsx - Search results list                                          
 26. src/components/editor/EditorToolbar.tsx - Formatting toolbar                                           
 27. src/components/overlays/PreferencesOverlay.tsx - Preferences UI                                        
 28. src/components/overlays/StatsOverlay.tsx - Statistics display                                          
 29. src/components/overlays/GoToDateOverlay.tsx - Date jump dialog                                         
                                                                                                            
 Phase 3 - Import/Export/Theming                                                                            
                                                                                                            
 30. src-tauri/src/import/minidiary.rs - Mini Diary JSON parser                                             
 31. src-tauri/src/import/merge.rs - Entry merging logic                                                    
 32. src-tauri/src/import/dayone.rs - Day One JSON parser                                                   
 33. src-tauri/src/import/jrnl.rs - jrnl JSON parser                                                        
 34. src-tauri/src/import/dayone_txt.rs - Day One TXT parser                                                
 35. src-tauri/src/export/json.rs - JSON export                                                             
 36. src-tauri/src/export/markdown.rs - Markdown export                                                     
 37. src-tauri/src/export/pdf.rs - PDF export (optional, complex)                                           
 38. src/components/overlays/ImportOverlay.tsx - Import UI                                                  
 39. src/lib/theme.ts - Theme management                                                                    
 40. src/styles/themes/light.css - Light theme CSS variables                                                
 41. src/styles/themes/dark.css - Dark theme CSS variables                                                  
 42. src-tauri/src/backup/mod.rs - Backup system                                                            
                                                                                                            
 Phase 4 - i18n/Polish                                                                                      
                                                                                                            
 43. src/i18n/en.json - English translations                                                                
 44. src/i18n/es.json - Spanish translations                                                                
 45. src/lib/i18n.ts - Translation utilities                                                                
 46. src-tauri/src/i18n/mod.rs - Backend translations                                                       
 47. src-tauri/src/menu.rs - Application menu                                                               
 48. src-tauri/src/import/minidiary_legacy.rs - Encrypted Mini Diary import                                 
 49. .github/workflows/ci.yml - CI/CD pipeline                                                              
 50. CONTRIBUTING.md - Contribution guidelines                                                              
 51. docs/USER_GUIDE.md - User documentation                                                                
                                                                                                            
 Phase 5 - E2E Testing                                                                                      
                                                                                                            
 52. playwright.config.ts - Playwright configuration                                                        
 53. tests/e2e/*.spec.ts - E2E test suites                                                                  
                                                                                                            
 ---                                                                                                        
 Verification Approach                                                                                      
                                                                                                            
 Each phase has clear verification steps:                                                                   
                                                                                                            
 Phase 1 Verification                                                                                       
                                                                                                            
 # Rust backend tests                                                                                       
 cargo test --lib crypto::password                                                                          
 cargo test --lib crypto::cipher                                                                            
 cargo test --lib db::                                                                                      
 cargo test --lib commands::                                                                                
                                                                                                            
 # Frontend tests                                                                                           
 bun test                                                                                                   
                                                                                                            
 # Manual verification                                                                                      
 bun tauri dev                                                                                              
 # 1. Create password → verify diary created                                                                
 # 2. Type entry → verify auto-save                                                                         
 # 3. Click calendar → verify navigation                                                                    
 # 4. Lock/unlock → verify persistence                                                                      
                                                                                                            
 Phase 2 Verification                                                                                       
                                                                                                            
 # Manual testing                                                                                           
 bun tauri dev                                                                                              
 # 1. Search entries → verify results                                                                       
 # 2. Use formatting toolbar → verify Bold/Italic/Lists                                                     
 # 3. Check word count → verify accuracy                                                                    
 # 4. View statistics → verify calculations                                                                 
 # 5. Change preferences → verify persistence                                                               
                                                                                                            
 Phase 3 Verification                                                                                       
                                                                                                            
 # Import testing                                                                                           
 bun tauri dev                                                                                              
 # 1. Import each format (Mini Diary, Day One, jrnl) → verify entries                                       
 # 2. Export JSON/Markdown/PDF → verify format                                                              
 # 3. Change theme → verify colors update                                                                   
 # 4. Check backups directory → verify rotation                                                             
                                                                                                            
 Phase 4 Verification                                                                                       
                                                                                                            
 # i18n testing                                                                                             
 bun tauri dev                                                                                              
 # 1. Change OS language → verify UI updates                                                                
 # 2. Test on macOS/Windows/Linux → verify menu structure                                                   
 # 3. Lock screen → verify auto-lock                                                                        
 # 4. Check for updates → verify notification                                                               
                                                                                                            
 # Accessibility testing                                                                                    
 npm install -g @axe-core/cli                                                                               
 axe http://localhost:1420 --tags wcag2a,wcag2aa                                                            
                                                                                                            
 Phase 5 Verification                                                                                       
                                                                                                            
 # E2E testing                                                                                              
 bun playwright test                                                                                        
 # All tests pass on all platforms                                                                          
                                                                                                            
 ---                                                                                                        
 Performance Targets (From IMPLEMENTATION_PLAN.md Section 5.2)                                              
                                                                                                            
 ┌─────────────────────────────────┬──────────────┐                                                         
 │             Metric             Target    │                                                         
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Cold startup to unlock screen   │ < 500 ms                                                         
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Unlock with 1,000 entries   < 1 second   │                                                         
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Entry save (debounced write)    │ < 50 ms                                                          
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Search query (10,000 entries)   │ < 100 ms                                                         
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Export JSON (10,000 entries)    │ < 2 seconds  │                                                         
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Export PDF (10,000 entries) < 10 seconds │                                                         
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Memory usage (idle, diary open) │ < 100 MB                                                         
 ├─────────────────────────────────┼──────────────┤                                                         
 │ Installer size              < 20 MB                                                          
 └─────────────────────────────────┴──────────────┘                                                         
                                                                                                            
 ---                                                                                                        
 Testing Strategy Summary                                                                                   
                                                                                                            
 - Unit tests: After each module implementation (Rust crypto, parsers, utilities)                           
 - Integration tests: After Tauri command implementation                                                    
 - Component tests: After each UI component (Solid Testing Library)                                         
 - E2E tests: Phase 5 only (Playwright)                                                                     
                                                                                                            
 Coverage targets:                                                                                          
 - Rust crypto: 100%                                                                                        
 - Rust import/export: 95%                                                                                  
 - Rust database: 90%                                                                                       
 - Frontend state: 90%                                                                                      
 - Frontend components: 80%                                                                                 
                                                                                                            
 ---                                                                                                        
 Success Criteria                                                                                           
                                                                                                            
 Phase 1 Complete When:                                                                                     
                                                                                                            
 - User can create password-protected diary                                                                 
 - User can write entries with rich text (Markdown)                                                         
 - Calendar navigation works                                                                                
 - Entries persist across sessions                                                                          
 - All unit tests pass                                                                                      
                                                                                                            
 Phase 2 Complete When:                                                                                     
                                                                                                            
 - Full-text search returns accurate results                                                                
 - Editor toolbar formatting works                                                                          
 - Statistics calculate correctly                                                                           
 - All date navigation works                                                                                
 - Preferences persist                                                                                      
                                                                                                            
 Phase 3 Complete When:                                                                                     
                                                                                                            
 - All 4 import formats work                                                                                
 - All 3 export formats work                                                                                
 - Theming (Light/Dark/Auto) works                                                                          
 - Backups create and rotate                                                                                
                                                                                                            
 Phase 4 Complete When:                                                                                     
                                                                                                            
 - English and Spanish translations complete                                                                
 - Accessibility audit passes (WCAG 2.1 AA)                                                                 
 - CI/CD produces signed installers for all platforms                                                       
 - Migration from Mini Diary tested                                                                         
                                                                                                            
 Phase 5 Complete When:                                                                                     
                                                                                                            
 - E2E tests pass on all platforms                                                                          
 - All critical workflows covered                                                                           
                                                                                                            
 ---                                                                                                        
 Dependencies & Prerequisites                                                                               
                                                                                                            
 Development Environment:                                                                                   
 - Bun 1.1+ (or Node.js 20+ with pnpm 9+)                                                                   
 - Rust 1.75+                                                                                               
 - System dependencies per Tauri docs: https://tauri.app/v2/guides/prerequisites/                           
                                                                                                            
 Existing Functions/Utilities to Reuse:                                                                     
 - None (building from scratch)                                                                             
                                                                                                            
 External References:                                                                                       
 - REQUIREMENTS.md (comprehensive feature requirements)                                                     
 - IMPLEMENTATION_PLAN.md (technology stack, architecture)                                                  
 - .agents/skills/tauri-v2/ (Tauri v2 development references)                                               
 - .agents/skills/solidjs/ (SolidJS development references)                                                 
                                                                                                            
 ---                                                                                                        
 Next Steps                                                                                                 
                                                                                                            
 1. Start with Increment 1.1: Initialize Tauri + SolidJS project                                            
 2. Follow incremental order: Each step builds on previous                                                  
 3. Test continuously: Verify each increment before proceeding                                              
 4. Defer E2E: Save Playwright tests for Phase 5 (per user request)                                         
                                                                                                            
 Ready to begin implementation!  