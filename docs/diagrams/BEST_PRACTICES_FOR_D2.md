# Best Practices for Generating D2 Architecture Diagrams

These rules define how to generate clear, non‑overly‑technical D2 diagrams for software architecture.

## 1. Goals

- Diagrams must be understandable by both engineers and non‑technical stakeholders.
- Prefer high‑level architecture and flows over low‑level implementation details.
- Use a consistent style across all diagrams (shapes, colors, labels, layout).

---

## 2. Diagram types (C4-inspired)

When creating diagrams, choose exactly one of these purposes per diagram:

1. **Context diagram (Level 1)**  
   - Show the main system, its users, and external systems.  
   - Keep between 5–10 elements.

2. **Container diagram (Level 2)**  
   - Show main deployable pieces: web app, API, database, workers, queues, third‑party services.  
   - Keep between 10–20 elements.

3. **Component diagram (Level 3)**  
   - Optional.  
   - Show internal modules of one container (for example "Auth service", "Billing module").

Do not mix all levels in one diagram. Generate multiple focused diagrams instead.

---

## 3. General content rules

- Focus on *what talks to what* and *why*, not HTTP paths or class names.
- Use short, friendly labels with optional subtitles, for example:
  - `Web app
Next.js frontend`
  - `Main database
PostgreSQL`
- Add edge labels only for important relationships (for example "reads & writes data", "publishes events").
- Avoid full URLs, ports, IPs, or internal jargon unless the diagram is explicitly for operations.

---

## 4. Shapes and semantics

Use shapes to encode meaning consistently:

- Users / actors: `shape: c4-person` (or another person‑like shape).
- Services / apps: rectangles.
- Datastores: cylinders.
- External systems / SaaS / cloud: clouds.
- API gateways or special entry points: hexagon (optional).

Example pattern:

```d2
User: {
  shape: c4-person
  label: "**End user**
Uses the product via browser"
}

Frontend: {
  label: "**Web app**
Next.js frontend"
}

Api: {
  label: "**Backend API**
Node.js services"
}

Db: {
  shape: cylinder
  label: "**Main database**
PostgreSQL"
}
```

---

## 5. Layout rules

- Use a single direction per diagram: `direction: right` or `direction: down`.
- Arrange diagrams in layers when possible, for example:  
  users → frontend → backend → data stores → external systems.
- Avoid edge crossings as much as possible; reorder nodes to reduce crossings.
- For grid‑like layouts or layers, use simple horizontal or vertical groupings.

Keep the element count less than or equal to 20 per diagram. If more are needed, split into additional diagrams.

---

## 6. Styling and themes

Aim for a clean, friendly, non‑"enterprise Visio" look.

Recommended global config:

```d2
direction: right

style: {
  fill: "#F7F7FB"
  stroke: "#E0E0EB"
}

node: {
  style: {
    fill: "#FFFFFF"
    stroke: "#A0A0C0"
    radius: 6
  }
}

edge: {
  style: {
    stroke: "#A0A0C0"
    stroke-dash: 0
  }
}
```

Styling rules:

- Prefer a light theme or C4‑like theme, not dark or heavily saturated themes.
- Limit to 3–4 colors with clear meaning (for example user‑facing, internal services, data stores, external systems).
- Prefer soft corners (via `radius`) and subtle borders; avoid heavy shadows.
- Use a consistent font size; highlight only titles or key nodes with bold text.

---

## 7. Tags, classes, and legend

Use tags or classes to style node categories and create a legend.

Example:

```d2
d2-legend: {
  style: { opacity: 100 }
}

frontend: {
  style.fill: "#E3F2FD"
}

backend: {
  style.fill: "#E8F5E9"
}

data: {
  style.fill: "#FFF3E0"
}

external: {
  style.fill: "#F3E5F5"
}
```

Apply these tag names (for example `frontend`, `backend`, `data`, `external`) to nodes so the legend is meaningful in every diagram.

---

## 8. Labels and markdown

- Use markdown labels on important nodes for richer descriptions.
- Pattern: bold short title on first line, short explanation on second line.
- Avoid more than three lines of text per node.

Example:

```d2
Api: {
  label: "**Backend API**
Handles business logic and data access"
}
```

---

## 9. Multiple views and reuse

For larger systems, define a shared model and multiple views.

Guidelines:

- Keep a model file with all nodes and shared styles.
- In view files:
  - Import the model.
  - Suspend everything by default.
  - Unsuspend only the nodes relevant to that view.
- Create view files such as:
  - `SystemContext.d2`
  - `Containers.d2`
  - `PaymentsComponent.d2`

This keeps diagrams consistent and easier to maintain in version control.

---

## 10. Audience adjustments

For non‑technical audiences:

- Prefer context or container diagrams.
- Use human‑readable names (for example "Billing Service"), not internal code names (for example "billing-svc").
- Hide implementation details such as frameworks, database versions, or queue types unless explicitly requested.

For technical audiences:

- You may add frameworks or technology choices to subtitles (for example "Node.js, NestJS").
- Use separate diagrams for deployment details or infrastructure (for example Kubernetes nodes, autoscaling groups).

---

## 11. What not to do

- Do not create one giant diagram with the entire system (for example 50+ nodes); always split into focused diagrams.
- Do not mix context, container, component, and deployment details in the same diagram.
- Do not use many unrelated colors without meaning.
- Do not overload edges with long technical sentences or full protocol details.

---

Use these rules whenever you generate D2 code for architecture diagrams. The output should be simple, readable, and visually consistent, not overly technical or dense.
