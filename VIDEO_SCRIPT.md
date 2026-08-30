# Solution Video — Recording Script (≤ 5 minutes)

> **Honesty note (execution rule: never fabricate completed work):** this
> repository cannot render video. Below is the exact storyboard the team
> records with any screen-capture tool (`obs`, QuickTime, `ffmpeg`). Because
> the demo is deterministic, it can be captured **in one take** — every scene
> reproduces identically. Total runtime with pauses: ~4:40.

---

## Scene 1 — Problem & baseline (0:00 – 0:50)

- Open the app → switch to **REPORT** → scroll to **§01 Problem**.
- Say: *"On-call engineers get paged with half the context. Severity lives
  outside the alert text — in tier, blast radius, the calendar. Keyword
  triage over-pages and under-pages."*
- Cut to **§02 Bench**, select **INC-2209 (failover probes)**.
- Run both arms. Point at the verdict table: *baseline pages six people for a
  scheduled drill — the trap note explains why.*

## Scene 2 — One realistic execution, end to end (0:50 – 2:30)

- Switch to **CONSOLE** mode. Let two incidents stream in.
- Click a **page-worthy** incident (e.g. cart crash-loop): narrate the trace —
  catalog → metrics → memory → rules → **critic downgrade SEV1→SEV2** → gate.
- Sign in as *Priya (reviewer)* in the panel, type a note, **approve** →
  "PAGE FIRED".
- Click a **trap** (GameDay or sandbox payments): show **AUTO-RESOLVED** and
  the audit note. Say: *"the baseline woke six people here; the agent filed
  an audit note."*
- Try to reject as *Guest (viewer)* → show the **403, audited** toast.

## Scene 3 — Final comparison (2:30 – 3:30)

- **§03 Eval**: the aggregate table — rubric 30% → 100%, false pages 5 → 0,
  wrong-team 9 → 0.
- **§04 Evidence**: the attribution ladder. Say: *"same 12 cases, one
  capability disabled at a time — computed live, not typed in."*
- Press **run audit** — all checks green on camera.

## Scene 4 — Changelog (3:30 – 4:15)

- **§08 Changelog**. Highlight:
  - **Most contributing change:** the critic pass (71% → 96%, false pages 3 → 1).
  - **Removed experiment:** the LLM free-text severity call — ±18 points per
    run, paged the GameDay drill once, couldn't cite a rule. *"Determinism
    beat eloquence."*

## Scene 5 — Reproduction (4:15 – 4:40)

- Terminal on screen:
  ```
  npm install && npx vitest run     # < 1s, $0.00 — the exact numbers above
  npm run build && npm run preview  # the artifact you're watching
  ```
- Close on the hot take: *"A triage agent doesn't have to be brilliant. It
  has to be auditable at 3 a.m."*

---

**Checklist before upload:** file ≤ 5:00 · begins with problem + baseline ·
one full execution shown · final comparison visible · changelog explained ·
biggest win + one removed experiment named.
