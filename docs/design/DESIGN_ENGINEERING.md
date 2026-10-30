# DropIt — Design & Frontend Engineering Standard

Status: **LOCKED for MVP**. Applies to `apps/web` and any shared UI packages.

## 1. Product design principles

1. **Clarity before decoration.** Every visual element must communicate hierarchy, state, action, or feedback.
2. **Fast by default.** Optimize perceived speed, accessibility, and actual performance together.
3. **One strong focal point per screen.** The upload/drop area is the home page's primary action.
4. **No generic AI aesthetic.** Prohibited by default: decorative gradients, glassmorphism, glowing blobs, neon outlines, arbitrary floating shapes, gratuitous shadows, excessive rounded cards, and emoji as UI icons.
5. **No fake complexity.** Avoid dashboards, statistics, onboarding, or feature cards that don't help a user send or receive files.
6. **Consistency over novelty.** Reuse established spacing, type, color, motion, and interaction patterns.
7. **Mobile is first-class.** All core actions must work with touch, keyboard, and assistive technology; drag-and-drop is an enhancement, never the only upload path.

## 2. Visual constraints

- Start with a restrained neutral palette and **one** purposeful accent. Define semantic tokens (`background`, `surface`, `foreground`, `muted`, `border`, `accent`, `danger`, `success`, `focus`) rather than sprinkling literal hex values in components.
- Gradients: **forbidden by default**. Exception requires a written design rationale, demonstrated value, and approval in the PR.
- Shadows: use sparingly for elevation/overlays, never as routine card decoration.
- Radius: use a small, consistent token scale. Avoid rounding every container.
- Typography: maximum two font families (prefer one), consistent type scale, readable line lengths, tabular numbers for file sizes/progress where useful.
- Spacing: use a 4px-based scale through tokens/utilities. No arbitrary spacing values without justification.
- Icons: one coherent icon family; meaningful icons must have accessible labels; decorative icons hidden from screen readers.
- Contrast: WCAG 2.2 AA for text and interactive controls; visible focus rings; do not communicate state through color alone.
- Dark mode is optional for MVP; if implemented, use semantic tokens and test both themes. Never auto-invert assets blindly.
- Copy: direct, human, specific. Avoid marketing filler and ambiguous calls to action.

## 3. Component design & reuse

- Build components around **one responsibility** and a clear public interface. Prefer composition (`children`, slots) to giant boolean-prop APIs.
- Extract a component when it is reused, independently testable, owns a distinct interaction, or makes its parent meaningfully easier to read. **Do not extract** every wrapper or one-line fragment.
- Distinguish primitives (Button, Dialog), domain UI (FileRow, TransferProgress), and page compositions. Do not make domain components generic prematurely.
- Keep state closest to where it is used. Lift it only when multiple siblings need the same source of truth.
- Keep presentation separate from transport/storage operations. Components must not import API clients, R2 SDKs, database code, or server secrets.
- Custom hooks own reusable behavior or lifecycle logic; they are not dumping grounds for unrelated state.
- Prefer explicit prop types, discriminated unions for state, stable keys, and descriptive names. Avoid `any`, nested ternaries, unexplained constants, and prop drilling across many layers.
- Do not create a shared abstraction until there are **at least two real use cases** or a clear domain boundary.
- Prefer platform/browser capabilities before adding a dependency. New UI libraries require justification of bundle, accessibility, maintenance, and alternatives.

## 4. Cohesion, responsibility boundaries & file size

**The rule is separation of responsibilities, not an arbitrary line count.** Around 500 lines is a **review signal, not a hard limit**. A cohesive, readable file may exceed it with a brief rationale. A 90-line god component still fails review.

- **Rendering:** React components compose UI, receive typed props, emit callbacks, and own only local presentation state. They must not orchestrate API calls, storage signing, data normalization, or complex domain workflows.
- **Fetching and mutations:** Feature hooks or dedicated controllers orchestrate network operations, caching, cancellation, retry, and request state. API clients handle HTTP details, headers, and typed request/response boundaries.
- **Processing:** Pure functions and domain modules perform transformations, validation, progress aggregation, and calculations. They must be independently testable without rendering React.
- **State:** Keep ephemeral UI state local. Put multi-step transfer workflow state in a cohesive feature hook/controller, not in a page component or global store by default.
- **Pages:** Route components compose features, resolve route params, and handle routing concerns. They do not implement the entire upload or download workflow.
- **Effects:** Use effects only for external synchronization; do not use them to derive values that can be calculated during render.
- **Extraction trigger:** Extract when responsibilities diverge, logic is independently testable, the same behavior is needed twice, or a parent becomes hard to scan. Do not create single-use wrappers with no semantic value.
- **Size review:** At ~350 lines, ask whether responsibilities are still cohesive. At >500 lines, require a short explanation in the PR, **not** an ADR, waiver, or automatic CI failure. A cohesive parser, table, or test may legitimately be longer.
- **Do not game metrics:** Never compress JSX, remove whitespace, or split one concept across meaningless files just to reduce line counts.

### Required code-review questions

1. Does this component mix rendering with fetching, file processing, or workflow orchestration?
2. Can the core logic be tested without mounting the component?
3. Is the API/storage boundary isolated from UI?
4. Is shared code extracted because it has a clear purpose rather than to hit a line target?
5. Would a future developer know where to change UI, networking, and business rules separately?

If any answer indicates mixed responsibilities, refactor **regardless of file length**.

## 5. State, forms & asynchronous UX

- Every async action must specify **idle, pending, success, error, and recovery** behavior where applicable.
- Upload UI must show per-file progress, overall progress, cancellation, and retry guidance. Never claim upload completion before backend verification.
- Prevent duplicate submissions; use idempotency semantics from the API contract.
- Validate early for helpful UX, but backend validation remains authoritative.
- Never display misleading progress percentages; distinguish upload bytes from verification state.
- Avoid spinner-only screens when meaningful content can render; use skeletons only where they improve comprehension.
- Handle expired links, incorrect passwords, unavailable files, interrupted uploads, and offline state explicitly.
- Don't expose protected filenames or metadata before authorization.

## 6. Accessibility & responsive behavior

- Semantic HTML first; native buttons, links, inputs, and file controls before custom role-based substitutes.
- Keyboard navigation and visible focus are mandatory; dialogs trap focus and restore it on close.
- Dropzone supports click-to-select, keyboard activation, and touch devices.
- Progress indicators expose accessible status (`progressbar`, labels, live announcements throttled to avoid noise).
- Respect `prefers-reduced-motion`; never make animation necessary to understand status.
- Design for 320px widths and up; no horizontal overflow in core flows.
- Touch targets should meet WCAG 2.2 AA target-size requirements or applicable exceptions; prefer at least 44×44 CSS pixels for primary touch controls.
- Test zoom to 200%, long filenames, translated/long copy, and slow networks.

## 7. Motion & performance budgets

- Motion must explain cause/effect or state transition. No ornamental page-load choreography.
- Prefer transform/opacity animation; avoid animating layout properties in high-frequency interactions.
- Default transition duration ~120–220ms; no perpetual animation without functional purpose.
- Avoid heavy blur/backdrop filters, large image assets, and hydration of static content.
- Use server components for static content; client components only where interactivity requires them.
- Avoid importing large libraries into the initial upload route without measurement.
- No polling for upload progress; use browser progress events. Throttle UI updates to a reasonable rate.
- Large file lists must not repeatedly rerender unrelated rows; measure before memoizing.
- Performance changes must preserve correctness, accessibility, and understandable code.

## 8. Suggested structure (not mandatory)

```text
apps/web/src/
  app/                   # routes, layouts, page composition
  components/
    ui/                  # small accessible primitives
    transfer/            # domain-specific components
  features/
    upload/              # upload flow, state, hooks, helpers
    download/            # receiver flow
  lib/                   # typed clients and shared utilities
  styles/                # tokens and global styles
```

Feature code may be colocated when it reduces navigation and avoids circular imports. No folder or abstraction exists without a concrete purpose.

## 9. Review gates (must pass before merge)

- [ ] Components separate presentation from networking, processing, and workflow orchestration; files over ~500 lines have a brief cohesion rationale.
- [ ] Component responsibilities are clear; extraction is justified, not mechanical.
- [ ] No gratuitous gradient, glow, glass, emoji icon, or decorative card stack.
- [ ] Semantic tokens used; no unexplained magic colors/spacing.
- [ ] Keyboard, touch, screen-reader, reduced-motion, and narrow-screen paths work.
- [ ] Loading, failure, retry, cancellation, expiration, and password states are designed as relevant.
- [ ] No secret, R2 credential, or backend-only dependency in client bundles.
- [ ] No needless client requests, progress polling, or unnecessary rerenders.
- [ ] Tests cover meaningful interaction and edge cases; visual screenshots reviewed at mobile and desktop widths.
- [ ] Any new dependency has a written reason and cost assessment.

## 10. AI coding-agent instructions

Before modifying UI, read this file and `AGENTS.md`. Agents must: (a) propose the smallest coherent change; (b) reuse existing patterns; (c) keep files within limits; (d) avoid invented visual flourishes; (e) include all relevant interaction states; (f) report accessibility/performance impact; and (g) never declare a design polished without testing it at mobile and desktop sizes.

When uncertain, favor a calm, high-contrast, utilitarian interface over decorative novelty. Do not silently add dependencies, global state, animation systems, or new design tokens.

## 11. Definition of done

A UI feature is done only when it is functionally correct, readable, accessible, responsive, performant under representative conditions, consistent with tokens, covered by relevant tests, and reviewed in screenshots. A pretty static mockup is not done.
