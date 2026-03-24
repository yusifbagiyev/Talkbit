# Performance Optimization Guide

Concrete patterns for fixing frontend performance issues. Every pattern includes the problem signature, detection method, and fix with code.

## Table of Contents
1. [Memory Leaks](#1-memory-leaks)
2. [React-Specific Performance](#2-react-specific-performance)
3. [DOM & Rendering Performance](#3-dom--rendering-performance)
4. [Network & Data Fetching](#4-network--data-fetching)
5. [CSS Performance](#5-css-performance)
6. [Bundle & Asset Optimization](#6-bundle--asset-optimization)
7. [N+1 Query Patterns](#7-n1-query-patterns)

---

## 1. Memory Leaks

### 1.1 Event Listener Leaks

**Problem signature:** addEventListener called without matching removeEventListener, especially in React useEffect or componentDidMount.

**Detection:** Search for `addEventListener` — every one must have a corresponding `removeEventListener` in a cleanup path.

```javascript
// BAD — listener never removed
useEffect(() => {
  window.addEventListener('resize', handleResize);
}, []);

// GOOD — cleanup on unmount
useEffect(() => {
  window.addEventListener('resize', handleResize);
  return () => window.removeEventListener('resize', handleResize);
}, []);
```

### 1.2 Timer Leaks

**Problem signature:** setInterval or setTimeout without clearInterval/clearTimeout.

```javascript
// BAD — interval runs forever even after unmount
useEffect(() => {
  setInterval(() => fetchData(), 5000);
}, []);

// GOOD — cleared on unmount
useEffect(() => {
  const id = setInterval(() => fetchData(), 5000);
  return () => clearInterval(id);
}, []);
```

### 1.3 Subscription Leaks

**Problem signature:** WebSocket, EventSource, Observable, or MutationObserver opened but never closed.

```javascript
// BAD — WebSocket stays open after component unmount
useEffect(() => {
  const ws = new WebSocket('wss://example.com');
  ws.onmessage = handleMessage;
}, []);

// GOOD — connection closed on cleanup
useEffect(() => {
  const ws = new WebSocket('wss://example.com');
  ws.onmessage = handleMessage;
  return () => ws.close();
}, []);
```

### 1.4 AbortController for Fetch

**Problem signature:** Fetch requests that complete after component unmount, trying to set state on unmounted component.

```javascript
// BAD — race condition, potential state update on unmounted
useEffect(() => {
  fetch('/api/data').then(r => r.json()).then(setData);
}, []);

// GOOD — aborted on unmount
useEffect(() => {
  const controller = new AbortController();
  fetch('/api/data', { signal: controller.signal })
    .then(r => r.json())
    .then(setData)
    .catch(e => { if (e.name !== 'AbortError') throw e; });
  return () => controller.abort();
}, []);
```

### 1.5 Closure Leaks

**Problem signature:** Closures that capture large data structures (DOM nodes, arrays, objects) and are stored long-term (event handlers, callbacks in maps/sets).

```javascript
// BAD — closure holds reference to entire large dataset
const items = fetchLargeDataset(); // 10,000 objects
element.onclick = () => {
  console.log(items.length); // entire array kept alive
};

// GOOD — extract only what's needed
const itemCount = fetchLargeDataset().length;
element.onclick = () => {
  console.log(itemCount); // only primitive kept
};
```

---

## 2. React-Specific Performance

### 2.1 Unnecessary Re-renders

**Detection:** Add `console.log('render', ComponentName)` to suspect components. Or use React DevTools Profiler.

**Common causes:**

```jsx
// BAD — new object created every render, child always re-renders
function Parent() {
  return <Child style={{ color: 'red' }} />;
}

// GOOD — stable reference
const childStyle = { color: 'red' };
function Parent() {
  return <Child style={childStyle} />;
}

// BAD — inline function = new reference every render
function Parent() {
  return <Child onClick={() => handleClick(id)} />;
}

// GOOD — memoized callback
function Parent() {
  const onClick = useCallback(() => handleClick(id), [id]);
  return <Child onClick={onClick} />;
}
```

### 2.2 Missing React.memo

**When to apply:** Component receives props from parent but doesn't need to re-render when parent re-renders for unrelated reasons.

```jsx
// Wrap pure display components
const UserCard = React.memo(function UserCard({ name, avatar }) {
  return (
    <div className="card">
      <img src={avatar} alt={name} />
      <h3>{name}</h3>
    </div>
  );
});
```

### 2.3 useMemo for Expensive Computations

```jsx
// BAD — filters/sorts on every render
function UserList({ users, searchTerm }) {
  const filtered = users
    .filter(u => u.name.includes(searchTerm))
    .sort((a, b) => a.name.localeCompare(b.name));
  return filtered.map(u => <UserCard key={u.id} {...u} />);
}

// GOOD — only recomputes when inputs change
function UserList({ users, searchTerm }) {
  const filtered = useMemo(() =>
    users
      .filter(u => u.name.includes(searchTerm))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [users, searchTerm]
  );
  return filtered.map(u => <UserCard key={u.id} {...u} />);
}
```

### 2.4 Key Prop Anti-patterns

```jsx
// BAD — index as key for dynamic lists causes bugs and waste
{items.map((item, index) => <Item key={index} data={item} />)}

// GOOD — stable unique identifier
{items.map(item => <Item key={item.id} data={item} />)}

// TERRIBLE — random key forces full re-mount every render
{items.map(item => <Item key={Math.random()} data={item} />)}
```

### 2.5 State Management Granularity

```jsx
// BAD — one massive state object, any change re-renders everything
const [state, setState] = useState({
  user: null,
  posts: [],
  comments: [],
  likes: {},
  ui: { sidebarOpen: false, theme: 'light' }
});

// GOOD — separate concerns, changes are isolated
const [user, setUser] = useState(null);
const [posts, setPosts] = useState([]);
const [sidebarOpen, setSidebarOpen] = useState(false);
```

---

## 3. DOM & Rendering Performance

### 3.1 Layout Thrashing

**Problem:** Reading and writing DOM properties in alternation forces the browser to recalculate layout repeatedly.

```javascript
// BAD — forces layout recalc on every iteration
items.forEach(el => {
  const height = el.offsetHeight; // READ (forces layout)
  el.style.height = height + 10 + 'px'; // WRITE (invalidates layout)
});

// GOOD — batch reads, then batch writes
const heights = items.map(el => el.offsetHeight); // all reads first
items.forEach((el, i) => {
  el.style.height = heights[i] + 10 + 'px'; // all writes after
});
```

### 3.2 Animation Performance

**Rule:** Only animate `transform` and `opacity`. These are composited on the GPU and don't trigger layout or paint.

```css
/* BAD — triggers layout on every frame */
.animate-bad {
  transition: left 0.3s, top 0.3s, width 0.3s;
}

/* GOOD — GPU composited */
.animate-good {
  transition: transform 0.3s, opacity 0.3s;
  will-change: transform; /* hint for the browser */
}
```

### 3.3 Debouncing & Throttling

```javascript
// Debounce — wait until user stops typing
function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Throttle — limit execution rate
function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Usage
const handleSearch = debounce((query) => fetchResults(query), 300);
const handleScroll = throttle(() => updatePosition(), 16); // ~60fps
```

---

## 4. Network & Data Fetching

### 4.1 Request Waterfall → Parallel

```javascript
// BAD — sequential (total time = sum of all requests)
const user = await fetch('/api/user');
const posts = await fetch('/api/posts');
const comments = await fetch('/api/comments');

// GOOD — parallel (total time = longest request)
const [user, posts, comments] = await Promise.all([
  fetch('/api/user'),
  fetch('/api/posts'),
  fetch('/api/comments'),
]);
```

### 4.2 Caching with SWR/React Query Pattern

```javascript
// Simple cache implementation
const cache = new Map();

async function cachedFetch(url, ttl = 60000) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < ttl) {
    return cached.data;
  }
  const data = await fetch(url).then(r => r.json());
  cache.set(url, { data, time: Date.now() });
  return data;
}
```

### 4.3 Prefetching

```javascript
// Prefetch on hover (before click)
function PrefetchLink({ href, children }) {
  const prefetch = () => {
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
  };

  return (
    <a href={href} onMouseEnter={prefetch}>
      {children}
    </a>
  );
}
```

---

## 5. CSS Performance

### 5.1 Expensive Selectors

```css
/* BAD — universal selectors and deep nesting are slow */
div > * > span { }
[class*="widget-"] { }
:nth-child(odd):not(:last-child) > .inner > a { }

/* GOOD — simple class selectors */
.widget-label { }
.inner-link { }
```

### 5.2 Contain Property

```css
/* Isolate components so changes don't ripple */
.card {
  contain: layout style paint;
}

/* For items in a scrollable list */
.list-item {
  contain: content;
  content-visibility: auto;
  contain-intrinsic-size: 0 60px; /* estimated height */
}
```

### 5.3 Reduce Repaints

```css
/* BAD — box-shadow changes trigger repaint of surrounding area */
.btn:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.2); }

/* BETTER — use pseudo-element for shadow, animate opacity */
.btn { position: relative; }
.btn::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: 0 8px 24px rgba(0,0,0,0.2);
  opacity: 0;
  transition: opacity 0.3s;
}
.btn:hover::after { opacity: 1; }
```

---

## 6. Bundle & Asset Optimization

### 6.1 Code Splitting

```jsx
// React lazy loading for route-based splitting
const Dashboard = React.lazy(() => import('./Dashboard'));
const Settings = React.lazy(() => import('./Settings'));

function App() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  );
}
```

### 6.2 Image Optimization

```html
<!-- Responsive images with modern formats -->
<picture>
  <source srcset="photo.avif" type="image/avif" />
  <source srcset="photo.webp" type="image/webp" />
  <img src="photo.jpg"
       alt="Description"
       loading="lazy"
       decoding="async"
       width="800" height="600" />
</picture>
```

### 6.3 Font Loading Strategy

```css
/* Preload critical fonts */
@font-face {
  font-family: 'BrandFont';
  src: url('/fonts/brand.woff2') format('woff2');
  font-display: swap; /* show fallback immediately */
  unicode-range: U+0000-00FF; /* latin subset only for initial load */
}
```

```html
<link rel="preload" href="/fonts/brand.woff2" as="font" type="font/woff2" crossorigin />
```

---

## 7. N+1 Query Patterns

### 7.1 Frontend N+1 — API Calls in Loops

**The most common frontend N+1:**

```jsx
// BAD — N+1: one request per user in the list
function UserList({ userIds }) {
  return userIds.map(id => <UserCard key={id} userId={id} />);
}

function UserCard({ userId }) {
  const [user, setUser] = useState(null);
  useEffect(() => {
    fetch(`/api/users/${userId}`).then(r => r.json()).then(setUser);
  }, [userId]);
  return user ? <div>{user.name}</div> : <Spinner />;
}
```

**Fix — batch fetch at parent level:**

```jsx
// GOOD — single request for all users
function UserList({ userIds }) {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/users/batch', {
      method: 'POST',
      body: JSON.stringify({ ids: userIds }),
    }).then(r => r.json()).then(setUsers);
  }, [userIds]);

  return users.map(user => <UserCard key={user.id} user={user} />);
}

function UserCard({ user }) {
  return <div>{user.name}</div>;
}
```

### 7.2 Detection Checklist

Search for these patterns in the codebase:
1. `useEffect` + `fetch` inside a component that's rendered in a `.map()`
2. `useQuery` / `useSWR` inside a mapped child component
3. Any API call where the URL includes a dynamic ID and the component is in a list
4. Multiple identical requests visible in the Network tab when loading a page with a list

### 7.3 Batch Request Pattern

When the backend doesn't support batch endpoints, implement client-side batching:

```javascript
class RequestBatcher {
  constructor(fetchFn, delay = 50) {
    this.queue = [];
    this.delay = delay;
    this.fetchFn = fetchFn;
    this.timer = null;
  }

  add(id) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id, resolve, reject });
      if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.delay);
      }
    });
  }

  async flush() {
    const batch = [...this.queue];
    this.queue = [];
    this.timer = null;

    try {
      const ids = batch.map(item => item.id);
      const results = await this.fetchFn(ids);
      batch.forEach((item, i) => item.resolve(results[i]));
    } catch (err) {
      batch.forEach(item => item.reject(err));
    }
  }
}
```
