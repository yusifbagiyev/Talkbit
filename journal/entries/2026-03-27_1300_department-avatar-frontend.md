# Frontend Task: Department Avatar Feature

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-27
**Priority**: P1

---

## Xülasə

Department-lara avatar dəstəyi. DepartmentManagement formasında avatar upload (create zamanı məcburi, edit zamanı optional). Backend artıq user avatarını otomatik set edir — frontend tərəfindən əlavə dəyişiklik lazım deyil.

**Dəyişiklik nöqtələri:**
1. `api.js` — `uploadDepartmentAvatar` funksiyası
2. `DepartmentManagement.jsx` — create/edit formunda avatar upload
3. Department kartlarında avatar göstər

---

## 1. api.js — uploadDepartmentAvatar

**Fayl:** `chatapp-frontend/src/services/api.js`

```js
export const uploadDepartmentAvatar = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/files/upload/department-avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data; // { downloadUrl, fileName, ... }
};
```

---

## 2. DepartmentManagement.jsx — Avatar Upload

**Fayl:** `chatapp-frontend/src/components/admin/DepartmentManagement.jsx`

### Create formu

Forma `avatarUrl` state-i əlavə et:

```js
const [formAvatarUrl, setFormAvatarUrl] = useState(null);
const [avatarPreview, setAvatarPreview] = useState(null);
const [avatarUploading, setAvatarUploading] = useState(false);
```

Avatar seçim elementi — name inputun üstünə əlavə et:

```jsx
{/* Avatar upload */}
<div className="dm-avatar-upload">
  <label className="dm-avatar-upload-label">
    Department Avatar <span className="dm-required">*</span>
  </label>
  <div className="dm-avatar-upload-area" onClick={() => avatarInputRef.current?.click()}>
    {avatarPreview ? (
      <img src={avatarPreview} alt="preview" className="dm-avatar-preview" />
    ) : (
      <div className="dm-avatar-placeholder">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        <span>{avatarUploading ? "Uploading…" : "Click to upload image"}</span>
      </div>
    )}
  </div>
  <input
    ref={avatarInputRef}
    type="file"
    accept="image/*"
    style={{ display: "none" }}
    onChange={handleAvatarChange}
  />
</div>
```

`useRef` əlavə et: `const avatarInputRef = useRef(null);`

`handleAvatarChange` funksiyası:

```js
const handleAvatarChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  // Lokal preview
  setAvatarPreview(URL.createObjectURL(file));
  // Upload
  setAvatarUploading(true);
  try {
    const result = await uploadDepartmentAvatar(file);
    setFormAvatarUrl(result.downloadUrl);
  } catch {
    showToast("Avatar upload failed", "error");
    setAvatarPreview(null);
  } finally {
    setAvatarUploading(false);
  }
};
```

Forma submit-dən əvvəl validasiya:

```js
if (!formAvatarUrl) {
  showToast("Please upload a department avatar", "error");
  return;
}
```

`createDepartment` çağırışında `avatarUrl` göndər:

```js
await createDepartment({ name: formName.trim(), parentDepartmentId: formParentId || null, avatarUrl: formAvatarUrl });
```

Form sıfırlananda `formAvatarUrl`, `avatarPreview`-u da sıfırla.

### Edit formu

Edit formu açıldıqda mövcud avatarı göstər:

```js
setAvatarPreview(editingDept.avatarUrl ? getFileUrl(editingDept.avatarUrl) : null);
setFormAvatarUrl(editingDept.avatarUrl ?? null);
```

Edit-də avatar dəyişmə optional-dır — validasiya şərti yoxdur. `updateDepartment` çağırışında `avatarUrl: formAvatarUrl` göndər.

---

## 3. Department kartlarında avatar göstər

DepartmentManagement-də department siyahısında (kartlar/cədvəl) avatar göstər.

Hər department-ın yanında kiçik avatar (32×32):

```jsx
<div className="dm-dept-avatar">
  {dept.avatarUrl ? (
    <img src={getFileUrl(dept.avatarUrl)} alt={dept.name} />
  ) : (
    <div className="dm-dept-avatar-initials" style={{ background: getAvatarColor(dept.name) }}>
      {dept.name.charAt(0).toUpperCase()}
    </div>
  )}
</div>
```

---

## 4. CSS

**Fayl:** `chatapp-frontend/src/components/admin/DepartmentManagement.css` (mövcuddursa) ya da `admin-shared.css`

```css
.dm-avatar-upload { margin-bottom: 14px; }

.dm-avatar-upload-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.dm-required { color: #e53e3e; margin-left: 2px; }

.dm-avatar-upload-area {
  width: 80px;
  height: 80px;
  border: 2px dashed var(--border-color);
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: border-color 0.2s;
}

.dm-avatar-upload-area:hover { border-color: var(--accent-color, #5865f2); }

.dm-avatar-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dm-avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 10px;
  text-align: center;
  padding: 8px;
}

.dm-dept-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.dm-dept-avatar img { width: 100%; height: 100%; object-fit: cover; }

.dm-dept-avatar-initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
}
```

---

## Qeydlər

- `uploadDepartmentAvatar` import et: `import { ..., uploadDepartmentAvatar } from "../../services/api"`
- `getFileUrl`, `getAvatarColor`, `getInitials` — mövcud utility funksiyalar
- Backend `AssignEmployeeToDepartment` artıq user avatarını auto-set edir — frontend tərəfindən əlavə dəyişiklik lazım deyil
- `DepartmentDto.avatarUrl` backend-dən gəlir — frontend-də ayrıca fetch lazım deyil
