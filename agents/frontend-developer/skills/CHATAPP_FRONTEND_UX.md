# ChatApp Frontend UX Patterns

Proven patterns from the ChatApp React frontend (Bitrix24 style).
Follow these patterns to maintain consistency and avoid known pitfalls.

## Architecture Overview

- **Project**: `C:\Users\Joseph\Desktop\ChatApp\chatapp-frontend\`
- **UI Style**: Bitrix24 (NOT WhatsApp)
- **Stack**: React + Vite + JavaScript (no TypeScript)
- **State**: Custom hooks in `src/hooks/`, no Redux
- **CSS**: Plain CSS files per component (no CSS modules, no Tailwind)
- **Comments**: Azerbaijani language for comments, English for errors/warnings/logs

## Key Files Map

| Area | Files |
|------|-------|
| Main chat | `src/pages/Chat.jsx` (very large, ~2800+ lines) |
| Sidebar | `src/hooks/useSidebarPanels.js`, `src/components/DetailSidebar.jsx/.css` |
| Channel panel | `src/components/ChannelPanel.jsx/.css` |
| Channel logic | `src/hooks/useChannelManagement.js` |
| File uploads | `src/hooks/useFileUploadManager.js` |
| API layer | `src/api/api.js` |
| Message cache | `src/utils/messageCache.js` |

## Pattern 1: Dropdown Positioning (Viewport-Aware)

Dropdowns must auto-position based on available viewport space. Never hardcode left/right/top/bottom.

```javascript
// useSidebarPanels.js pattern
useEffect(() => {
  if (!menuId) return;
  const btn = document.querySelector(`[data-file-id="${menuId}"] .more-btn`);
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const spaceRight = window.innerWidth - rect.right;
  const spaceBottom = window.innerHeight - rect.bottom;

  // Sola/saga ve yuxariya/asagiya avtomatik yerlesdirme
  setMenuPos({
    top: spaceBottom < 200 ? rect.top - menuHeight : rect.bottom,
    left: spaceRight < 200 ? rect.left - menuWidth : rect.right,
  });
}, [menuId]);
```

**Rule**: When dropdown is open, hide overlapping elements via z-index or conditional class:
```css
.media-grid-item.menu-active .topbar { visibility: hidden; }
```

## Pattern 2: Inline Dropdown (Bitrix24 Member Picker)

Bitrix24 uses inline dropdowns under input fields, NOT floating overlay modals.

```
Wrong: position: fixed overlay in center of screen
Right: position: absolute under the input container with position: relative
```

```css
.members-card { position: relative; }
.dropdown-panel {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 60%;
  height: 400px;
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  overflow-y: auto;
  z-index: var(--z-sidebar);
  animation: dropIn 220ms ease-out;
  transform-origin: top left;
}
```

**Hierarchy search behavior**: When user searches, auto-expand matching departments:
```javascript
useEffect(() => {
  if (!searchText.trim()) return;
  const lower = searchText.toLowerCase();
  const idsToExpand = new Set();
  // Recursively find parent departments of matching users
  const walk = (nodes, ancestors = []) => {
    for (const node of nodes) {
      if (node.type === 'user' && node.name.toLowerCase().includes(lower)) {
        ancestors.forEach(id => idsToExpand.add(id));
      }
      if (node.children) walk(node.children, [...ancestors, node.id]);
    }
  };
  walk(hierarchy);
  setExpandedDepts(prev => new Set([...prev, ...idsToExpand]));
}, [searchText, hierarchy]);
```

## Pattern 3: Sidebar Cache (Stale-While-Revalidate)

Use the existing `messageCache.js` system for sidebar data:

```javascript
// Cache key pattern: `sidebar_${type}_${conversationId}`
const cacheKey = `sidebar_favorites_${conversationId}`;
const cached = messageCache.getSidebarData(cacheKey);

if (cached) {
  setFavorites(cached); // Instant render from cache
}
// Always fetch fresh data in background
const fresh = await api.getFavorites(conversationId);
setFavorites(fresh);
messageCache.setSidebarData(cacheKey, fresh);
```

**Important**: Load sidebar data ONLY when sidebar opens (not on conversation select).

## Pattern 4: Animation & Micro-interactions

Standard animation set for ChatApp components:

```css
/* Dropdown acilma */
@keyframes dropIn {
  from { opacity: 0; transform: scaleY(0.92) translateY(-4px); }
  to { opacity: 1; transform: scaleY(1) translateY(0); }
}

/* Chip elave olunma */
@keyframes chipIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

/* Check icon pop */
@keyframes checkPop {
  from { opacity: 0; transform: scale(0.5); }
  to { opacity: 1; transform: scale(1); }
}

/* Settings body acilma */
@keyframes fadeSlide {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Shimmer skeleton */
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Button states pattern**:
```css
.btn { transition: all var(--transition-fast); }
.btn:hover { background: lighter-color; }
.btn:active { transform: scale(0.97); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; filter: grayscale(30%); }
```

**Loading skeleton** (CSS-only, no extra HTML):
```css
.loading-skeleton {
  display: flex; flex-direction: column; gap: 10px;
  padding: 12px 16px;
}
.loading-skeleton::before,
.loading-skeleton::after {
  content: "";
  height: 36px;
  border-radius: 6px;
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.2s ease-in-out infinite;
}
```

## Pattern 5: Scrollbar Styling

Consistent scrollbar across all panels:
```css
.scrollable-panel::-webkit-scrollbar { width: 6px; }
.scrollable-panel::-webkit-scrollbar-track { background: transparent; }
.scrollable-panel::-webkit-scrollbar-thumb {
  background: #D2D9DF;
  border-radius: 3px;
}
.scrollable-panel::-webkit-scrollbar-thumb:hover { background: #b8c0c8; }
```

## Pattern 6: "Already a member" Disabled State

When showing user lists, existing members should appear but be non-selectable:
```jsx
const isMember = existingMemberIds.has(user.id);
<div className={`user-row ${isMember ? 'disabled' : ''}`}
     onClick={isMember ? undefined : () => onSelect(user)}>
  <Avatar user={user} />
  <span>{user.fullName}</span>
  {isMember && <span className="already-member">Already a member</span>}
</div>
```

```css
.user-row.disabled { opacity: 0.6; cursor: default; }
.already-member { color: #e9a23b; font-size: 12px; }
```

## Common Pitfalls & Fixes

### React Hook Order Errors
Adding a new hook (useState, useEffect, etc.) to an existing component causes HMR crashes.
**Fix**: Full page refresh (Ctrl+F5) after adding hooks. This is NOT a code bug.

### useEffect Cleanup with Refs
```javascript
// WRONG - ref.current may change before cleanup runs
useEffect(() => {
  return () => { clearTimeout(timerRef.current); };
}, []);

// RIGHT - capture ref value at effect time
useEffect(() => {
  const timer = timerRef;
  return () => { clearTimeout(timer.current); };
}, []);
```

### Variable Initialization Order
`useMemo`/`useCallback` that references a variable defined later causes "Cannot access before initialization":
```javascript
// WRONG
const handler = useCallback(() => { filteredList.find(...) }, [filteredList]);
const filteredList = useMemo(() => ..., [deps]); // defined AFTER handler

// RIGHT - move useMemo BEFORE useCallback that uses it
const filteredList = useMemo(() => ..., [deps]);
const handler = useCallback(() => { filteredList.find(...) }, [filteredList]);
```

### Chip/Tag Display - Preserve User Info
When selecting users from search results, store full user info immediately:
```javascript
const handleSelect = (user) => {
  setSelected(prev => new Set([...prev, user.id]));
  setSelectedInfo(prev => new Map([...prev, [user.id, {
    name: user.fullName,
    avatarUrl: user.avatarUrl,
    color: getAvatarColor(user.fullName)
  }]]));
};
```
Do NOT rely on search results array for chip display - it gets cleared when search text changes.

## CSS Variables Used

```css
--transition-fast: 150ms ease;
--transition-base: 200ms ease;
--z-sidebar: 1000;
--white: #ffffff;
--gray-50 through --gray-900: grayscale palette;
--primary-color: #2fc6f6;
--error-color: #ef4444;
```

## Toggle/Switch Styling

Sound toggle in sidebar uses `--primary-color` (#2fc6f6) for active state.

## Files & Media Grid

- Preview shows max 6 items (3x2 grid)
- Items show file type icon for non-images, thumbnail for images
- Avatar overlaps top-left of each item (offset upward by ~40%)
- More button appears on hover (top-right), with transparent background
- Click on image = open lightbox, click on file = download

## Pattern 7: Avatar Circle Smoothing (JPEG Artifact Fix)

`border-radius: 50%` + `overflow: hidden` on the parent creates a hard circular clip.

**Global fix** in `src/index.css` — sub-pixel fade to smooth anti-aliasing at the clip edge:

```css
[class*="avatar-img"],
[class*="avatar"] > img {
  -webkit-mask-image: radial-gradient(circle closest-side at 50% 50%, black 96%, transparent 100%);
  mask-image: radial-gradient(circle closest-side at 50% 50%, black 96%, transparent 100%);
  display: block;
}
```

**CRITICAL: Do NOT increase fade beyond 96%** (e.g. 90%, 92%). On small avatars (32px), a 10% fade zone = 1.6px of actual image content becomes semi-transparent. If the photo has warm/colorful pixels near the edge, these create a visible colored halo over the white background. `96%` = 0.64px (sub-pixel, invisible, no halo).

**Avatar img must have explicit size** — if `width: 100%; height: 100%` is missing, the img renders at natural resolution (e.g. 500px). The mask gradient then places the fade at 500px × 96% = 480px, far from the visible 32px clip boundary → no effect. Always add a CSS rule with `width: 100%; height: 100%; object-fit: cover; border-radius: 50%;` for every avatar img class.

**Parent background must be transparent when img is shown** — if parent always has `background: getAvatarColor(name)`, the transparent mask edge reveals that color as a ring. Fix: `background: avatarUrl ? "transparent" : getAvatarColor(name)`.

**Checklist when adding a new avatar component:**
- [ ] Parent div: `border-radius: 50%; overflow: hidden;` with conditional background
- [ ] Img: CSS rule with `width: 100%; height: 100%; object-fit: cover; border-radius: 50%;`
- [ ] Img class contains "avatar-img" OR parent class contains "avatar" (global mask auto-applies)

## Pattern 8: Avatar Upload — Two-Step Pattern

`POST /api/files/upload/profile-picture` stores the file but does NOT update `users.avatar_url`. Always follow up with a user update call:

```javascript
// 1) Upload the file
const result = await apiUpload("/api/files/upload/profile-picture", formData, onProgress);
// 2) Persist avatarUrl on the user record
const endpoint = isOwn ? "/api/users/me" : `/api/users/${userId}`;
await apiPut(endpoint, { avatarUrl: result.downloadUrl });
```

**Rule**: Never assume upload endpoint updates related entities. Always check swagger/controller. Upload = store file. Update entity = separate call.

## Pattern 9: Destructive Action Confirm Modal Pattern

For admin actions (grant/revoke role, disable/enable account) use a two-state confirm pattern:

```jsx
const [actionConfirm, setActionConfirm] = useState(null); // null | "admin" | "deactivate"
const [actionLoading, setActionLoading] = useState(false);

const handleActionConfirm = async () => {
  setActionLoading(true);
  try {
    if (actionConfirm === "admin") {
      const newRole = profile.role === "Administrator" ? 0 : 1;
      await apiPut(`/api/users/${profile.id}`, { role: newRole });
      setProfile(prev => ({ ...prev, role: newRole === 1 ? "Administrator" : "User" }));
    } else if (actionConfirm === "deactivate") {
      profile.isActive ? await deactivateUser(profile.id) : await activateUser(profile.id);
      setProfile(prev => ({ ...prev, isActive: !prev.isActive }));
    }
    setActionConfirm(null);
  } catch { } finally { setActionLoading(false); }
};
```

Pass `loading={actionLoading}` to ConfirmDialog so the YES button shows a spinner.

## Pattern 10: Ribbon/Badge Arrow Shape

Bitrix24-style ribbon with arrow pointing right — flush to the left card edge:

```css
.ribbon-badge {
  background: #2FC6F6;
  clip-path: polygon(0 0, calc(100% - 7px) 0, 100% 50%, calc(100% - 7px) 100%, 0 100%);
  margin-left: -16px; /* card padding-inə bərabər — sol kənara tam bitişir */
  padding: 4px 18px 4px 16px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.5px;
}
```

Formula: `calc(100% - Xpx)` = arrow depth. `margin-left: -[card-padding]px` = flush to edge.

## Pattern 11: Multi-Endpoint Save (Contact Info)

Some data is split across multiple endpoints. Always check what each endpoint covers:

```javascript
const handleSave = async () => {
  setSaving(true);
  try {
    // Əsas user məlumatları
    const endpoint = isOwn ? "/api/users/me" : `/api/users/${profile.id}`;
    await apiPut(endpoint, { firstName, lastName, email, dateOfBirth, positionId, workPhone, hiringDate });

    // Department ayrı endpoint-dədir
    if (editData.departmentId && editData.departmentId !== profile.departmentId) {
      await assignEmployeeToDepartment(profile.id, editData.departmentId);
    }
    setProfile(prev => ({ ...prev, ...updatedFields }));
    closeEditMode();
  } catch { setSaving(false); }
};
```

**Rule**: Never use `setTimeout` simulation as placeholder for real API calls. Identify the correct endpoint(s) and wire them up immediately.

## Pattern 13: useChatSignalR — Adding a New SignalR Event

`useChatSignalR.js` accepts positional parameters. Four steps to add a new event:

```javascript
// 1. Add ref as the last parameter
export default function useChatSignalR(..., onNewFileMessageRef, onChannelUpdatedRef) {

// 2. Write the handler
function handleChannelUpdated(data) {
  setConversations((prev) =>
    prev.map((c) => c.id === data.channelId ? { ...c, name: data.name, avatarUrl: data.avatarUrl ?? c.avatarUrl } : c)
  );
  onChannelUpdatedRef?.current?.(data); // callback for complex state like selectedChat
}

// 3. Register in eventHandlers array
["ChannelUpdated", handleChannelUpdated],

// 4. Create ref in Chat.jsx (updated every render, no stale closure)
const onChannelUpdatedRef = useRef(null);
onChannelUpdatedRef.current = (data) => {
  if (selectedChatRef.current?.id === data.channelId) {
    setSelectedChat((prev) => ({ ...prev, name: data.name, avatarUrl: data.avatarUrl ?? prev.avatarUrl }));
  }
};
```

**Local update**: `handleChannelUpdated({ id, name, avatarUrl })` already exists in `Chat.jsx` — route your own changes through it too.

**Channel avatar endpoint**: Use `POST /api/files/upload/channel-avatar/{channelId}`, not `profile-picture`. Response: `{ downloadUrl }`.

