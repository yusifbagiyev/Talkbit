# Frontend Task: Department Avatar Validation Fixes

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-27
**Priority**: P1

---

## Xülasə

Backend tam hazırdır. Frontend-də 2 boşluq var:
1. `DepartmentManagement.jsx` — create zamanı avatar validasiyası yoxdur
2. `HierarchyView.jsx` — CreateDeptPanel-da avatar upload tamamilə yoxdur

---

## 1. DepartmentManagement.jsx — Create Avatar Validasiyası

**Fayl:** `chatapp-frontend/src/components/admin/DepartmentManagement.jsx`

UI-da `*` (required) göstərilir amma `handleSubmit`-də validasiya yoxdur. Department avatar olmadan yaradıla bilir.

**Düzəliş:** `handleSubmit` funksiyasında (təxminən line 366-382), `formName` validasiyasından sonra əlavə et:

```js
if (panel === "create" && !formAvatarUrl) {
  setFormError("Department avatar is required.");
  return;
}
```

---

## 2. HierarchyView.jsx — CreateDeptPanel Avatar Upload

**Fayl:** `chatapp-frontend/src/components/admin/HierarchyView.jsx`

`CreateDeptPanel` (təxminən line 698-759) department yaradır amma avatar upload sahəsi yoxdur.

### Əlavə ediləcəklər:

**Import:** `uploadDepartmentAvatar` artıq import olunub — yoxla, yoxdursa əlavə et.

**State-lər əlavə et (CreateDeptPanel daxilində):**

```js
const [avatarUrl, setAvatarUrl]           = useState(null);
const [avatarPreview, setAvatarPreview]   = useState(null);
const [avatarUploading, setAvatarUploading] = useState(false);
const avatarRef                            = useRef(null);
```

**Avatar upload handler:**

```js
const handleAvatarChange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setAvatarPreview(URL.createObjectURL(file));
  setAvatarUploading(true);
  try {
    const result = await uploadDepartmentAvatar(file, companyId);
    setAvatarUrl(result.downloadUrl);
  } catch {
    setAvatarPreview(null);
    setAvatarUrl(null);
  } finally {
    setAvatarUploading(false);
  }
};
```

**Form JSX-ə avatar sahəsi əlavə et (name input-dan əvvəl):**

```jsx
<div className="hi-form-field">
  <label className="hi-form-label">Department Avatar *</label>
  <div
    className="hi-avatar-upload-area"
    onClick={() => avatarRef.current?.click()}
    style={{
      width: 64, height: 64, borderRadius: "50%",
      border: "2px dashed var(--border-color)", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden", background: "var(--bg-secondary)",
    }}
  >
    {avatarPreview
      ? <img src={avatarPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      : <span style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
          {avatarUploading ? "Uploading…" : "Upload"}
        </span>}
  </div>
  <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
</div>
```

**handleSubmit validasiyasına əlavə et:**

```js
if (!avatarUrl) { setErr("Department avatar is required."); return; }
```

**createDepartment çağırışını yenilə:**

```js
await createDepartment({
  name: name.trim(),
  parentDepartmentId: parentId || null,
  companyId: companyId || null,
  avatarUrl,
});
```

---

## Qeydlər

- Backend tam hazırdır: `CreateDepartmentCommand`, `UpdateDepartmentCommand`, `AssignEmployeeToDepartment` hamısı `AvatarUrl` dəstəkləyir
- `uploadDepartmentAvatar(file, companyId, departmentId)` artıq api.js-də mövcuddur
- Yalnız 2 frontend düzəliş lazımdır — yeni endpoint və ya backend dəyişikliyi tələb olunmur
