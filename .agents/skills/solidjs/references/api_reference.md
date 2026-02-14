# SolidJS API Reference

Complete reference for all SolidJS primitives, utilities, and component APIs.

## Basic Reactivity

### createSignal

```tsx
import { createSignal } from "solid-js";

const [getter, setter] = createSignal<T>(initialValue, options?);

// Options
interface SignalOptions<T> {
  equals?: false | ((prev: T, next: T) => boolean);
  name?: string;
  internal?: boolean;
}
```

**Examples:**
```tsx
const [count, setCount] = createSignal(0);
const [user, setUser] = createSignal<User | null>(null);

// Always update
const [data, setData] = createSignal(obj, { equals: false });

// Custom equality
const [items, setItems] = createSignal([], {
  equals: (a, b) => a.length === b.length
});

// Setter forms
setCount(5);                      // Direct value
setCount(prev => prev + 1);       // Functional update
```

### createEffect

```tsx
import { createEffect } from "solid-js";

createEffect<T>(fn: (prev: T) => T, initialValue?: T, options?);

// Options
interface EffectOptions {
  name?: string;
}
```

**Examples:**
```tsx
// Basic
createEffect(() => {
  console.log("Count:", count());
});

// With previous value
createEffect((prev) => {
  console.log("Changed from", prev, "to", count());
  return count();
}, count());

// With cleanup
createEffect(() => {
  const handler = () => {};
  window.addEventListener("resize", handler);
  onCleanup(() => window.removeEventListener("resize", handler));
});
```

### createMemo

```tsx
import { createMemo } from "solid-js";

const getter = createMemo<T>(fn: (prev: T) => T, initialValue?: T, options?);

// Options
interface MemoOptions<T> {
  equals?: false | ((prev: T, next: T) => boolean);
  name?: string;
}
```

**Examples:**
```tsx
const doubled = createMemo(() => count() * 2);
const filtered = createMemo(() => items().filter(i => i.active));

// Previous value
const delta = createMemo((prev) => count() - prev, 0);
```

### createResource

```tsx
import { createResource } from "solid-js";

const [resource, { mutate, refetch }] = createResource(
  source?,      // Optional reactive source
  fetcher,      // (source, info) => Promise<T>
  options?
);

// Resource properties
resource()           // T | undefined
resource.loading     // boolean
resource.error       // any
resource.state       // "unresolved" | "pending" | "ready" | "refreshing" | "errored"
resource.latest      // T | undefined (last successful value)

// Options
interface ResourceOptions<T> {
  initialValue?: T;
  name?: string;
  deferStream?: boolean;
  ssrLoadFrom?: "initial" | "server";
  storage?: (init: T) => [Accessor<T>, Setter<T>];
  onHydrated?: (key, info: { value: T }) => void;
}
```

**Examples:**
```tsx
// Without source
const [users] = createResource(fetchUsers);

// With source
const [user] = createResource(userId, fetchUser);

// With options
const [data] = createResource(id, fetchData, {
  initialValue: [],
  deferStream: true
});

// Actions
mutate(newValue);           // Update locally
refetch();                  // Re-fetch
refetch(customInfo);        // Pass to fetcher's info.refetching
```

## Stores

### createStore

```tsx
import { createStore } from "solid-js/store";

const [store, setStore] = createStore<T>(initialValue);
```

**Update patterns:**
```tsx
const [state, setState] = createStore({
  user: { name: "John", age: 30 },
  todos: [{ id: 1, text: "Learn Solid", done: false }]
});

// Path syntax
setState("user", "name", "Jane");
setState("user", "age", a => a + 1);
setState("todos", 0, "done", true);

// Array operations
setState("todos", t => [...t, newTodo]);
setState("todos", todos.length, newTodo);

// Multiple paths
setState("todos", { from: 0, to: 2 }, "done", true);
setState("todos", [0, 2, 4], "done", true);
setState("todos", i => i.done, "done", false);

// Object merge (shallow)
setState("user", { age: 31 }); // Keeps other properties
```

### produce

```tsx
import { produce } from "solid-js/store";

setState(produce(draft => {
  draft.user.age++;
  draft.todos.push({ id: 2, text: "New", done: false });
  draft.todos[0].done = true;
}));
```

### reconcile

```tsx
import { reconcile } from "solid-js/store";

// Replace with diff (minimal updates)
setState("todos", reconcile(newTodosFromAPI));

// Options
reconcile(data, { key: "id", merge: true });
```

### unwrap

```tsx
import { unwrap } from "solid-js/store";

const raw = unwrap(store);  // Non-reactive plain object
```

### createMutable

```tsx
import { createMutable } from "solid-js/store";

const state = createMutable({
  count: 0,
  user: { name: "John" }
});

// Direct mutation (like MobX)
state.count++;
state.user.name = "Jane";
```

### modifyMutable

```tsx
import { modifyMutable, reconcile, produce } from "solid-js/store";

modifyMutable(state, reconcile(newData));
modifyMutable(state, produce(s => { s.count++ }));
```

## Component APIs

### children

```tsx
import { children } from "solid-js";

const resolved = children(() => props.children);

// Access
resolved();           // JSX.Element | JSX.Element[]
resolved.toArray();   // Always array
```

### createContext / useContext

```tsx
import { createContext, useContext } from "solid-js";

const MyContext = createContext<T>(defaultValue?);

// Provider
<MyContext.Provider value={value}>
  {children}
</MyContext.Provider>

// Consumer
const value = useContext(MyContext);
```

### createUniqueId

```tsx
import { createUniqueId } from "solid-js";

const id = createUniqueId();  // "0", "1", etc.
```

### lazy

```tsx
import { lazy } from "solid-js";

const LazyComponent = lazy(() => import("./Component"));

// Use with Suspense
<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>
```

## Lifecycle

### onMount

```tsx
import { onMount } from "solid-js";

onMount(() => {
  // Runs once after initial render
  console.log("Mounted");
});
```

### onCleanup

```tsx
import { onCleanup } from "solid-js";

// In component
onCleanup(() => {
  console.log("Cleaning up");
});

// In effect
createEffect(() => {
  const sub = subscribe();
  onCleanup(() => sub.unsubscribe());
});
```

## Reactive Utilities

### batch

```tsx
import { batch } from "solid-js";

batch(() => {
  setA(1);
  setB(2);
  setC(3);
  // Effects run once after batch
});
```

### untrack

```tsx
import { untrack } from "solid-js";

createEffect(() => {
  console.log(a());              // Tracked
  console.log(untrack(() => b())); // Not tracked
});
```

### on

```tsx
import { on } from "solid-js";

// Explicit dependencies
createEffect(on(count, (value, prev) => {
  console.log("Count changed:", prev, "->", value);
}));

// Multiple dependencies
createEffect(on([a, b], ([a, b], [prevA, prevB]) => {
  console.log("Changed");
}));

// Defer first run
createEffect(on(count, (v) => console.log(v), { defer: true }));
```

### mergeProps

```tsx
import { mergeProps } from "solid-js";

const merged = mergeProps(
  { size: "medium", color: "blue" },  // Defaults
  props                                 // Overrides
);
```

### splitProps

```tsx
import { splitProps } from "solid-js";

const [local, others] = splitProps(props, ["class", "onClick"]);
// local.class, local.onClick
// others contains everything else

const [a, b, rest] = splitProps(props, ["foo"], ["bar"]);
```

### createRoot

```tsx
import { createRoot } from "solid-js";

const dispose = createRoot((dispose) => {
  const [count, setCount] = createSignal(0);
  // Use signals...
  return dispose;
});

// Later
dispose();
```

### getOwner / runWithOwner

```tsx
import { getOwner, runWithOwner } from "solid-js";

const owner = getOwner();

// Later, in async code
runWithOwner(owner, () => {
  createEffect(() => {
    // This effect has proper ownership
  });
});
```

### mapArray

```tsx
import { mapArray } from "solid-js";

const mapped = mapArray(
  () => items(),
  (item, index) => ({ ...item, doubled: item.value * 2 })
);
```

### indexArray

```tsx
import { indexArray } from "solid-js";

const mapped = indexArray(
  () => items(),
  (item, index) => <div>{index}: {item().name}</div>
);
```

### observable

```tsx
import { observable } from "solid-js";

const obs = observable(signal);
obs.subscribe((value) => console.log(value));
```

### from

```tsx
import { from } from "solid-js";

// Convert observable/subscribable to signal
const signal = from(rxObservable);
const signal = from((set) => {
  const unsub = subscribe(set);
  return unsub;
});
```

### catchError

```tsx
import { catchError } from "solid-js";

catchError(
  () => riskyOperation(),
  (err) => console.error("Error:", err)
);
```

## Secondary Primitives

### createComputed

```tsx
import { createComputed } from "solid-js";

// Like createEffect but runs during render phase
createComputed(() => {
  setDerived(source() * 2);
});
```

### createRenderEffect

```tsx
import { createRenderEffect } from "solid-js";

// Runs before paint (for DOM measurements)
createRenderEffect(() => {
  const height = element.offsetHeight;
});
```

### createDeferred

```tsx
import { createDeferred } from "solid-js";

// Returns value after idle time
const deferred = createDeferred(() => expensiveComputation(), {
  timeoutMs: 1000
});
```

### createReaction

```tsx
import { createReaction } from "solid-js";

const track = createReaction(() => {
  console.log("Something changed");
});

track(() => count()); // Start tracking
```

### createSelector

```tsx
import { createSelector } from "solid-js";

const isSelected = createSelector(selectedId);

<For each={items()}>
  {(item) => (
    <div class={isSelected(item.id) ? "selected" : ""}>
      {item.name}
    </div>
  )}
</For>
```

## Components

### Show

```tsx
<Show when={condition()} fallback={<Fallback />}>
  <Content />
</Show>

// With callback (narrowed type)
<Show when={user()}>
  {(user) => <div>{user().name}</div>}
</Show>
```

### For

```tsx
<For each={items()} fallback={<Empty />}>
  {(item, index) => <div>{index()}: {item.name}</div>}
</For>
```

### Index

```tsx
<Index each={items()} fallback={<Empty />}>
  {(item, index) => <input value={item().text} />}
</Index>
```

### Switch / Match

```tsx
<Switch fallback={<Default />}>
  <Match when={state() === "loading"}>
    <Loading />
  </Match>
  <Match when={state() === "error"}>
    <Error />
  </Match>
</Switch>
```

### Dynamic

```tsx
import { Dynamic } from "solid-js/web";

<Dynamic component={selected()} prop={value} />
<Dynamic component="div" class="dynamic">Content</Dynamic>
```

### Portal

```tsx
import { Portal } from "solid-js/web";

<Portal mount={document.body}>
  <Modal />
</Portal>
```

### ErrorBoundary

```tsx
<ErrorBoundary fallback={(err, reset) => (
  <div>
    <p>Error: {err.message}</p>
    <button onClick={reset}>Retry</button>
  </div>
)}>
  <Content />
</ErrorBoundary>
```

### Suspense

```tsx
<Suspense fallback={<Loading />}>
  <AsyncContent />
</Suspense>
```

### SuspenseList

```tsx
<SuspenseList revealOrder="forwards" tail="collapsed">
  <Suspense fallback={<Loading />}><Item1 /></Suspense>
  <Suspense fallback={<Loading />}><Item2 /></Suspense>
  <Suspense fallback={<Loading />}><Item3 /></Suspense>
</SuspenseList>
```

## Rendering

### render

```tsx
import { render } from "solid-js/web";

const dispose = render(() => <App />, document.getElementById("root")!);

// Cleanup
dispose();
```

### hydrate

```tsx
import { hydrate } from "solid-js/web";

hydrate(() => <App />, document.getElementById("root")!);
```

### renderToString

```tsx
import { renderToString } from "solid-js/web";

const html = renderToString(() => <App />);
```

### renderToStringAsync

```tsx
import { renderToStringAsync } from "solid-js/web";

const html = await renderToStringAsync(() => <App />);
```

### renderToStream

```tsx
import { renderToStream } from "solid-js/web";

const stream = renderToStream(() => <App />);
stream.pipe(res);
```

### isServer

```tsx
import { isServer } from "solid-js/web";

if (isServer) {
  // Server-only code
}
```

## JSX Attributes

### ref

```tsx
let el: HTMLDivElement;
<div ref={el} />
<div ref={(e) => console.log(e)} />
```

### classList

```tsx
<div classList={{ active: isActive(), disabled: isDisabled() }} />
```

### style

```tsx
<div style={{ color: "red", "font-size": "14px" }} />
<div style={`color: ${color()}`} />
```

### on:event (native)

```tsx
<div on:click={handleClick} />
<div on:scroll={handleScroll} />
```

### use:directive

```tsx
function clickOutside(el: HTMLElement, accessor: () => () => void) {
  const handler = (e: MouseEvent) => {
    if (!el.contains(e.target as Node)) accessor()();
  };
  document.addEventListener("click", handler);
  onCleanup(() => document.removeEventListener("click", handler));
}

<div use:clickOutside={() => setOpen(false)} />
```

### prop:property

```tsx
<input prop:value={value()} />  // Set as property, not attribute
```

### attr:attribute

```tsx
<div attr:data-custom={value()} />  // Force attribute
```

### bool:attribute

```tsx
<input bool:disabled={isDisabled()} />
```

### @once

```tsx
<div title={/*@once*/ staticValue} />  // Never updates
```

## Types

```tsx
import type {
  Component,
  ParentComponent,
  FlowComponent,
  VoidComponent,
  JSX,
  Accessor,
  Setter,
  Signal,
  Resource,
  Owner
} from "solid-js";

// Component types
const MyComponent: Component<Props> = (props) => <div />;
const Parent: ParentComponent<Props> = (props) => <div>{props.children}</div>;
const Flow: FlowComponent<Props, Item> = (props) => props.children(item);
const Void: VoidComponent<Props> = (props) => <input />;

// Event types
type Handler = JSX.EventHandler<HTMLButtonElement, MouseEvent>;
type ChangeHandler = JSX.ChangeEventHandler<HTMLInputElement>;
```
