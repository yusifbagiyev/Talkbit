# Frontend Audit Skill

Deep, multi-dimensional analysis of frontend code. Catches real problems, proposes battle-tested fixes, and ensures every UI output feels human-crafted — never generic or AI-generated.

---

## Workflow

### Phase 1: Reconnaissance
1. Read all source files — every .html, .jsx, .tsx, .vue, .css, .scss, .js, .ts file in scope
2. Map the component tree — understand parent-child relationships, data flow, shared state
3. Identify the tech stack — React? Vue? Vanilla? What CSS approach? What build tool?
4. Catalog all external dependencies
5. Mentally render — understand what the user actually sees

### Phase 2: Multi-Dimensional Audit
Run every applicable check across seven domains:
1. Design Authenticity — Does it look human-designed or AI-generated?
2. Color & Visual Harmony — Are colors intentional, harmonious, and accessible?
3. Typography & Spacing — Are fonts distinctive? Is vertical rhythm maintained?
4. UX & Interaction Flow — Are transitions smooth? Is navigation intuitive?
5. Code Quality & Optimization — Is the code DRY, performant, well-structured?
6. Performance & Memory — Are there leaks, unnecessary re-renders, heavy payloads?
7. Data Fetching & Queries — N+1 problems, over-fetching, missing caching?

### Phase 3: Report Structure
For each finding:
```
PROBLEM: [Concise description]
LOCATION: [Exact file, line number, or component]
SEVERITY: Critical | High | Medium | Low
EVIDENCE: [The specific code that proves this is real]
FIX: [Concrete code change]
SAFE: [Confirm fix doesn't break existing functionality]
```

### Phase 4: Implementation
- Never modify code you haven't read first
- One fix at a time — apply, verify, then move to next
- Preserve existing behavior unless redesign is explicitly requested

---

## Audit Checklist (80+ Points)

### 1. Design Authenticity (Anti-AI)
- [ ] Font selection — Is primary font Inter, Roboto, Arial, or system-ui? Flag for replacement.
- [ ] Color palette — Generic blue/purple gradient on white? Count unique hue families.
- [ ] Layout symmetry — All sections perfectly center-aligned? Human designs use mixed alignment.
- [ ] Card uniformity — All cards identical in size, padding, shadow?
- [ ] Button styles — Every button a rounded-corner gradient pill?
- [ ] Spacing rhythm — Perfectly uniform (all 16px/24px/32px)?
- [ ] Shadow homogeneity — Every shadow `0 4px 6px rgba(0,0,0,0.1)`?
- [ ] Icon usage — Decorative placeholders or functionally meaningful?
- [ ] Visual texture — Flat and clinical? Check for grain, patterns, gradients with personality.

Scoring: 3+ flags = high probability of AI-aesthetic.

### 2. Color & Visual Harmony
- [ ] Color inventory — List all unique colors. Redundant near-duplicates?
- [ ] CSS variable usage — Colors defined as variables or hardcoded everywhere?
- [ ] Harmony type — Complementary, analogous, triadic, or random?
- [ ] Primary action color — ONE clear color for primary actions?
- [ ] Semantic colors — Success/warning/error have dedicated colors?
- [ ] Contrast ratios — Normal text: 4.5:1 min | Large text: 3:1 min | UI components: 3:1 min
- [ ] Hover/focus states — Visible, harmonious state changes?
- [ ] Gradient usage — Subtle and purposeful, or decorative?

Fix patterns:
- Consolidate near-duplicates into CSS variables
- Build palette from ONE base hue + neutrals + one accent
- Use HSL for systematic lightness/saturation adjustments
- Apply 60-30-10 rule: 60% dominant, 30% secondary, 10% accent

### 3. Typography & Spacing
- [ ] Font pairing — Does heading + body font combination work?
- [ ] Type scale — Consistent mathematical scale? (1.25 / 1.333 / 1.5 ratio)
- [ ] Line height — Body: 1.5-1.7 | Headings: 1.1-1.3
- [ ] Letter spacing — Uppercase texts tracked out? Large headings tightened?
- [ ] Paragraph width — Body text constrained to 45-75 characters per line?
- [ ] Vertical rhythm — Margins/paddings follow consistent baseline grid?
- [ ] Responsive typography — font-size scales with viewport? clamp() or media queries?

### 4. UX & Interaction Flow
- [ ] Panel transitions — Panels/modals open with smooth transitions (200-400ms)?
- [ ] Loading states — Skeleton screens or spinners during async operations?
- [ ] Error states — Forms show inline errors? Error messages helpful?
- [ ] Empty states — What happens when lists are empty? Is there guidance?
- [ ] Keyboard navigation — All interactive elements reachable via Tab?
- [ ] Scroll behavior — Smooth where appropriate? No scroll-jacking?
- [ ] State persistence — UI remembers scroll position, open/close states?
- [ ] Micro-interactions — Thoughtful hover effects, button press animations?
- [ ] Feedback loops — Every action produces visible feedback within 100ms?
- [ ] Z-index management — Stacking contexts well-organized? No z-index wars?
- [ ] Overflow handling — Long text handled? text-overflow, truncation, scroll?

### 5. Code Quality & Structure
- [ ] DRY violations — Duplicated style blocks, repeated component patterns?
- [ ] Dead code — Unused CSS classes, unreachable JS branches, commented-out blocks?
- [ ] CSS specificity issues — `!important` overrides? Overly specific selectors?
- [ ] Component granularity — Components too large (>200 lines)?
- [ ] Prop drilling — Props passed through 3+ levels?
- [ ] Inline styles — Inline styles that should be in CSS?
- [ ] Magic numbers — Unexplained numeric values?
- [ ] Naming conventions — Class names / component names consistent and descriptive?
- [ ] Error boundaries — React apps have error boundaries around major sections?

### 6. Performance & Memory
- [ ] Event listener cleanup — addEventListener matched with removeEventListener?
- [ ] Interval/timeout cleanup — setInterval/setTimeout cleared in cleanup functions?
- [ ] Subscription cleanup — WebSocket, EventSource, observer subscriptions cleaned up?
- [ ] React effect cleanup — useEffect hooks return cleanup functions where needed?
- [ ] Re-render audit — Components re-rendering when their data hasn't changed?
- [ ] Memoization — Expensive computations in useMemo? Stable references in useCallback?
- [ ] Key prop usage — List keys stable and unique (not array index for dynamic lists)?
- [ ] Animation performance — Using transform/opacity (GPU) vs top/left/width (CPU)?
- [ ] Layout thrashing — DOM read/write batched, or interleaved in loops?

> **IMPORTANT:** Virtual scrolling (react-virtual, windowing) is FORBIDDEN in this project.
> Use instead: React.memo, useMemo, useCallback, debounce/throttle, cursor-based pagination.

### 7. Data Fetching & Queries
- [ ] N+1 in lists — Rendering a list triggers individual API calls per item?
- [ ] Request deduplication — Identical requests being made multiple times?
- [ ] Error handling — Failed requests show user-friendly errors? Retry logic?
- [ ] Loading states — UI feedback during fetch? Race condition handling?
- [ ] Request waterfall — Sequential requests that could be parallel?
- [ ] Abort on unmount — In-flight requests aborted when components unmount?
- [ ] Debounce/throttle — Search inputs and scroll handlers debounced?

### 8. Accessibility
- [ ] Semantic HTML — Proper elements used (nav, main, article, button vs div)?
- [ ] ARIA labels — Icons, images, custom controls have accessible labels?
- [ ] Focus management — Focus moved when modals open/close?
- [ ] Color alone — Information conveyed by color also available through text/icons?
- [ ] Form labels — All inputs associated with labels?
- [ ] Reduced motion — prefers-reduced-motion respected for animations?

---

## Anti-AI Design Principles

### Dead Giveaways (Avoid These)
1. **Gradient Hero** — Centered heading + subtitle + gradient button. Most recognizable AI pattern.
2. **Uniform Card Grid** — 3-4 identical cards, same padding, border-radius, shadow.
3. **Generic Font Stack** — Inter, Roboto, system-ui, Arial, Poppins, Space Grotesk.
4. **Safe Color Palette** — 2-3 shades of blue + gray + white, or purple + pink gradient.
5. **Shadow Monoculture** — `box-shadow: 0 4px 6px rgba(0,0,0,0.1)` on everything.

### What Human Designers Do
- Mix font weights unexpectedly (light heading + bold body)
- Use asymmetric layouts (60/40 or 70/30 splits, not 50/50)
- Choose ONE hero color and build around it with neutrals
- Add texture — noise, grain, subtle patterns
- Break the grid occasionally for visual interest
- Use whitespace dramatically, not uniformly
- Create hierarchy through size contrast, not just weight
- Vary shadow depth per element's elevation

### Typography
```css
/* BAD — Generic AI stack */
font-family: Inter, system-ui, sans-serif;

/* GOOD — Distinctive pairing */
--font-heading: 'Fraunces', Georgia, serif;
--font-body: 'Cabinet Grotesk', Helvetica, sans-serif;

/* Type scale with ratio */
--text-sm: clamp(0.8rem, 0.75rem + 0.3vw, 0.9rem);
--text-base: clamp(0.95rem, 0.85rem + 0.4vw, 1.1rem);
--text-lg: clamp(1.15rem, 1rem + 0.6vw, 1.35rem);
--text-xl: clamp(1.4rem, 1.1rem + 1vw, 1.8rem);

h1, h2, h3 { line-height: 1.15; }
p, li { line-height: 1.65; }
.prose { max-width: 65ch; }
```

### Color Palettes (Non-AI Recipes)
```css
/* Ocean Depth */
--primary: #184e77;
--accent: #d9a441;
--bg: #f0f4f8;
--text: #0d1b2a;
--muted: #6b8299;

/* Midnight Ink */
--primary: #1a1a2e;
--accent: #e07a5f;
--bg: #f8f7f4;
--text: #16161a;
--muted: #72727e;

/* Terracotta Studio */
--primary: #c45d3e;
--accent: #2a6b7c;
--bg: #fdf6f0;
--text: #2a1f1a;
--muted: #9a8a80;
```

### Micro-Interactions
```css
/* Button with physical press feel */
.btn {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}
.btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.btn:active { transform: translateY(1px); box-shadow: 0 1px 3px rgba(0,0,0,0.12); }

/* Staggered list entrance */
.list-item {
  opacity: 0;
  transform: translateY(12px);
  animation: fadeInUp 0.4s ease-out forwards;
}
.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 60ms; }
.list-item:nth-child(3) { animation-delay: 120ms; }

@keyframes fadeInUp { to { opacity: 1; transform: translateY(0); } }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Performance Patterns

### Memory Leaks

```javascript
// Event listener — always clean up
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);

// Timer — always clear
useEffect(() => {
  const id = setInterval(() => fetchData(), 5000);
  return () => clearInterval(id);
}, []);

// Fetch — abort on unmount
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json()).then(setData)
    .catch(e => { if (e.name !== 'AbortError') throw e; });
  return () => controller.abort();
}, []);
```

### React Re-renders

```jsx
// Stable references — prevent child re-renders
const childStyle = { color: 'red' }; // outside component
const onClick = useCallback(() => handleClick(id), [id]);

// Memoize expensive computations
const filtered = useMemo(() =>
  items.filter(i => i.active).sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// Wrap pure display components
const UserCard = React.memo(function UserCard({ name }) {
  return <div>{name}</div>;
});

// Stable list keys — never use index for dynamic lists
{items.map(item => <Item key={item.id} data={item} />)}
```

### Animation (GPU Only)

```css
/* GOOD — GPU composited, no layout trigger */
.animate { transition: transform 0.3s, opacity 0.3s; }

/* BAD — triggers layout recalc */
.animate { transition: left 0.3s, width 0.3s; }
```

### N+1 Detection

Search for these patterns:
1. `useEffect` + `fetch` inside a component rendered in `.map()`
2. `useSWR` / `useQuery` inside a mapped child component
3. Any API call where URL includes a dynamic ID and component is in a list

Fix: Move fetch to parent level, pass data as props to children.

### Parallel Requests

```javascript
// BAD — sequential
const user = await fetch('/api/user');
const posts = await fetch('/api/posts');

// GOOD — parallel
const [user, posts] = await Promise.all([
  fetch('/api/user'),
  fetch('/api/posts'),
]);
```

### CSS Performance

```css
/* Isolate components */
.card { contain: layout style paint; }

/* Shadow via pseudo-element (avoids repaint) */
.btn::after {
  content: '';
  position: absolute;
  inset: 0;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  opacity: 0;
  transition: opacity 0.3s;
}
.btn:hover::after { opacity: 1; }
```
