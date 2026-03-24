# Frontend Audit Checklist

Systematic checklist for deep frontend code review. Every item must be checked against actual code — never assumed.

## Table of Contents
1. [Design Authenticity (Anti-AI)](#1-design-authenticity)
2. [Color & Visual Harmony](#2-color--visual-harmony)
3. [Typography & Spacing](#3-typography--spacing)
4. [UX & Interaction Flow](#4-ux--interaction-flow)
5. [Code Quality & Structure](#5-code-quality--structure)
6. [Performance & Memory](#6-performance--memory)
7. [Data Fetching & Queries](#7-data-fetching--queries)
8. [Accessibility](#8-accessibility)

---

## 1. Design Authenticity

Check for AI-generated aesthetic fingerprints:

- [ ] **Font selection** — Is the primary font Inter, Roboto, Arial, or system-ui? If yes, flag for replacement.
- [ ] **Color palette** — Is it a generic blue/purple gradient on white? Count unique hue families — fewer than 3 is suspicious.
- [ ] **Layout symmetry** — Are all sections perfectly center-aligned? Human designs use mixed alignment.
- [ ] **Card uniformity** — Are all cards identical in size, padding, shadow? Real designs vary.
- [ ] **Button styles** — Is every button a rounded-corner gradient pill? Check for variety.
- [ ] **Spacing rhythm** — Is spacing perfectly uniform (all 16px/24px/32px)? Real designs use custom values.
- [ ] **Shadow homogeneity** — Is every shadow `0 4px 6px rgba(0,0,0,0.1)`? Vary depth and spread.
- [ ] **Hero section** — Is it centered text + subtitle + CTA button on gradient? This is the #1 AI pattern.
- [ ] **Icon usage** — Are icons decorative placeholders or functionally meaningful?
- [ ] **Visual texture** — Is the page flat and clinical? Check for grain, patterns, photography, gradients with personality.

Scoring: 3+ flags = high probability of AI-aesthetic. Recommend redesign pass.

## 2. Color & Visual Harmony

Extract every color from the codebase, then analyze:

- [ ] **Color inventory** — List all unique colors. Are there redundant near-duplicates? (e.g., #333 and #2d2d2d)
- [ ] **CSS variable usage** — Are colors defined as variables or hardcoded everywhere?
- [ ] **Harmony type** — Map colors on wheel. Identify if complementary, analogous, triadic, or random.
- [ ] **Primary action color** — Is there ONE clear color for primary actions (buttons, links)?
- [ ] **Semantic colors** — Do success/warning/error states have dedicated colors? Are they consistent?
- [ ] **Contrast ratios** — Check all text/background combinations against WCAG AA:
  - Normal text: 4.5:1 minimum
  - Large text (18px+ or 14px bold): 3:1 minimum
  - UI components: 3:1 minimum
- [ ] **Dark mode** — If present, check that it's not just "invert colors." Verify custom palette.
- [ ] **Hover/focus states** — Do interactive elements have visible, harmonious state changes?
- [ ] **Gradient usage** — Are gradients subtle and purposeful, or slapped on for "modern" effect?
- [ ] **Background layers** — Is there depth? Or is everything flat on #fff / #000?

Color fix patterns:
- Consolidate near-duplicates into CSS variables
- Build palette from ONE base hue + neutrals + one accent
- Use HSL for systematic lightness/saturation adjustments
- Apply 60-30-10 rule: 60% dominant, 30% secondary, 10% accent

## 3. Typography & Spacing

- [ ] **Font loading** — Are fonts loaded via Google Fonts / local? Check for FOIT/FOUT issues.
- [ ] **Font pairing** — Does the heading + body font combination work? Check for contrast in weight and style.
- [ ] **Type scale** — Is there a consistent mathematical scale? (1.25 / 1.333 / 1.5 ratio)
- [ ] **Line height** — Body text should be 1.5-1.7. Headings 1.1-1.3. Check actual values.
- [ ] **Letter spacing** — Are uppercase texts tracked out? Are large headings tightened?
- [ ] **Paragraph width** — Is body text constrained to 45-75 characters per line?
- [ ] **Vertical rhythm** — Do margins/paddings follow a consistent baseline grid?
- [ ] **Responsive typography** — Does font-size scale with viewport? Check clamp() or media queries.
- [ ] **Font weight distribution** — Are more than 3 weights loaded? Each costs performance.
- [ ] **Whitespace intentionality** — Is whitespace used dramatically for hierarchy, or just uniformly applied?

## 4. UX & Interaction Flow

- [ ] **Navigation clarity** — Can user identify where they are and where they can go?
- [ ] **Panel transitions** — Do panels/modals open with smooth transitions (200-400ms)?
- [ ] **Loading states** — Are there skeleton screens or spinners during async operations?
- [ ] **Error states** — Do forms show inline errors? Are error messages helpful?
- [ ] **Empty states** — What happens when lists are empty? Is there guidance?
- [ ] **Keyboard navigation** — Can all interactive elements be reached via Tab? Is focus visible?
- [ ] **Touch targets** — Are mobile tap targets at least 44x44px?
- [ ] **Scroll behavior** — Is scroll smooth where appropriate? Are there scroll-jacking issues?
- [ ] **State persistence** — Does the UI remember form state, scroll position, open/close states?
- [ ] **Micro-interactions** — Are there thoughtful hover effects, button press animations, toggle switches?
- [ ] **Feedback loops** — Does every user action produce visible feedback within 100ms?
- [ ] **Progressive disclosure** — Is complex content revealed gradually, not all at once?
- [ ] **Z-index management** — Are stacking contexts well-organized? Any z-index wars?
- [ ] **Overflow handling** — What happens with long text? Check text-overflow, truncation, scroll.
- [ ] **Responsive breakpoints** — Are breakpoints logical (content-based, not device-based)?

## 5. Code Quality & Structure

- [ ] **DRY violations** — Are there duplicated style blocks, repeated component patterns?
- [ ] **Dead code** — Are there unused CSS classes, unreachable JS branches, commented-out blocks?
- [ ] **CSS specificity issues** — Are there `!important` overrides? Overly specific selectors?
- [ ] **Component granularity** — Are components too large (>200 lines)? Should they be split?
- [ ] **Prop drilling** — Are props passed through 3+ levels? Consider context or state management.
- [ ] **Inline styles** — Are there inline styles that should be in CSS/styled-components?
- [ ] **Magic numbers** — Are there unexplained numeric values? Should they be named constants?
- [ ] **Naming conventions** — Are class names / component names consistent and descriptive?
- [ ] **File organization** — Is the folder structure logical? Can you find things?
- [ ] **Import organization** — Are imports ordered (external > internal > relative > styles)?
- [ ] **Error boundaries** — Do React apps have error boundaries around major sections?
- [ ] **TypeScript coverage** — If TS is used, are there `any` types that should be specific?

## 6. Performance & Memory

- [ ] **Event listener cleanup** — Are addEventListener calls matched with removeEventListener?
- [ ] **Interval/timeout cleanup** — Are setInterval/setTimeout cleared in cleanup functions?
- [ ] **Subscription cleanup** — Are WebSocket, EventSource, observer subscriptions cleaned up?
- [ ] **React effect cleanup** — Do useEffect hooks return cleanup functions where needed?
- [ ] **Detached DOM nodes** — Are references to removed DOM elements still held in variables?
- [ ] **Closure memory** — Are closures capturing large objects unnecessarily?
- [ ] **Re-render audit** — Log React renders. Are components re-rendering when their data hasn't changed?
- [ ] **Memoization** — Are expensive computations wrapped in useMemo? Are stable references in useCallback?
- [ ] **Key prop usage** — Are list keys stable and unique (not array index for dynamic lists)?
- [ ] **Bundle analysis** — What's the bundle size? Are there tree-shakeable alternatives to heavy libs?
- [ ] **Lazy loading** — Are below-fold images and non-critical components lazy loaded?
- [ ] **CSS containment** — Is `contain` property used for isolated components?
- [ ] **Animation performance** — Are animations using transform/opacity (GPU) vs top/left/width (CPU)?
- [ ] **Layout thrashing** — Is DOM read/write batched, or interleaved in loops?
- [ ] **Image optimization** — Are images in modern formats (WebP/AVIF)? Are sizes appropriate?

## 7. Data Fetching & Queries

- [ ] **N+1 in lists** — Does rendering a list trigger individual API calls per item?
- [ ] **useEffect fetch in loop** — Are there effects inside mapped components that each fetch?
- [ ] **Request deduplication** — Are identical requests being made multiple times?
- [ ] **Caching strategy** — Is there any response caching? (SWR, React Query, manual cache)
- [ ] **Error handling** — Do failed requests show user-friendly errors? Is there retry logic?
- [ ] **Loading states** — Is there UI feedback during fetch? Race condition handling?
- [ ] **Pagination** — Are large lists paginated or virtualized? Or loading all at once?
- [ ] **Request waterfall** — Are sequential requests that could be parallel?
- [ ] **Stale data** — Is cached data revalidated? What's the freshness strategy?
- [ ] **Abort on unmount** — Are in-flight requests aborted when components unmount?
- [ ] **Debounce/throttle** — Are search inputs and scroll handlers debounced?
- [ ] **Prefetch** — Are predictable next-page resources prefetched?

## 8. Accessibility

- [ ] **Semantic HTML** — Are proper elements used (nav, main, article, button vs div)?
- [ ] **ARIA labels** — Do icons, images, and custom controls have accessible labels?
- [ ] **Focus management** — Is focus moved appropriately when modals open/close?
- [ ] **Color alone** — Is information conveyed by color also available through text/icons?
- [ ] **Screen reader flow** — Does the DOM order match visual order?
- [ ] **Skip links** — Is there a "skip to content" link for keyboard users?
- [ ] **Form labels** — Are all inputs associated with labels (for/id or wrapping)?
- [ ] **Alt text** — Do all meaningful images have descriptive alt text?
- [ ] **Reduced motion** — Is prefers-reduced-motion respected for animations?
- [ ] **Language attribute** — Is html lang set correctly?
