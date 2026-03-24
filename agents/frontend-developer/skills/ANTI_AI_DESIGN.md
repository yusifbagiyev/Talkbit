# Anti-AI Design Guide

How to make frontend interfaces that look and feel human-designed. This guide identifies the specific patterns that AI-generated UIs share and provides concrete alternatives.

## Table of Contents
1. [The AI Aesthetic Fingerprint](#the-ai-aesthetic-fingerprint)
2. [Typography That Feels Human](#typography)
3. [Color Palettes With Soul](#color-palettes)
4. [Layout & Composition](#layout--composition)
5. [Micro-Interactions & Motion](#micro-interactions)
6. [Texture & Depth](#texture--depth)
7. [Font Pairing Library](#font-pairing-library)
8. [Color Palette Recipes](#color-palette-recipes)

---

## The AI Aesthetic Fingerprint

AI-generated UIs converge on a recognizable "look." Here's exactly what gives them away:

### The Dead Giveaways

**1. The Gradient Hero**
AI almost always generates: centered heading + subtitle + gradient button on a light background with a purple-blue gradient somewhere. This is the single most recognizable AI pattern.

Instead: Use editorial-style layouts. Left-align the heading. Use a solid-color button. Add a large photograph or illustration. Break the centered column.

**2. The Uniform Card Grid**
AI generates: 3-4 identical cards in a row, same padding, same border-radius, same shadow, same icon-title-description-button structure.

Instead: Vary card sizes. Make one card dominant (2x width). Use different content structures per card. Remove borders from some, add backgrounds to others. Overlap cards slightly.

**3. The Generic Font Stack**
AI defaults to: Inter, Roboto, system-ui, Arial, Poppins, Space Grotesk (overused recently).

Instead: Pick fonts with actual personality. A serif heading font is immediately distinctive. Use Google Fonts' "Feeling Lucky" for discovery. Mix serif + sans-serif.

**4. The Safe Color Palette**
AI generates: 2-3 shades of blue + gray + white, or purple + pink gradient. Maximum "professional," zero personality.

Instead: Start with ONE bold color choice. Build neutrals around it. Add one contrasting accent. The palette should feel intentional, not algorithmic.

**5. The Shadow Monoculture**
Every AI shadow: `box-shadow: 0 4px 6px rgba(0,0,0,0.1)`. This specific shadow is an AI fingerprint.

Instead: Vary shadow depth per element's elevation. Use colored shadows (matching the element's background). Experiment with `inset` shadows. Some elements should have NO shadow.

---

## Typography

### Principles
- **Contrast creates hierarchy** — Your heading and body fonts should look visibly different
- **Personality matches purpose** — A law firm site should not use the same font as a children's app
- **Weight variation** — Don't just use Regular and Bold. Try Light headings + Medium body for unexpected elegance
- **Tracking matters** — Uppercase text needs +0.05-0.1em letter-spacing. Large headings can be -0.02em

### Implementation

```css
/* BAD — Generic AI stack */
font-family: Inter, system-ui, sans-serif;

/* GOOD — Distinctive pairing */
--font-heading: 'Fraunces', Georgia, serif;
--font-body: 'Cabinet Grotesk', Helvetica, sans-serif;

/* Type scale — use a ratio, not arbitrary sizes */
--text-xs: clamp(0.7rem, 0.65rem + 0.25vw, 0.8rem);
--text-sm: clamp(0.8rem, 0.75rem + 0.3vw, 0.9rem);
--text-base: clamp(0.95rem, 0.85rem + 0.4vw, 1.1rem);
--text-lg: clamp(1.15rem, 1rem + 0.6vw, 1.35rem);
--text-xl: clamp(1.4rem, 1.1rem + 1vw, 1.8rem);
--text-2xl: clamp(1.8rem, 1.3rem + 1.8vw, 2.6rem);
--text-3xl: clamp(2.4rem, 1.5rem + 3vw, 4rem);

/* Line heights — tighter for headings, looser for body */
h1, h2, h3 { line-height: 1.15; }
p, li { line-height: 1.65; }

/* Measure — constrain paragraph width */
.prose { max-width: 65ch; }
```

### Choosing Font Pairings That Don't Look AI

Rule of thumb: if you've seen it on 5+ AI demos, don't use it.

**Avoid (overused by AI):**
- Inter + anything
- Space Grotesk + anything
- Poppins + anything
- DM Sans + DM Serif Display (this specific pairing is extremely common in AI output)

**Discovery method:**
1. Go to Google Fonts
2. Filter by category (Serif, Display, Handwriting)
3. Pick something with character — look at the lowercase 'g', 'a', 'e' for distinctiveness
4. Pair it with a contrasting style (serif heading + geometric sans body, or vice versa)

---

## Color Palettes

### The 60-30-10 System
- 60% dominant (background, large surfaces) — usually a neutral
- 30% secondary (supporting areas, cards, sections) — muted version of brand color
- 10% accent (CTAs, highlights, key UI elements) — the bold, memorable color

### Building a Non-AI Palette

**Step 1: Pick your hero color**
Not blue. Not purple. Try:
- Deep forest green (#1a3a2a)
- Warm terracotta (#c45d3e)
- Rich navy with warmth (#1e2a3a)
- Dusty rose (#b5838d)
- Burnt orange (#cc5500)
- Olive (#606c38)

**Step 2: Build neutrals with warmth or coolness**
Don't use pure gray (#gray). Tint your neutrals:
```css
/* Warm neutrals (for warm palettes) */
--neutral-50: #faf8f5;
--neutral-100: #f0ece5;
--neutral-200: #ddd6ca;
--neutral-300: #c4b9a8;
--neutral-800: #3d3529;
--neutral-900: #2a241c;

/* Cool neutrals (for cool palettes) */
--neutral-50: #f5f7fa;
--neutral-100: #e8ecf0;
--neutral-200: #ccd3dc;
--neutral-800: #2a3040;
--neutral-900: #1a1f2e;
```

**Step 3: Add ONE accent**
The accent should contrast with your hero. If hero is warm, accent is cool (or vice versa).

### Color Harmony Validation

After defining your palette, verify:
1. Plot main colors on HSL wheel — they should form a recognizable harmony pattern
2. Check every text/background pair for WCAG AA contrast (use `contrast-ratio.com`)
3. Simulate color blindness (Chrome DevTools > Rendering > Emulate vision deficiencies)
4. View the palette at arm's length — does one color dominate? (it should)

---

## Layout & Composition

### Breaking the AI Grid

AI layouts are always: header → hero → 3-column features → testimonials → CTA → footer. Every section is full-width, centered, evenly padded.

**Human layout techniques:**
- **Asymmetric splits** — 60/40 or 70/30 instead of 50/50
- **Broken grid** — Let an image overflow its column by 10-15%
- **Negative space as design element** — Leave one side deliberately empty
- **Varying section heights** — Not every section needs the same padding
- **Overlapping elements** — Cards that overlap section boundaries, images that break columns
- **Diagonal flow** — Use CSS clip-path or skewed backgrounds to create diagonal lines
- **Sticky elements** — A sidebar label or section indicator that follows scroll

```css
/* Instead of uniform padding */
.section-hero { padding: 8rem 0 4rem; }
.section-features { padding: 3rem 0 6rem; }
.section-about { padding: 5rem 0 2rem; }

/* Asymmetric grid */
.grid-asymmetric {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 2rem;
}

/* Broken grid — image overflows */
.feature-image {
  width: 115%;
  margin-left: -8%;
}
```

---

## Micro-Interactions

### Principles
- Every interaction should feel physically plausible — buttons should "press down," toggles should "slide"
- Use ease-out for entrances, ease-in for exits, ease-in-out for state changes
- 150-300ms for micro-interactions, 300-500ms for page transitions
- Don't animate everything — pick 2-3 key moments

### Patterns That Feel Human

```css
/* Button with physical press feel */
.btn {
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
}
.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.btn:active {
  transform: translateY(1px);
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}

/* Card with subtle lift */
.card {
  transition: transform 0.25s ease-out, box-shadow 0.3s ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04);
}

/* Staggered entrance — NOT all items at once */
.list-item {
  opacity: 0;
  transform: translateY(12px);
  animation: fadeInUp 0.4s ease-out forwards;
}
.list-item:nth-child(1) { animation-delay: 0ms; }
.list-item:nth-child(2) { animation-delay: 60ms; }
.list-item:nth-child(3) { animation-delay: 120ms; }
.list-item:nth-child(4) { animation-delay: 180ms; }

@keyframes fadeInUp {
  to { opacity: 1; transform: translateY(0); }
}

/* Link underline that slides in */
.link {
  text-decoration: none;
  background-image: linear-gradient(currentColor, currentColor);
  background-size: 0% 1px;
  background-position: left bottom;
  background-repeat: no-repeat;
  transition: background-size 0.3s ease-out;
}
.link:hover {
  background-size: 100% 1px;
}
```

### Reduced Motion

Always respect user preference:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Texture & Depth

### Adding Atmosphere

Flat white backgrounds are the biggest AI tell. Add depth:

```css
/* Noise texture overlay */
.textured {
  position: relative;
}
.textured::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  pointer-events: none;
  z-index: 1;
}

/* Gradient mesh (subtle, organic) */
.mesh-bg {
  background:
    radial-gradient(ellipse at 20% 80%, rgba(var(--accent-rgb), 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(var(--primary-rgb), 0.06) 0%, transparent 50%),
    var(--bg-base);
}

/* Layered shadows for depth */
.elevated-1 { box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
.elevated-2 { box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.06); }
.elevated-3 { box-shadow: 0 4px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.06); }
```

---

## Font Pairing Library

Distinctive pairings organized by mood. Import from Google Fonts.

### Editorial / Sophisticated
- **Heading:** Playfair Display (700) **Body:** Source Sans 3 (400, 600)
- **Heading:** Cormorant Garamond (600) **Body:** Work Sans (400, 500)
- **Heading:** Libre Baskerville (700) **Body:** Karla (400, 500)

### Modern / Clean (but NOT generic)
- **Heading:** Sora (700) **Body:** Nunito Sans (400, 600)
- **Heading:** General Sans (via Fontshare, 600) **Body:** Satoshi (400)
- **Heading:** Outfit (700) **Body:** Atkinson Hyperlegible (400)

### Bold / Statement
- **Heading:** Fraunces (800, italic) **Body:** Instrument Sans (400, 500)
- **Heading:** Clash Display (via Fontshare, 700) **Body:** Switzer (400)
- **Heading:** Bricolage Grotesque (800) **Body:** Libre Franklin (400, 500)

### Warm / Approachable
- **Heading:** Lora (700) **Body:** Rubik (400, 500)
- **Heading:** Bitter (700) **Body:** Figtree (400, 500)
- **Heading:** Vollkorn (700) **Body:** Public Sans (400, 500)

### Technical / Precise
- **Heading:** JetBrains Mono (700) **Body:** IBM Plex Sans (400, 500)
- **Heading:** Space Mono (700) **Body:** Manrope (400, 500)

---

## Color Palette Recipes

Pre-built palettes that avoid the AI blue/purple trap:

### Forest Authority
```css
--primary: #2d5016;    /* Deep forest */
--accent: #d4a03c;     /* Golden amber */
--bg: #faf8f2;         /* Warm cream */
--text: #1c1c1a;       /* Near-black warm */
--muted: #8a8577;      /* Warm gray */
```

### Terracotta Studio
```css
--primary: #c45d3e;    /* Warm terracotta */
--accent: #2a6b7c;     /* Teal contrast */
--bg: #fdf6f0;         /* Peach cream */
--text: #2a1f1a;       /* Dark chocolate */
--muted: #9a8a80;      /* Sandstone */
```

### Midnight Ink
```css
--primary: #1a1a2e;    /* Deep navy */
--accent: #e07a5f;     /* Coral pop */
--bg: #f8f7f4;         /* Paper white */
--text: #16161a;       /* Rich black */
--muted: #72727e;      /* Slate */
```

### Sage Minimal
```css
--primary: #606c38;    /* Olive sage */
--accent: #bc4749;     /* Berry red */
--bg: #fefae0;         /* Parchment */
--text: #283618;       /* Forest ink */
--muted: #8a8872;      /* Dried herb */
```

### Ocean Depth
```css
--primary: #184e77;    /* Deep ocean */
--accent: #d9a441;     /* Sunlight gold */
--bg: #f0f4f8;         /* Misty blue */
--text: #0d1b2a;       /* Abyss */
--muted: #6b8299;      /* Sea fog */
```

### Blush Commerce
```css
--primary: #7c3750;    /* Deep rose */
--accent: #c8963e;     /* Champagne gold */
--bg: #faf5f7;         /* Blush */
--text: #2a1520;       /* Dark plum */
--muted: #9a8a90;      /* Mauve gray */
```

Each recipe includes primary, accent, background, text, and muted values. Extend with 50-900 shade scales by adjusting HSL lightness in 8-10% steps.
