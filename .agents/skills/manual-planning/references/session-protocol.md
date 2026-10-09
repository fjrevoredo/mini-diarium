# Session Protocol

## Resume block

Written only by `plan-status.py <plan> resume`, which stamps `Updated` and refuses a block over
3 KB or 40 lines (exit 2). Longer material goes to the notes file (`plan-status.py note`).

| Field | Content |
| --- | --- |
| `State` | Where the work stands. Name a half-finished step explicitly. |
| `Green / Red` | Last full build/lint/test result, and whether red is expected. |
| `Next runnable` | Task id(s) to start next. |
| `Live environment` | Running processes, ports, scratch paths. `none` when nothing is live. |
| `Next IDs` | Next free task and decision id. Computed when omitted. |
| `Risks` | What could go wrong in the remaining work. |
| `Stop` | `<reason> — <detail>` |

```bash
python3 scripts/plan-status.py <plan> resume \
  --state "2.15 half-way: parser landed, tests red" --next "2.15" \
  --green "red: 3 failures in tests/test_pool.py (expected)" \
  --env "dev server on :8787" --stop context
```

## Stop reasons

| Reason | Use when | Detail |
| --- | --- | --- |
| `done` | Every task is `COMPLETED` or `SKIPPED`. | Optional |
| `gate` | A `## Project Gates` item needs the user. | Which gate |
| `question` | Only the user can answer. | The question |
| `context` | Context is running out. | Optional |
| `limit` | A usage or rate limit. | Optional |
| `ask` | None of the above. | Why the user is needed |

## Checker warnings

- `W007` — plan `IN PROGRESS` with an empty, oversized or stop-less Resume block.
- `W009` — a task `IN PROGRESS` across more than 3 resumes: split it.
- `W010` — repeated `ask` stops with no detail.
- `W011` — the plan grew more than 25% between resumes: move evidence to the notes file.

W009–W011 read the event log that every `plan-status.py` write appends to, at
`git rev-parse --git-path manual-planning/<plan-stem>.events.jsonl`.
