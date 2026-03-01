# Text Input Extension Point — Implementation Plan

**Status**: Deferred (design complete, not yet implemented)
**Tracked by**: [OPEN_TASKS.md Task 67](OPEN_TASKS.md)
**Date drafted**: 2026-03-01

---

## 1. Overview

This feature adds pluggable text-generation sources that users can invoke while composing a diary entry. A toolbar button opens a `TextInputOverlay` where users choose a source, optionally provide a prompt, and insert the result at the cursor.

**Why it exists**: Diary writing is sometimes blocked by a blank page. Short AI-assisted prompts, voice dictation, or custom local scripts lower that barrier without compromising the privacy-first design.

**What is NOT this feature**:
- No automatic or background text generation
- No content is sent anywhere without explicit user action and opt-in configuration
- No dependency on any external service (all network calls are user-configured)

---

## 2. Capability Analysis — What Rhai Can and Cannot Do

| Capability | Rhai (Tier 1) | Frontend JS (Tier 2) |
|---|---|---|
| Pure text transformation / templates | ✅ Full | ✅ Full |
| File I/O (read local data) | ✅ Via Tauri sandbox | ❌ Not applicable |
| HTTP requests | ❌ Rhai has no stdlib HTTP | ✅ `fetch()` available |
| Web Speech API (dictation) | ❌ No DOM access | ✅ Browser API |
| Access entry context (title/text) | ✅ Via `@permissions: read-context` | ✅ Via state signals |
| Ship as user plugin (no rebuild) | ✅ Drop `.rhai` file | ❌ Must be built-in |
| Streaming responses | ❌ | ✅ With ReadableStream |

**Conclusion**: Two tiers are required. Rhai handles user-scriptable local logic; frontend JS handles network and browser APIs as built-in plugins.

---

## 3. Architecture: Two-Tier Plugin System

```
┌─────────────────────────────────────────────────────┐
│              TextInputOverlay (frontend)            │
│  - Lists all available text-input plugins           │
│  - Shows prompt input field                         │
│  - Inserts result at TipTap cursor                  │
└──────────┬──────────────────────────┬───────────────┘
           │ invoke()                 │ direct call
           ▼                          ▼
┌──────────────────────┐   ┌────────────────────────────┐
│  Tier 1: Rhai        │   │  Tier 2: Frontend Built-ins│
│  (Rust backend)      │   │  (src/lib/textInputPlugins) │
│                      │   │                            │
│  TextInputPlugin     │   │  LLM Endpoint Plugin       │
│  trait impl          │   │  (fetch → OpenAI API)      │
│  run_text_input_     │   │                            │
│  plugin command      │   │  Dictation Plugin          │
│                      │   │  (Web Speech API)          │
└──────────────────────┘   └────────────────────────────┘
           │
           ▼
  PluginRegistry (extended)
  .rhai files in {diary_dir}/plugins/
  @type: text-input
```

### Resolution order for `list_text_input_plugins`

1. Rust command returns Rhai-based text-input plugins
2. Frontend merges in built-in frontend plugins (LLM endpoint, dictation)
3. Overlay renders combined list

---

## 4. Privacy Model & Philosophy Alignment

| PHILOSOPHY.md principle | How this feature satisfies it |
|---|---|
| No network by default | LLM endpoint is opt-in; URL and key set manually by user; no default endpoint |
| No telemetry | No usage metrics, no crash reports, no prompts sent to Anthropic |
| User owns their data | Prompts and results never leave the device unless user configures an external LLM |
| Offline-first | Dictation works fully offline; Rhai plugins work fully offline; LLM requires network only if user chose a cloud endpoint |
| Transparent | UI clearly shows which plugin is being invoked; network plugins are visually distinct |

**Preferences stored in `localStorage`** (consistent with existing preferences pattern):
- `textInputLlmUrl`: string (OpenAI-compatible base URL, e.g. `http://localhost:11434/v1`)
- `textInputLlmModel`: string (model name)
- `textInputLlmKey`: string (API key; empty for local Ollama)
- `textInputLlmSystemPrompt`: string (optional system message)

---

## 5. Rhai Contract (Tier 1)

### Script header

```rhai
// @name: My Writing Assistant
// @type: text-input
// @description: Generates a journaling prompt based on your title
// @extensions: (none — text-input plugins don't handle file imports)
// @permissions: read-context   ← optional; grants title/text in context arg
```

### Function signatures

```rhai
// Minimal — no context
fn generate(prompt) {
    // prompt: string provided by user in TextInputOverlay
    // return: string to insert at cursor
    "Here is some generated text based on: " + prompt
}

// With context (requires @permissions: read-context)
fn generate(prompt, context) {
    // context: map with keys "title" (string), "text" (string, HTML)
    let title = context["title"];
    "Continuing from '" + title + "': " + prompt
}
```

### Backend contract

- `rhai_loader.rs` detects `@type: text-input` during script discovery
- Creates `RhaiTextInputPlugin` (analogous to `RhaiImportPlugin`)
- `run_text_input_plugin(plugin_id, prompt, context_opt)` Tauri command calls `generate`
- `context_opt` is `Option<TextInputContext>` — only populated if `@permissions: read-context` declared

---

## 6. Frontend Plugin Interface (Tier 2)

### `src/lib/textInputPlugins.ts`

```typescript
export interface TextInputContext {
  title: string;
  text: string; // HTML content from TipTap
}

export interface FrontendTextInputPlugin {
  id: string;
  name: string;
  description: string;
  tier: 'frontend-builtin';
  requiresConfig?: boolean; // true → show warning if not configured
  generate(prompt: string, context?: TextInputContext): Promise<string>;
}

export const frontendTextInputPlugins: FrontendTextInputPlugin[] = [
  llmEndpointPlugin,
  dictationPlugin,
];
```

### Plugin registry pattern

```typescript
// Usage in TextInputOverlay
const rhaiPlugins = await listTextInputPlugins(); // Tauri command
const allPlugins = [...rhaiPlugins, ...frontendTextInputPlugins];
```

---

## 7. Built-in Frontend Plugins

### 7.1 LLM Endpoint Plugin

```typescript
const llmEndpointPlugin: FrontendTextInputPlugin = {
  id: 'builtin:llm-endpoint',
  name: 'LLM Endpoint',
  description: 'Generate text via an OpenAI-compatible API (Ollama, OpenAI, etc.)',
  tier: 'frontend-builtin',
  requiresConfig: true,
  async generate(prompt, context) {
    const { textInputLlmUrl, textInputLlmModel, textInputLlmKey, textInputLlmSystemPrompt } =
      preferences(); // from state/preferences.ts
    const messages = [];
    if (textInputLlmSystemPrompt) {
      messages.push({ role: 'system', content: textInputLlmSystemPrompt });
    }
    if (context) {
      messages.push({ role: 'user', content: `Title: ${context.title}\n\n${prompt}` });
    } else {
      messages.push({ role: 'user', content: prompt });
    }
    const res = await fetch(`${textInputLlmUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(textInputLlmKey ? { Authorization: `Bearer ${textInputLlmKey}` } : {}),
      },
      body: JSON.stringify({ model: textInputLlmModel, messages }),
    });
    if (!res.ok) throw new Error(`LLM request failed: ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  },
};
```

**Supported endpoints**: Any OpenAI-compatible `/v1/chat/completions` endpoint, including:
- Ollama (`http://localhost:11434/v1`)
- LM Studio (`http://localhost:1234/v1`)
- OpenAI (`https://api.openai.com/v1`)
- Any self-hosted compatible server

### 7.2 Dictation Plugin

```typescript
const dictationPlugin: FrontendTextInputPlugin = {
  id: 'builtin:dictation',
  name: 'Dictation',
  description: 'Transcribe speech to text using the Web Speech API (no network required)',
  tier: 'frontend-builtin',
  requiresConfig: false,
  async generate(_prompt, _context) {
    return new Promise((resolve, reject) => {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        reject(new Error('Web Speech API not available in this browser'));
        return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = navigator.language;
      recognition.interimResults = false;
      recognition.onresult = (e: any) => resolve(e.results[0][0].transcript);
      recognition.onerror = (e: any) => reject(new Error(e.error));
      recognition.start();
    });
  },
};
```

**Note**: Dictation UX differs from LLM — the overlay should show a "listening…" indicator and resolve on silence rather than waiting for explicit submission.

---

## 8. Backend Changes

### 8.1 New `TextInputPlugin` trait (`plugin/mod.rs`)

```rust
pub trait TextInputPlugin: Send + Sync {
    fn info(&self) -> PluginInfo;
    fn generate(&self, prompt: &str, context: Option<&TextInputContext>) -> Result<String, String>;
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct TextInputContext {
    pub title: String,
    pub text: String,
}
```

### 8.2 `PluginRegistry` extension (`plugin/registry.rs`)

```rust
pub struct PluginRegistry {
    import_plugins: Vec<Box<dyn ImportPlugin>>,
    export_plugins: Vec<Box<dyn ExportPlugin>>,
    text_input_plugins: Vec<Box<dyn TextInputPlugin>>,  // new
}

impl PluginRegistry {
    pub fn list_text_input_plugins(&self) -> Vec<PluginInfo> { ... }
    pub fn find_text_input_plugin(&self, id: &str) -> Option<&dyn TextInputPlugin> { ... }
}
```

### 8.3 `rhai_loader.rs` extension

- Detect `@type: text-input` during `load_plugins()`
- Create `RhaiTextInputPlugin` struct (analogous to `RhaiImportPlugin`)
- `unsafe impl Send + Sync` (same justification: AST is immutable post-compile)
- Call `fn generate` (1-arg) or `fn generate` (2-arg) based on `@permissions: read-context`

### 8.4 New Tauri commands (`commands/plugin.rs`)

```rust
#[tauri::command]
pub fn list_text_input_plugins(
    registry: State<Mutex<PluginRegistry>>,
) -> Result<Vec<PluginInfo>, String> {
    let reg = registry.lock().unwrap();
    Ok(reg.list_text_input_plugins())
}

#[tauri::command]
pub fn run_text_input_plugin(
    plugin_id: String,
    prompt: String,
    context: Option<TextInputContext>,
    registry: State<Mutex<PluginRegistry>>,
    state: State<DiaryState>,
) -> Result<String, String> {
    // Guard: diary must be unlocked if plugin has @permissions: read-context
    let reg = registry.lock().unwrap();
    let plugin = reg.find_text_input_plugin(&plugin_id)
        .ok_or_else(|| format!("Plugin not found: {}", plugin_id))?;
    plugin.generate(&prompt, context.as_ref())
}
```

Register both commands in `commands/mod.rs` and `lib.rs` `generate_handler![]`.

---

## 9. Frontend Changes

### 9.1 `src/components/overlays/TextInputOverlay.tsx` *(new file)*

**Behavior**:
1. Lists all available text-input plugins (Rhai + frontend built-ins)
2. User selects plugin, types optional prompt
3. On submit: calls plugin's `generate()` function
4. On success: emits result string via callback prop, closes overlay
5. LLM plugin shows spinner while awaiting response; shows error on failure
6. Dictation plugin shows "Listening…" indicator, auto-resolves on silence

**Props**:
```typescript
interface TextInputOverlayProps {
  onInsert: (text: string) => void;
  onClose: () => void;
  context?: TextInputContext; // passed from EditorPanel if @permissions: read-context
}
```

### 9.2 `EditorToolbar.tsx` — new toolbar button

Add a "Generate" or "✨" button to `EditorToolbar`. In minimal toolbar mode (default), it appears in the overflow menu. In full toolbar mode, it appears inline.

**Event flow**: toolbar button click → sets `isTextInputOpen(true)` in `ui.ts`.

### 9.3 `EditorPanel.tsx` — insert handler

```typescript
// In EditorPanel
<TextInputOverlay
  onInsert={(text) => {
    editor()?.commands.insertContent(text);
  }}
  onClose={() => setIsTextInputOpen(false)}
  context={{ title: currentEntry()?.title ?? '', text: editor()?.getHTML() ?? '' }}
/>
```

### 9.4 `ui.ts` — new signal

```typescript
export const [isTextInputOpen, setIsTextInputOpen] = createSignal(false);
```

Update `resetUiState()` to include `setIsTextInputOpen(false)`.

### 9.5 `state/preferences.ts` — new fields

Add to `Preferences` interface:
```typescript
textInputLlmUrl: string;       // default: ''
textInputLlmModel: string;     // default: ''
textInputLlmKey: string;       // default: ''
textInputLlmSystemPrompt: string; // default: ''
```

### 9.6 `PreferencesOverlay.tsx` — LLM configuration section

New "Text Input" section with fields:
- LLM API Base URL (text input, placeholder: `http://localhost:11434/v1`)
- Model name (text input, placeholder: `llama3`)
- API Key (password input, optional, leave empty for Ollama)
- System prompt (textarea, optional)

### 9.7 `src/lib/tauri.ts` — new wrappers

```typescript
export interface TextInputContext {
  title: string;
  text: string;
}

export async function listTextInputPlugins(): Promise<PluginInfo[]> {
  return invoke('list_text_input_plugins');
}

export async function runTextInputPlugin(
  pluginId: string,
  prompt: string,
  context?: TextInputContext,
): Promise<string> {
  return invoke('run_text_input_plugin', { pluginId, prompt, context });
}
```

---

## 10. Documentation Changes

When implementing:

- **`docs/user-plugins/USER_PLUGIN_GUIDE.md`**: Add `text-input` section (script header, `generate` function contract, `@permissions: read-context` opt-in, example scripts)
- **`CHANGELOG.md`**: Add under the release version block (Added section)
- **`CLAUDE.md`**:
  - Add `list_text_input_plugins` and `run_text_input_plugin` to Command Registry table
  - Update `plugin/mod.rs` description to mention `TextInputPlugin` trait
  - Update `Preferences` fields list
  - Update frontend test counts
  - Update backend test counts
  - Add `TextInputOverlay.tsx` to file structure
  - Add `textInputPlugins.ts` to `src/lib/`
- **`docs/OPEN_TASKS.md`**: Mark Task 67 as completed with date

---

## 11. Verification Steps

1. **Rhai plugin smoke test**: Drop a `hello.rhai` with `@type: text-input` into `{diary_dir}/plugins/`. Open TextInputOverlay; plugin appears in list. Type a prompt; result inserts at cursor.
2. **LLM endpoint test**: Start Ollama locally with `llama3`. Configure URL + model in Preferences. Open TextInputOverlay → select "LLM Endpoint" → type prompt → result inserts.
3. **LLM endpoint with cloud key**: Configure OpenAI URL + key. Verify Authorization header is sent correctly.
4. **LLM endpoint unconfigured**: With empty URL, selecting LLM plugin shows warning "Not configured".
5. **Dictation test**: In a Chromium-based Tauri webview, select Dictation, speak a sentence, verify transcript inserts.
6. **No-network Rhai**: Disconnect network, use a Rhai text-input plugin → still works (no outbound traffic).
7. **`@permissions: read-context` isolation**: A Rhai script without the permission receives `None` for context even if entry has content.
8. **Unit tests**: `rhai_loader.rs` tests for `@type: text-input` detection; `textInputPlugins.ts` tests for plugin list merging and error handling.

---

## 12. Critical Files Table

| File | Change type | Notes |
|---|---|---|
| `src-tauri/src/plugin/mod.rs` | Modify | Add `TextInputPlugin` trait, `TextInputContext` struct |
| `src-tauri/src/plugin/registry.rs` | Modify | Add `text_input_plugins` field, list/find methods |
| `src-tauri/src/plugin/rhai_loader.rs` | Modify | Detect `@type: text-input`, create `RhaiTextInputPlugin` |
| `src-tauri/src/commands/plugin.rs` | Modify | Add `list_text_input_plugins`, `run_text_input_plugin` |
| `src-tauri/src/commands/mod.rs` | Modify | Re-export new commands |
| `src-tauri/src/lib.rs` | Modify | Register new commands in `generate_handler![]` |
| `src/components/overlays/TextInputOverlay.tsx` | **New** | Overlay UI |
| `src/components/editor/EditorToolbar.tsx` | Modify | Add toolbar button |
| `src/components/editor/EditorPanel.tsx` | Modify | Wire overlay + insert handler |
| `src/components/overlays/PreferencesOverlay.tsx` | Modify | Add LLM config section |
| `src/lib/textInputPlugins.ts` | **New** | Frontend plugin registry + built-ins |
| `src/lib/tauri.ts` | Modify | Add `listTextInputPlugins`, `runTextInputPlugin` wrappers |
| `src/state/ui.ts` | Modify | Add `isTextInputOpen` signal |
| `src/state/preferences.ts` | Modify | Add LLM config fields |
| `docs/user-plugins/USER_PLUGIN_GUIDE.md` | Modify | Add text-input section |
| `CHANGELOG.md` | Modify | Add entry for the release it ships in |
| `CLAUDE.md` | Modify | Update registry, file structure, test counts |
| `docs/OPEN_TASKS.md` | Modify | Mark Task 67 complete |
