# SolidStart Reference

Complete guide to building full-stack applications with SolidStart, the SolidJS meta-framework.

## Overview

SolidStart is built on:
- **Solid** — Fine-grained reactive UI library
- **Vinxi** — Framework bundler (Vite + Nitro)
- **File-based routing** — via Solid Router

## Quick Start

```bash
# Create new project
npm create solid@latest my-app

# Options during setup:
# - With TypeScript? Yes
# - Template: SolidStart

cd my-app
npm install
npm run dev
```

## Project Structure

```
my-app/
├── src/
│   ├── routes/           # File-based routes
│   │   ├── index.tsx     # /
│   │   ├── about.tsx     # /about
│   │   └── users/
│   │       ├── index.tsx # /users
│   │       └── [id].tsx  # /users/:id
│   ├── components/       # Shared components
│   ├── lib/              # Utilities
│   └── entry-server.tsx  # Server entry
│   └── entry-client.tsx  # Client entry
├── public/               # Static assets
├── app.config.ts         # SolidStart config
└── package.json
```

## Configuration

**app.config.ts:**
```ts
import { defineConfig } from "@solidjs/start/config";

export default defineConfig({
  server: {
    preset: "node-server", // or "vercel", "netlify", "cloudflare-pages"
    // prerender: { routes: ["/", "/about"] }
  },
  vite: {
    // Vite options
  }
});
```

## Rendering Modes

### SSR (Default)
```ts
// app.config.ts
export default defineConfig({
  server: {
    preset: "node-server"
  }
});
```

### Static Site Generation (SSG)
```ts
export default defineConfig({
  server: {
    prerender: {
      routes: ["/", "/about", "/posts"],
      // or crawl from root
      crawlLinks: true
    }
  }
});
```

### Client-Side Only (SPA)
```ts
export default defineConfig({
  ssr: false
});
```

## File-Based Routing

### Basic Routes

| File | Route |
|------|-------|
| `routes/index.tsx` | `/` |
| `routes/about.tsx` | `/about` |
| `routes/blog/index.tsx` | `/blog` |
| `routes/blog/[slug].tsx` | `/blog/:slug` |
| `routes/[...all].tsx` | `/*all` (catch-all) |

### Dynamic Routes

```tsx
// routes/users/[id].tsx
import { useParams } from "@solidjs/router";

export default function User() {
  const params = useParams();
  return <div>User: {params.id}</div>;
}
```

### Route Groups

Folders starting with `(name)` are groups (not in URL):

```
routes/
├── (auth)/
│   ├── login.tsx     # /login
│   └── register.tsx  # /register
└── (dashboard)/
    └── settings.tsx  # /settings
```

### Layout Files

```tsx
// routes/(dashboard).tsx — Layout for dashboard group
export default function DashboardLayout(props) {
  return (
    <div class="dashboard">
      <Sidebar />
      <main>{props.children}</main>
    </div>
  );
}
```

### 404 Page

```tsx
// routes/[...404].tsx
export default function NotFound() {
  return <div>Page Not Found</div>;
}
```

## Data Fetching

### Server-Side Data Loading

```tsx
// routes/users/[id].tsx
import { cache, createAsync } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";

const getUser = cache(async (id: string) => {
  "use server";
  const response = await fetch(`https://api.example.com/users/${id}`);
  return response.json();
}, "user");

export const route = {
  preload: ({ params }) => getUser(params.id)
};

export default function User() {
  const params = useParams();
  const user = createAsync(() => getUser(params.id));
  
  return (
    <Show when={user()}>
      {(user) => <h1>{user().name}</h1>}
    </Show>
  );
}
```

### createAsync

```tsx
import { createAsync } from "@solidjs/router";

const data = createAsync(() => fetchData(), {
  initialValue: [],
  deferStream: true // Wait for data before streaming
});
```

### Error Handling

```tsx
import { ErrorBoundary } from "solid-js";

export default function Page() {
  const data = createAsync(async () => {
    const res = await fetch("/api/data");
    if (!res.ok) throw new Error("Failed");
    return res.json();
  });
  
  return (
    <ErrorBoundary fallback={(err) => <div>Error: {err.message}</div>}>
      <Suspense fallback={<Loading />}>
        <DataView data={data()} />
      </Suspense>
    </ErrorBoundary>
  );
}
```

## API Routes

### Basic API Route

```tsx
// routes/api/hello.ts
import { APIEvent } from "@solidjs/start/server";

export function GET(event: APIEvent) {
  return new Response(JSON.stringify({ message: "Hello" }), {
    headers: { "Content-Type": "application/json" }
  });
}

export function POST(event: APIEvent) {
  const body = await event.request.json();
  // Process body
  return new Response(JSON.stringify({ success: true }));
}
```

### Dynamic API Routes

```tsx
// routes/api/users/[id].ts
export async function GET(event: APIEvent) {
  const id = event.params.id;
  const user = await db.users.find(id);
  return Response.json(user);
}
```

### Request Event

```tsx
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const searchParams = url.searchParams;
  const headers = event.request.headers;
  const cookies = event.request.headers.get("cookie");
  
  // Set cookies
  return new Response(data, {
    headers: {
      "Set-Cookie": "session=abc123; HttpOnly"
    }
  });
}
```

## Server Functions

### "use server" Directive

```tsx
// Can be in any file
async function saveUser(data: FormData) {
  "use server";
  // Runs only on server
  const name = data.get("name");
  await db.users.create({ name });
  return { success: true };
}
```

### Server Actions

```tsx
import { action, useAction, useSubmission } from "@solidjs/router";

const addTodo = action(async (formData: FormData) => {
  "use server";
  const title = formData.get("title");
  await db.todos.create({ title });
  throw redirect("/todos"); // Redirect after action
}, "addTodo");

function AddTodoForm() {
  const submission = useSubmission(addTodo);
  
  return (
    <form action={addTodo} method="post">
      <input name="title" required />
      <button disabled={submission.pending}>
        {submission.pending ? "Adding..." : "Add Todo"}
      </button>
      {submission.error && <p>Error: {submission.error.message}</p>}
    </form>
  );
}
```

### Progressive Enhancement

Forms work without JavaScript:

```tsx
<form action={submitForm} method="post">
  <input name="email" type="email" />
  <button>Submit</button>
</form>
```

## Middleware

```tsx
// src/middleware.ts
import { createMiddleware } from "@solidjs/start/middleware";

export default createMiddleware({
  onRequest: [
    async (event) => {
      console.log("Request:", event.request.url);
      // Return Response to short-circuit
      // Return undefined to continue
    }
  ],
  onBeforeResponse: [
    async (event, response) => {
      // Modify response
      return response;
    }
  ]
});
```

Register in config:
```ts
// app.config.ts
export default defineConfig({
  middleware: "./src/middleware.ts"
});
```

## Authentication

### Session-Based

```tsx
// lib/session.ts
import { useSession } from "@solidjs/start/server";

export function getSession() {
  "use server";
  return useSession({
    password: process.env.SESSION_SECRET!,
    cookie: {
      name: "session",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7 // 1 week
    }
  });
}

// Usage in server function
async function login(formData: FormData) {
  "use server";
  const session = await getSession();
  
  // Validate credentials...
  
  await session.update({ userId: user.id });
  throw redirect("/dashboard");
}

async function logout() {
  "use server";
  const session = await getSession();
  await session.clear();
  throw redirect("/");
}
```

### Protected Routes

```tsx
// routes/(protected).tsx
import { getSession } from "~/lib/session";
import { redirect } from "@solidjs/router";

export const route = {
  preload: async () => {
    const session = await getSession();
    if (!session.data.userId) {
      throw redirect("/login");
    }
  }
};

export default function ProtectedLayout(props) {
  return props.children;
}
```

## Head & Meta

```tsx
import { Title, Meta, Link } from "@solidjs/meta";

export default function Page() {
  return (
    <>
      <Title>Page Title</Title>
      <Meta name="description" content="Page description" />
      <Meta property="og:title" content="OG Title" />
      <Link rel="canonical" href="https://example.com/page" />
      
      <div>Content</div>
    </>
  );
}
```

## Environment Variables

```bash
# .env
DATABASE_URL=postgres://...
VITE_API_URL=https://api.example.com  # Exposed to client
```

```tsx
// Server only
const dbUrl = process.env.DATABASE_URL;

// Client (must start with VITE_)
const apiUrl = import.meta.env.VITE_API_URL;
```

## Static Assets

Place in `public/`:
```
public/
├── favicon.ico
├── robots.txt
└── images/
    └── logo.png
```

Access at root:
```tsx
<img src="/images/logo.png" alt="Logo" />
```

## CSS & Styling

### Global CSS

```tsx
// routes/index.tsx or root layout
import "./global.css";
```

### CSS Modules

```tsx
import styles from "./Button.module.css";

<button class={styles.primary}>Click</button>
```

### Tailwind CSS

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

```ts
// tailwind.config.js
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"]
};
```

```css
/* src/app.css */
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## Deployment

### Node.js Server

```bash
npm run build
node .output/server/index.mjs
```

### Vercel

```ts
// app.config.ts
export default defineConfig({
  server: { preset: "vercel" }
});
```

### Netlify

```ts
export default defineConfig({
  server: { preset: "netlify" }
});
```

### Cloudflare Pages

```ts
export default defineConfig({
  server: { preset: "cloudflare-pages" }
});
```

## WebSocket Endpoints

```tsx
// routes/api/ws.ts
import { defineWebSocket } from "@solidjs/start/server";

export const GET = defineWebSocket({
  open(peer) {
    console.log("Connected:", peer.id);
  },
  message(peer, message) {
    peer.send(`Echo: ${message}`);
  },
  close(peer) {
    console.log("Disconnected:", peer.id);
  }
});
```

## Request Event in Components

```tsx
import { getRequestEvent } from "solid-js/web";

async function getData() {
  "use server";
  const event = getRequestEvent();
  const url = new URL(event.request.url);
  const userAgent = event.request.headers.get("user-agent");
  return { url: url.pathname, userAgent };
}
```

## TypeScript

```tsx
// Type for route params
import type { RouteDefinition } from "@solidjs/router";

export const route: RouteDefinition = {
  preload: ({ params }) => getUser(params.id)
};

// Type for API routes
import type { APIEvent } from "@solidjs/start/server";

export async function GET(event: APIEvent) {
  // event is fully typed
}
```
