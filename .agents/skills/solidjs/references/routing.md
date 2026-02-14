# Solid Router Reference

Complete guide to routing in SolidJS applications using `@solidjs/router`.

## Installation

```bash
npm install @solidjs/router
```

## Basic Setup

```tsx
import { Router, Route } from "@solidjs/router";

function App() {
  return (
    <Router>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
      <Route path="/users/:id" component={User} />
      <Route path="*404" component={NotFound} />
    </Router>
  );
}
```

## Router with Root Layout

```tsx
import { Router, Route } from "@solidjs/router";

function App() {
  return (
    <Router root={Layout}>
      <Route path="/" component={Home} />
      <Route path="/about" component={About} />
    </Router>
  );
}

function Layout(props) {
  return (
    <div>
      <nav>
        <A href="/">Home</A>
        <A href="/about">About</A>
      </nav>
      <main>{props.children}</main>
    </div>
  );
}
```

## Navigation

### Link Component

```tsx
import { A } from "@solidjs/router";

<A href="/about">About</A>
<A href="/about" activeClass="active">About</A>
<A href="/about" inactiveClass="inactive">About</A>
<A href="/about" end>About</A> // Exact match only
```

### Programmatic Navigation

```tsx
import { useNavigate } from "@solidjs/router";

function MyComponent() {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate("/users/123");
    navigate("/users/123", { replace: true }); // Replace history
    navigate(-1); // Go back
  };
  
  return <button onClick={handleClick}>Navigate</button>;
}
```

## Route Parameters

### Dynamic Segments

```tsx
<Route path="/users/:id" component={User} />
<Route path="/posts/:postId/comments/:commentId" component={Comment} />
```

### Accessing Parameters

```tsx
import { useParams } from "@solidjs/router";

function User() {
  const params = useParams();
  
  return <div>User ID: {params.id}</div>;
}
```

### Optional Parameters

```tsx
<Route path="/users/:id?" component={Users} />
```

### Wildcard Routes

```tsx
<Route path="/files/*" component={FileBrowser} />
<Route path="/files/*path" component={FileBrowser} /> // Named wildcard
```

## Query Parameters

```tsx
import { useSearchParams } from "@solidjs/router";

function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Read: ?q=hello&page=1
  console.log(searchParams.q);    // "hello"
  console.log(searchParams.page); // "1"
  
  // Update
  setSearchParams({ q: "world" });
  setSearchParams({ page: 2 }, { replace: true });
  
  return <input 
    value={searchParams.q || ""} 
    onInput={(e) => setSearchParams({ q: e.target.value })}
  />;
}
```

## Location

```tsx
import { useLocation } from "@solidjs/router";

function CurrentPath() {
  const location = useLocation();
  
  return (
    <div>
      <p>Path: {location.pathname}</p>
      <p>Search: {location.search}</p>
      <p>Hash: {location.hash}</p>
    </div>
  );
}
```

## Nested Routes

```tsx
<Router>
  <Route path="/users" component={UsersLayout}>
    <Route path="/" component={UsersList} />
    <Route path="/:id" component={UserDetail} />
    <Route path="/:id/edit" component={UserEdit} />
  </Route>
</Router>

function UsersLayout(props) {
  return (
    <div>
      <h1>Users</h1>
      {props.children}
    </div>
  );
}
```

## Route Matching

```tsx
import { useMatch } from "@solidjs/router";

function NavLink(props) {
  const match = useMatch(() => props.href);
  
  return (
    <A 
      href={props.href} 
      class={match() ? "active" : ""}
    >
      {props.children}
    </A>
  );
}
```

## Match Filters (Validation)

```tsx
const filters = {
  parent: ["mom", "dad"],
  id: /^\d+$/,
  withHtml: (v) => v.endsWith(".html")
};

<Route 
  path="/users/:parent/:id/:withHtml" 
  component={User}
  matchFilters={filters}
/>
```

## Lazy Loading Routes

```tsx
import { lazy } from "solid-js";

const UserProfile = lazy(() => import("./pages/UserProfile"));

<Route path="/profile" component={UserProfile} />
```

## Data Loading (Preload)

```tsx
import { cache, createAsync } from "@solidjs/router";

// Define cached data function
const getUser = cache(async (id: string) => {
  const response = await fetch(`/api/users/${id}`);
  return response.json();
}, "user");

// Route with preload
<Route 
  path="/users/:id" 
  component={User}
  preload={({ params }) => getUser(params.id)}
/>

// Component using data
function User() {
  const params = useParams();
  const user = createAsync(() => getUser(params.id));
  
  return (
    <Show when={user()}>
      {(user) => <div>{user().name}</div>}
    </Show>
  );
}
```

## Protected Routes

```tsx
import { Navigate } from "@solidjs/router";

function ProtectedRoute(props) {
  const { isAuthenticated } = useAuth();
  
  return (
    <Show 
      when={isAuthenticated()} 
      fallback={<Navigate href="/login" />}
    >
      {props.children}
    </Show>
  );
}

// Usage
<Route path="/dashboard" component={() => (
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
)} />
```

## Route Guards with Preload

```tsx
const checkAuth = cache(async () => {
  const res = await fetch("/api/auth/me");
  if (!res.ok) throw redirect("/login");
  return res.json();
}, "auth");

<Route 
  path="/dashboard" 
  component={Dashboard}
  preload={() => checkAuth()}
/>
```

## Hash Router

```tsx
import { HashRouter, Route } from "@solidjs/router";

<HashRouter>
  <Route path="/" component={Home} />
</HashRouter>
```

## Memory Router (Testing)

```tsx
import { MemoryRouter, Route } from "@solidjs/router";

<MemoryRouter initialEntries={["/users/123"]}>
  <Route path="/users/:id" component={User} />
</MemoryRouter>
```

## Route Actions

```tsx
import { action, useAction, useSubmission } from "@solidjs/router";

const addTodo = action(async (formData: FormData) => {
  const title = formData.get("title");
  await createTodo(title);
  return redirect("/todos");
}, "addTodo");

function AddTodoForm() {
  const submission = useSubmission(addTodo);
  
  return (
    <form action={addTodo} method="post">
      <input name="title" />
      <button disabled={submission.pending}>
        {submission.pending ? "Adding..." : "Add"}
      </button>
    </form>
  );
}
```

## Hooks Summary

| Hook | Purpose |
|------|---------|
| `useParams()` | Access route parameters |
| `useSearchParams()` | Read/write query string |
| `useLocation()` | Current location object |
| `useNavigate()` | Programmatic navigation |
| `useMatch(() => path)` | Check if path matches |
| `useBeforeLeave()` | Guard against navigation |
| `useIsRouting()` | Check if route transition in progress |

## Navigation Guards

```tsx
import { useBeforeLeave } from "@solidjs/router";

function Editor() {
  const [hasUnsaved, setHasUnsaved] = createSignal(false);
  
  useBeforeLeave((e) => {
    if (hasUnsaved() && !e.defaultPrevented) {
      e.preventDefault();
      if (window.confirm("Discard changes?")) {
        e.retry(true); // Force navigation
      }
    }
  });
  
  return <textarea onInput={() => setHasUnsaved(true)} />;
}
```

## Scroll Restoration

```tsx
<Router>
  {/* Automatic scroll restoration */}
  <Route path="/" component={Home} />
</Router>
```

To disable:
```tsx
import { useLocation } from "@solidjs/router";

// Handle manually
createEffect(() => {
  location.pathname; // Track changes
  window.scrollTo(0, 0);
});
```
