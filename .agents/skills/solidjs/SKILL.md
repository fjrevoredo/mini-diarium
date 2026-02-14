---
name: solidjs
description: |
  SolidJS framework development skill for building reactive web applications with fine-grained reactivity.
  Use when working with SolidJS projects including: (1) Creating components with signals, stores, and effects,
  (2) Implementing reactive state management, (3) Using control flow components (Show, For, Switch/Match),
  (4) Setting up routing with Solid Router, (5) Building full-stack apps with SolidStart,
  (6) Data fetching with createResource, (7) Context API for shared state, (8) SSR/SSG configuration.
  Triggers: solid, solidjs, solid-js, solid start, solidstart, createSignal, createStore, createEffect.
---

# SolidJS Development

SolidJS is a declarative JavaScript library for building user interfaces with fine-grained reactivity. Unlike virtual DOM frameworks, Solid compiles templates to real DOM nodes and updates them with fine-grained reactions.

## Core Principles

1. **Components run once** — Component functions execute only during initialization, not on every update
2. **Fine-grained reactivity** — Only the specific DOM nodes that depend on changed data update
3. **No virtual DOM** — Direct DOM manipulation via compiled templates
4. **Signals are functions** — Access values by calling: `count()` not `count`

## Reactivity Primitives

### Signals — Basic State

```tsx
import { createSignal } from "solid-js";

const [count, setCount] = createSignal(0);

// Read value (getter)
console.log(count()); // 0

// Update value (setter)
setCount(1);
setCount(prev => prev + 1); // Functional update
```

**Options:**
```tsx
const [value, setValue] = createSignal(initialValue, {
  equals: false, // Always trigger updates, even if value unchanged
  name: "debugName" // For devtools
});
```

### Effects — Side Effects

```tsx
import { createEffect } from "solid-js";

createEffect(() => {
  console.log("Count changed:", count());
  // Runs after render, re-runs when dependencies change
});
```

**Key behaviors:**
- Initial run: after render, before browser paint
- Subsequent runs: when tracked dependencies change
- Never runs during SSR or hydration
- Use `onCleanup` for cleanup logic

### Memos — Derived/Cached Values

```tsx
import { createMemo } from "solid-js";

const doubled = createMemo(() => count() * 2);

// Access like signal
console.log(doubled()); // Cached, only recalculates when count changes
```

Use memos when:
- Derived value is expensive to compute
- Derived value is accessed multiple times
- You want to prevent downstream updates when result unchanged

### Resources — Async Data

```tsx
import { createResource } from "solid-js";

const [user, { mutate, refetch }] = createResource(userId, fetchUser);

// In JSX
<Show when={!user.loading} fallback={<Loading />}>
  <div>{user()?.name}</div>
</Show>

// Resource properties
user.loading   // boolean
user.error     // error if failed
user.state     // "unresolved" | "pending" | "ready" | "refreshing" | "errored"
user.latest    // last successful value
```

## Stores — Complex State

For nested objects/arrays with fine-grained updates:

```tsx
import { createStore } from "solid-js/store";

const [state, setState] = createStore({
  user: { name: "John", age: 30 },
  todos: []
});

// Path syntax updates
setState("user", "name", "Jane");
setState("todos", todos => [...todos, newTodo]);
setState("todos", 0, "completed", true);

// Produce for immer-like updates
import { produce } from "solid-js/store";
setState(produce(s => {
  s.user.age++;
  s.todos.push(newTodo);
}));
```

**Store utilities:**
- `produce` — Immer-like mutations
- `reconcile` — Diff and patch data (for API responses)
- `unwrap` — Get raw non-reactive object

## Components

### Basic Component

```tsx
import { Component } from "solid-js";

const MyComponent: Component<{ name: string }> = (props) => {
  return <div>Hello, {props.name}</div>;
};
```

### Props Handling

```tsx
import { splitProps, mergeProps } from "solid-js";

// Default props
const merged = mergeProps({ size: "medium" }, props);

// Split props (for spreading)
const [local, others] = splitProps(props, ["class", "onClick"]);
return <button class={local.class} {...others} />;
```

**Props rules:**
- Props are reactive getters — don't destructure at top level
- Use `props.value` in JSX, not `const { value } = props`

### Children Helper

```tsx
import { children } from "solid-js";

const Wrapper: Component = (props) => {
  const resolved = children(() => props.children);
  
  createEffect(() => {
    console.log("Children:", resolved());
  });
  
  return <div>{resolved()}</div>;
};
```

## Control Flow Components

### Show — Conditional Rendering

```tsx
import { Show } from "solid-js";

<Show when={user()} fallback={<Login />}>
  {(user) => <Profile user={user()} />}
</Show>
```

### For — List Rendering (keyed by reference)

```tsx
import { For } from "solid-js";

<For each={items()} fallback={<Empty />}>
  {(item, index) => (
    <div>{index()}: {item.name}</div>
  )}
</For>
```

**Note:** `index` is a signal, `item` is the value.

### Index — List Rendering (keyed by index)

```tsx
import { Index } from "solid-js";

<Index each={items()}>
  {(item, index) => (
    <input value={item().text} />
  )}
</Index>
```

**Note:** `item` is a signal, `index` is the value. Better for primitive arrays or inputs.

### Switch/Match — Multiple Conditions

```tsx
import { Switch, Match } from "solid-js";

<Switch fallback={<Default />}>
  <Match when={state() === "loading"}>
    <Loading />
  </Match>
  <Match when={state() === "error"}>
    <Error />
  </Match>
  <Match when={state() === "success"}>
    <Success />
  </Match>
</Switch>
```

### Dynamic — Dynamic Component

```tsx
import { Dynamic } from "solid-js/web";

<Dynamic component={selected()} someProp="value" />
```

### Portal — Render Outside DOM Hierarchy

```tsx
import { Portal } from "solid-js/web";

<Portal mount={document.body}>
  <Modal />
</Portal>
```

### ErrorBoundary — Error Handling

```tsx
import { ErrorBoundary } from "solid-js";

<ErrorBoundary fallback={(err, reset) => (
  <div>
    Error: {err.message}
    <button onClick={reset}>Retry</button>
  </div>
)}>
  <RiskyComponent />
</ErrorBoundary>
```

### Suspense — Async Loading

```tsx
import { Suspense } from "solid-js";

<Suspense fallback={<Loading />}>
  <AsyncComponent />
</Suspense>
```

## Context API

```tsx
import { createContext, useContext } from "solid-js";

// Create context
const CounterContext = createContext<{
  count: () => number;
  increment: () => void;
}>();

// Provider component
export function CounterProvider(props) {
  const [count, setCount] = createSignal(0);
  
  return (
    <CounterContext.Provider value={{
      count,
      increment: () => setCount(c => c + 1)
    }}>
      {props.children}
    </CounterContext.Provider>
  );
}

// Consumer hook
export function useCounter() {
  const ctx = useContext(CounterContext);
  if (!ctx) throw new Error("useCounter must be used within CounterProvider");
  return ctx;
}
```

## Lifecycle

```tsx
import { onMount, onCleanup } from "solid-js";

function MyComponent() {
  onMount(() => {
    console.log("Mounted");
    const handler = () => {};
    window.addEventListener("resize", handler);
    
    onCleanup(() => {
      window.removeEventListener("resize", handler);
    });
  });
  
  return <div>Content</div>;
}
```

## Refs

```tsx
let inputRef: HTMLInputElement;

<input ref={inputRef} />
<input ref={(el) => { /* el is the DOM element */ }} />
```

## Event Handling

```tsx
// Standard events (lowercase)
<button onClick={handleClick}>Click</button>
<button onClick={(e) => handleClick(e)}>Click</button>

// Delegated events (on:)
<input on:input={handleInput} />

// Native events (on:) - not delegated
<div on:scroll={handleScroll} />
```

## Routing (Solid Router)

See [references/routing.md](references/routing.md) for complete routing guide.

Quick setup:
```tsx
import { Router, Route } from "@solidjs/router";

<Router>
  <Route path="/" component={Home} />
  <Route path="/users/:id" component={User} />
  <Route path="*404" component={NotFound} />
</Router>
```

## SolidStart

See [references/solidstart.md](references/solidstart.md) for full-stack development guide.

Quick setup:
```bash
npm create solid@latest my-app
cd my-app && npm install && npm run dev
```

## Common Patterns

### Conditional Classes

```tsx
import { clsx } from "clsx"; // or classList

<div class={clsx("base", { active: isActive() })} />
<div classList={{ active: isActive(), disabled: isDisabled() }} />
```

### Batch Updates

```tsx
import { batch } from "solid-js";

batch(() => {
  setName("John");
  setAge(30);
  // Effects run once after batch completes
});
```

### Untrack

```tsx
import { untrack } from "solid-js";

createEffect(() => {
  console.log(count()); // tracked
  console.log(untrack(() => other())); // not tracked
});
```

## TypeScript

```tsx
import type { Component, ParentComponent, JSX } from "solid-js";

// Basic component
const Button: Component<{ label: string }> = (props) => (
  <button>{props.label}</button>
);

// With children
const Layout: ParentComponent<{ title: string }> = (props) => (
  <div>
    <h1>{props.title}</h1>
    {props.children}
  </div>
);

// Event handler types
const handleClick: JSX.EventHandler<HTMLButtonElement, MouseEvent> = (e) => {
  console.log(e.currentTarget);
};
```

## Project Setup

```bash
# Create new project
npm create solid@latest my-app

# With template
npx degit solidjs/templates/ts my-app

# SolidStart
npm create solid@latest my-app -- --template solidstart
```

**vite.config.ts:**
```ts
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";

export default defineConfig({
  plugins: [solid()]
});
```

## Anti-Patterns to Avoid

1. **Destructuring props** — Breaks reactivity
   ```tsx
   // ❌ Bad
   const { name } = props;
   
   // ✅ Good
   props.name
   ```

2. **Accessing signals outside tracking scope**
   ```tsx
   // ❌ Won't update
   console.log(count());
   
   // ✅ Will update
   createEffect(() => console.log(count()));
   ```

3. **Forgetting to call signal getters**
   ```tsx
   // ❌ Passes the function
   <div>{count}</div>
   
   // ✅ Passes the value
   <div>{count()}</div>
   ```

4. **Using array index as key** — Use `<For>` for reference-keyed, `<Index>` for index-keyed

5. **Side effects during render** — Use `createEffect` or `onMount`
