# SolidJS Patterns & Best Practices

Common patterns, recipes, and best practices for SolidJS development.

## Component Patterns

### Controlled vs Uncontrolled Inputs

**Controlled:**
```tsx
function ControlledInput() {
  const [value, setValue] = createSignal("");
  
  return (
    <input 
      value={value()} 
      onInput={(e) => setValue(e.currentTarget.value)} 
    />
  );
}
```

**Uncontrolled with ref:**
```tsx
function UncontrolledInput() {
  let inputRef: HTMLInputElement;
  
  const handleSubmit = () => {
    console.log(inputRef.value);
  };
  
  return (
    <>
      <input ref={inputRef!} />
      <button onClick={handleSubmit}>Submit</button>
    </>
  );
}
```

### Compound Components

```tsx
const Tabs = {
  Root: (props: ParentProps<{ defaultTab?: string }>) => {
    const [activeTab, setActiveTab] = createSignal(props.defaultTab ?? "");
    
    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab }}>
        <div class="tabs">{props.children}</div>
      </TabsContext.Provider>
    );
  },
  
  List: (props: ParentProps) => (
    <div class="tabs-list" role="tablist">{props.children}</div>
  ),
  
  Tab: (props: ParentProps<{ value: string }>) => {
    const ctx = useTabsContext();
    return (
      <button
        role="tab"
        aria-selected={ctx.activeTab() === props.value}
        onClick={() => ctx.setActiveTab(props.value)}
      >
        {props.children}
      </button>
    );
  },
  
  Panel: (props: ParentProps<{ value: string }>) => {
    const ctx = useTabsContext();
    return (
      <Show when={ctx.activeTab() === props.value}>
        <div role="tabpanel">{props.children}</div>
      </Show>
    );
  }
};

// Usage
<Tabs.Root defaultTab="first">
  <Tabs.List>
    <Tabs.Tab value="first">First</Tabs.Tab>
    <Tabs.Tab value="second">Second</Tabs.Tab>
  </Tabs.List>
  <Tabs.Panel value="first">First Content</Tabs.Panel>
  <Tabs.Panel value="second">Second Content</Tabs.Panel>
</Tabs.Root>
```

### Render Props

```tsx
function MouseTracker(props: {
  children: (pos: { x: number; y: number }) => JSX.Element;
}) {
  const [pos, setPos] = createSignal({ x: 0, y: 0 });
  
  onMount(() => {
    const handler = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler);
    onCleanup(() => window.removeEventListener("mousemove", handler));
  });
  
  return <>{props.children(pos())}</>;
}

// Usage
<MouseTracker>
  {(pos) => <div>Mouse: {pos.x}, {pos.y}</div>}
</MouseTracker>
```

### Higher-Order Components

```tsx
function withAuth<P extends object>(Component: Component<P>) {
  return (props: P) => {
    const { user } = useAuth();
    
    return (
      <Show when={user()} fallback={<Redirect to="/login" />}>
        <Component {...props} />
      </Show>
    );
  };
}

const ProtectedDashboard = withAuth(Dashboard);
```

### Polymorphic Components

```tsx
type PolymorphicProps<E extends keyof JSX.IntrinsicElements> = {
  as?: E;
} & JSX.IntrinsicElements[E];

function Box<E extends keyof JSX.IntrinsicElements = "div">(
  props: PolymorphicProps<E>
) {
  const [local, others] = splitProps(props as PolymorphicProps<"div">, ["as"]);
  
  return <Dynamic component={local.as || "div"} {...others} />;
}

// Usage
<Box>Default div</Box>
<Box as="section">Section element</Box>
<Box as="button" onClick={handleClick}>Button</Box>
```

## State Patterns

### Derived State with Multiple Sources

```tsx
function SearchResults() {
  const [query, setQuery] = createSignal("");
  const [filters, setFilters] = createSignal({ category: "all" });
  
  const results = createMemo(() => {
    const q = query().toLowerCase();
    const f = filters();
    
    return allItems()
      .filter(item => item.name.toLowerCase().includes(q))
      .filter(item => f.category === "all" || item.category === f.category);
  });
  
  return <For each={results()}>{item => <Item item={item} />}</For>;
}
```

### State Machine Pattern

```tsx
type State = "idle" | "loading" | "success" | "error";
type Event = { type: "FETCH" } | { type: "SUCCESS"; data: any } | { type: "ERROR"; error: Error };

function createMachine(initial: State) {
  const [state, setState] = createSignal<State>(initial);
  const [data, setData] = createSignal<any>(null);
  const [error, setError] = createSignal<Error | null>(null);
  
  const send = (event: Event) => {
    const current = state();
    
    switch (current) {
      case "idle":
        if (event.type === "FETCH") setState("loading");
        break;
      case "loading":
        if (event.type === "SUCCESS") {
          setData(event.data);
          setState("success");
        } else if (event.type === "ERROR") {
          setError(event.error);
          setState("error");
        }
        break;
    }
  };
  
  return { state, data, error, send };
}
```

### Optimistic Updates

```tsx
const [todos, setTodos] = createStore<Todo[]>([]);

async function deleteTodo(id: string) {
  const original = [...unwrap(todos)];
  
  // Optimistic remove
  setTodos(todos => todos.filter(t => t.id !== id));
  
  try {
    await api.deleteTodo(id);
  } catch {
    // Rollback on error
    setTodos(reconcile(original));
  }
}
```

### Undo/Redo

```tsx
function createHistory<T>(initial: T) {
  const [past, setPast] = createSignal<T[]>([]);
  const [present, setPresent] = createSignal<T>(initial);
  const [future, setFuture] = createSignal<T[]>([]);
  
  const canUndo = () => past().length > 0;
  const canRedo = () => future().length > 0;
  
  const set = (value: T | ((prev: T) => T)) => {
    const newValue = typeof value === "function" 
      ? (value as (prev: T) => T)(present())
      : value;
    
    setPast(p => [...p, present()]);
    setPresent(newValue);
    setFuture([]);
  };
  
  const undo = () => {
    if (!canUndo()) return;
    
    const previous = past()[past().length - 1];
    setPast(p => p.slice(0, -1));
    setFuture(f => [present(), ...f]);
    setPresent(previous);
  };
  
  const redo = () => {
    if (!canRedo()) return;
    
    const next = future()[0];
    setPast(p => [...p, present()]);
    setFuture(f => f.slice(1));
    setPresent(next);
  };
  
  return { value: present, set, undo, redo, canUndo, canRedo };
}
```

## Custom Hooks/Primitives

### useLocalStorage

```tsx
function createLocalStorage<T>(key: string, initialValue: T) {
  const stored = localStorage.getItem(key);
  const initial = stored ? JSON.parse(stored) : initialValue;
  
  const [value, setValue] = createSignal<T>(initial);
  
  createEffect(() => {
    localStorage.setItem(key, JSON.stringify(value()));
  });
  
  return [value, setValue] as const;
}
```

### useDebounce

```tsx
function createDebounce<T>(source: () => T, delay: number) {
  const [debounced, setDebounced] = createSignal<T>(source());
  
  createEffect(() => {
    const value = source();
    const timer = setTimeout(() => setDebounced(() => value), delay);
    onCleanup(() => clearTimeout(timer));
  });
  
  return debounced;
}

// Usage
const debouncedQuery = createDebounce(query, 300);
```

### useThrottle

```tsx
function createThrottle<T>(source: () => T, delay: number) {
  const [throttled, setThrottled] = createSignal<T>(source());
  let lastRun = 0;
  
  createEffect(() => {
    const value = source();
    const now = Date.now();
    
    if (now - lastRun >= delay) {
      lastRun = now;
      setThrottled(() => value);
    } else {
      const timer = setTimeout(() => {
        lastRun = Date.now();
        setThrottled(() => value);
      }, delay - (now - lastRun));
      onCleanup(() => clearTimeout(timer));
    }
  });
  
  return throttled;
}
```

### useMediaQuery

```tsx
function createMediaQuery(query: string) {
  const mql = window.matchMedia(query);
  const [matches, setMatches] = createSignal(mql.matches);
  
  onMount(() => {
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    onCleanup(() => mql.removeEventListener("change", handler));
  });
  
  return matches;
}

// Usage
const isMobile = createMediaQuery("(max-width: 768px)");
```

### useClickOutside

```tsx
function createClickOutside(
  ref: () => HTMLElement | undefined,
  callback: () => void
) {
  onMount(() => {
    const handler = (e: MouseEvent) => {
      const el = ref();
      if (el && !el.contains(e.target as Node)) {
        callback();
      }
    };
    document.addEventListener("click", handler);
    onCleanup(() => document.removeEventListener("click", handler));
  });
}

// Usage
let dropdownRef: HTMLDivElement;
createClickOutside(() => dropdownRef, () => setOpen(false));
```

### useIntersectionObserver

```tsx
function createIntersectionObserver(
  ref: () => HTMLElement | undefined,
  options?: IntersectionObserverInit
) {
  const [isIntersecting, setIsIntersecting] = createSignal(false);
  
  onMount(() => {
    const el = ref();
    if (!el) return;
    
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);
    
    observer.observe(el);
    onCleanup(() => observer.disconnect());
  });
  
  return isIntersecting;
}
```

## Form Patterns

### Form Validation

```tsx
function createForm<T extends Record<string, any>>(initial: T) {
  const [values, setValues] = createStore<T>(initial);
  const [errors, setErrors] = createStore<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = createStore<Partial<Record<keyof T, boolean>>>({});
  
  const handleChange = (field: keyof T) => (e: Event) => {
    const target = e.target as HTMLInputElement;
    setValues(field as any, target.value as any);
  };
  
  const handleBlur = (field: keyof T) => () => {
    setTouched(field as any, true);
  };
  
  const validate = (validators: Partial<Record<keyof T, (v: any) => string | undefined>>) => {
    let isValid = true;
    
    for (const [field, validator] of Object.entries(validators)) {
      if (validator) {
        const error = validator(values[field as keyof T]);
        setErrors(field as any, error as any);
        if (error) isValid = false;
      }
    }
    
    return isValid;
  };
  
  return { values, errors, touched, handleChange, handleBlur, validate, setValues };
}

// Usage
const form = createForm({ email: "", password: "" });

<input
  value={form.values.email}
  onInput={form.handleChange("email")}
  onBlur={form.handleBlur("email")}
/>
<Show when={form.touched.email && form.errors.email}>
  <span class="error">{form.errors.email}</span>
</Show>
```

### Field Array

```tsx
function createFieldArray<T>(initial: T[] = []) {
  const [fields, setFields] = createStore<T[]>(initial);
  
  const append = (value: T) => setFields(f => [...f, value]);
  const remove = (index: number) => setFields(f => f.filter((_, i) => i !== index));
  const update = (index: number, value: Partial<T>) => setFields(index, v => ({ ...v, ...value }));
  const move = (from: number, to: number) => {
    setFields(produce(f => {
      const [item] = f.splice(from, 1);
      f.splice(to, 0, item);
    }));
  };
  
  return { fields, append, remove, update, move };
}
```

## Performance Patterns

### Virtualized List

```tsx
function VirtualList<T>(props: {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => JSX.Element;
}) {
  const [scrollTop, setScrollTop] = createSignal(0);
  
  const startIndex = createMemo(() => 
    Math.floor(scrollTop() / props.itemHeight)
  );
  
  const visibleCount = createMemo(() => 
    Math.ceil(props.height / props.itemHeight) + 1
  );
  
  const visibleItems = createMemo(() => 
    props.items.slice(startIndex(), startIndex() + visibleCount())
  );
  
  return (
    <div
      style={{ height: `${props.height}px`, overflow: "auto" }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: `${props.items.length * props.itemHeight}px`, position: "relative" }}>
        <For each={visibleItems()}>
          {(item, i) => (
            <div style={{
              position: "absolute",
              top: `${(startIndex() + i()) * props.itemHeight}px`,
              height: `${props.itemHeight}px`
            }}>
              {props.renderItem(item, startIndex() + i())}
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
```

### Lazy Loading with Intersection Observer

```tsx
function LazyLoad(props: ParentProps<{ placeholder?: JSX.Element }>) {
  let ref: HTMLDivElement;
  const [isVisible, setIsVisible] = createSignal(false);
  
  onMount(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "100px" }
    );
    observer.observe(ref);
    onCleanup(() => observer.disconnect());
  });
  
  return (
    <div ref={ref!}>
      <Show when={isVisible()} fallback={props.placeholder}>
        {props.children}
      </Show>
    </div>
  );
}
```

### Memoized Component

```tsx
// For expensive components that shouldn't re-render on parent updates
function MemoizedExpensiveList(props: { items: Item[] }) {
  // Component only re-renders when items actually change
  return (
    <For each={props.items}>
      {(item) => <ExpensiveItem item={item} />}
    </For>
  );
}
```

## Testing Patterns

### Component Testing

```tsx
import { render, fireEvent, screen } from "@solidjs/testing-library";

test("Counter increments", async () => {
  render(() => <Counter />);
  
  const button = screen.getByRole("button", { name: /increment/i });
  expect(screen.getByText("Count: 0")).toBeInTheDocument();
  
  fireEvent.click(button);
  expect(screen.getByText("Count: 1")).toBeInTheDocument();
});
```

### Testing with Context

```tsx
function renderWithContext(component: () => JSX.Element) {
  return render(() => (
    <ThemeProvider>
      <AuthProvider>
        {component()}
      </AuthProvider>
    </ThemeProvider>
  ));
}

test("Dashboard shows user", () => {
  renderWithContext(() => <Dashboard />);
  // ...
});
```

### Testing Async Components

```tsx
import { render, waitFor, screen } from "@solidjs/testing-library";

test("Loads user data", async () => {
  render(() => <UserProfile userId="123" />);
  
  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });
});
```

## Error Handling Patterns

### Global Error Handler

```tsx
function App() {
  return (
    <ErrorBoundary
      fallback={(err, reset) => (
        <ErrorPage error={err} onRetry={reset} />
      )}
    >
      <Suspense fallback={<AppLoader />}>
        <Router>
          {/* Routes */}
        </Router>
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Async Error Handling

```tsx
function DataComponent() {
  const [data] = createResource(fetchData);
  
  return (
    <Switch>
      <Match when={data.loading}>
        <Loading />
      </Match>
      <Match when={data.error}>
        <Error error={data.error} onRetry={() => refetch()} />
      </Match>
      <Match when={data()}>
        {(data) => <Content data={data()} />}
      </Match>
    </Switch>
  );
}
```

## Accessibility Patterns

### Focus Management

```tsx
function Modal(props: ParentProps<{ isOpen: boolean; onClose: () => void }>) {
  let dialogRef: HTMLDivElement;
  let previousFocus: HTMLElement | null;
  
  createEffect(() => {
    if (props.isOpen) {
      previousFocus = document.activeElement as HTMLElement;
      dialogRef.focus();
    } else if (previousFocus) {
      previousFocus.focus();
    }
  });
  
  return (
    <Show when={props.isOpen}>
      <Portal>
        <div
          ref={dialogRef!}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          onKeyDown={(e) => e.key === "Escape" && props.onClose()}
        >
          {props.children}
        </div>
      </Portal>
    </Show>
  );
}
```

### Live Regions

```tsx
function Notifications() {
  const [message, setMessage] = createSignal("");
  
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      class="sr-only"
    >
      {message()}
    </div>
  );
}
```
