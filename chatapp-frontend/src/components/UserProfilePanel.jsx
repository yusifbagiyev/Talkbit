import { useState, useEffect, useRef, memo } from "react";
import { createPortal } from "react-dom";
import { getUserProfile, getFileUrl, getDepartments, getPositionsByDepartment, getSubordinates, changePassword, adminChangePassword, apiUpload, apiPut, activateUser, deactivateUser, assignEmployeeToDepartment } from "../services/api";
import "./UserProfilePanel.css";

// ─── Field — görüntüləmə rejimi ──────────────────────────────────────────────
const Field = ({ label, value, isEmail }) => (
  <div className="upp-field">
    <span className="upp-field-label">{label}</span>
    {value ? (
      isEmail ? (
        <a href={`mailto:${value}`} className="upp-field-value email">{value}</a>
      ) : (
        <span className="upp-field-value">{value}</span>
      )
    ) : (
      <span className="upp-field-value empty">field is empty</span>
    )}
  </div>
);

// ─── EditField — mətn input ───────────────────────────────────────────────────
const EditField = ({ label, name, value, type = "text", onChange, inputClass }) => (
  <div className="upp-field">
    <span className="upp-field-label">{label}</span>
    <input
      className={`upp-field-input${inputClass ? ` ${inputClass}` : ""}`}
      type={type}
      name={name}
      value={value ?? ""}
      onChange={onChange}
    />
  </div>
);

// ─── SelectField — portal-based dropdown ─────────────────────────────────────
function SelectField({ label, options, value, onChange }) {
  const [open, setOpen]       = useState(false);
  const [search, setSearch]   = useState("");
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef(null);

  const calcPos = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
  };

  const handleToggle = () => {
    calcPos();
    setOpen((p) => !p);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!triggerRef.current?.contains(e.target)) {
        const drop = document.getElementById("upp-select-portal");
        if (!drop?.contains(e.target)) setOpen(false);
      }
    };
    const onScroll = () => calcPos();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (opt) => {
    onChange(opt.id, opt.name);
    setOpen(false);
    setSearch("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null, "");
  };

  return (
    <div className="upp-field">
      <span className="upp-field-label">{label}</span>
      <div ref={triggerRef} className={`upp-select ${open ? "open" : ""}`} onClick={handleToggle}>
        <div className="upp-select-value">
          {selected ? (
            <span className="upp-select-tag">
              {selected.name}
              <button className="upp-select-tag-x" onClick={handleClear}>×</button>
            </span>
          ) : (
            <span className="upp-select-placeholder">Select...</span>
          )}
        </div>
        <svg className="upp-select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
        </svg>
      </div>

      {open && createPortal(
        <div
          id="upp-select-portal"
          className="upp-select-dropdown"
          style={{ position: "fixed", top: dropPos.top, left: dropPos.left, width: dropPos.width, zIndex: 9999 }}
        >
          <div className="upp-select-search-wrap">
            <input
              className="upp-select-search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="upp-select-list">
            {filtered.length === 0 && <div className="upp-select-empty">No results</div>}
            {filtered.map((opt) => (
              <div
                key={opt.id}
                className={`upp-select-item ${opt.id === value ? "selected" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(opt); }}
              >
                <span className={`upp-select-checkbox ${opt.id === value ? "checked" : ""}`} />
                {opt.name}
              </div>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ message, onYes, onNo, loading }) {
  return createPortal(
    <div className="upp-confirm-overlay">
      <div className="upp-confirm-box">
        <span className="upp-confirm-title">Confirm</span>
        <p className="upp-confirm-msg">{message}</p>
        <div className="upp-confirm-btns">
          <button className="upp-confirm-yes" onClick={onYes} disabled={loading}>
            {loading ? <span className="upp-save-spinner" /> : "YES"}
          </button>
          <button className="upp-confirm-no" onClick={onNo} disabled={loading}>NO</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── PersonRow — klikləmə ilə nested panel açan şəxs sətri ──────────────────
const PersonRow = ({ person, onClick }) => {
  const name = `${person.firstName ?? ""} ${person.lastName ?? ""}`.trim();
  return (
    <div
      className="upp-person-item"
      onClick={() => person.id && onClick(person.id)}
      style={!person.id ? { cursor: "default" } : undefined}
    >
      <div className="upp-person-avatar">
        {person.avatarUrl
          ? <img src={getFileUrl(person.avatarUrl)} alt={name} />
          : (
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" fill="#c8d8e8"/>
              <circle cx="50" cy="38" r="18" fill="#8aafc8"/>
              <ellipse cx="50" cy="85" rx="28" ry="20" fill="#8aafc8"/>
            </svg>
          )}
      </div>
      <div className="upp-person-info">
        <span className="upp-person-name">{name}</span>
        {person.position && <span className="upp-person-role">{person.position}</span>}
      </div>
    </div>
  );
};

// ─── Tarix formatlaması ───────────────────────────────────────────────────────
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : null;

const fmtDateTime = (d) =>
  d ? new Date(d).toLocaleString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;

const toDateInput = (d) => d ? new Date(d).toISOString().split("T")[0] : "";

// ─── AvatarCropModal ──────────────────────────────────────────────────────────
const CROP_SIZE    = 300;  // editor canvas ölçüsü (px)
const CIRCLE_SIZE  = 268;  // kəsilən dairə diametr
const PREVIEW_SIZE = 130;  // sağdakı preview dairə
const SCALE        = PREVIEW_SIZE / CROP_SIZE;

function AvatarCropModal({ file, onSave, onCancel, uploading }) {
  const [zoom, setZoom]           = useState(1);
  const [offset, setOffset]       = useState({ x: 0, y: 0 });
  const [dragging, setDragging]   = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [natSize, setNatSize]     = useState({ w: 0, h: 0 });
  const replaceRef = useRef(null);
  const objUrl     = useRef(URL.createObjectURL(file));

  useEffect(() => {
    const url = objUrl.current;
    const img = new Image();
    img.onload = () => setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, []);

  const onMouseDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const onMouseUp = () => setDragging(false);

  // fitScale: şəkil kəsmə dairəsini tam örtəcək miqyas
  const fitScale = natSize.w && natSize.h
    ? CIRCLE_SIZE / Math.min(natSize.w, natSize.h)
    : 1;

  // Şəklin piksel ölçüsü (zoom=1 → dairəni tam örtür)
  const imgW = natSize.w * fitScale * zoom;
  const imgH = natSize.h * fitScale * zoom;

  // Canvas vasitəsilə kəsib blob yaradır
  const handleSave = () => {
    const OUT = 400;
    // 2× oversample — aşağıya scale etdikdə kənarlar smooth görünür
    const SC = 2;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = OUT * SC;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const img = new Image();
    img.onload = () => {
      const s  = (OUT * SC) / CROP_SIZE;
      const iw = imgW * s;
      const ih = imgH * s;
      const cx = OUT * SC / 2;
      const dx = cx - iw / 2 + offset.x * s;
      const dy = cx - ih / 2 + offset.y * s;

      // Şəkli çək, sonra dairəvi mask tətbiq et (clip()-dən smooth)
      ctx.drawImage(img, dx, dy, iw, ih);
      ctx.globalCompositeOperation = "destination-in";
      ctx.beginPath();
      ctx.arc(cx, cx, OUT * SC / 2, 0, Math.PI * 2);
      ctx.fillStyle = "#000";
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";

      // 2×-dən 1× output canvas-a scale et
      const out = document.createElement("canvas");
      out.width = out.height = OUT;
      const octx = out.getContext("2d");
      octx.imageSmoothingEnabled = true;
      octx.imageSmoothingQuality = "high";
      octx.drawImage(canvas, 0, 0, OUT, OUT);
      out.toBlob(
        (blob) => onSave(new File([blob], "avatar.png", { type: "image/png" })),
        "image/png"
      );
    };
    img.src = objUrl.current;
  };

  // Editor: mövqe üçün translate, scale yoxdur — explicit ölçü istifadə olunur
  const editorStyle = {
    width: imgW,
    height: imgH,
    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
  };

  // Preview: eyni mövqe məntiqi, SCALE amili ilə kiçilmiş
  const pvW = imgW * SCALE;
  const pvH = imgH * SCALE;
  const previewStyle = {
    width: pvW,
    height: pvH,
    transform: `translate(calc(-50% + ${offset.x * SCALE}px), calc(-50% + ${offset.y * SCALE}px))`,
  };

  return createPortal(
    <div className="upp-crop-overlay" onClick={onCancel}>
      <div className="upp-crop-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="upp-crop-header">
          <span className="upp-crop-title">Upload a photo</span>
          <button className="upp-crop-close" onClick={onCancel}>×</button>
        </div>

        {/* Body */}
        <div className="upp-crop-body">
          {/* Sol — editor */}
          <div className="upp-crop-left">
            <div className="upp-crop-zoom-bar">
              <button className="upp-crop-zoom-btn" onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))}>−</button>
              <input className="upp-crop-slider" type="range" min="0.1" max="4" step="0.02"
                value={zoom} onChange={(e) => setZoom(parseFloat(e.target.value))} />
              <button className="upp-crop-zoom-btn" onClick={() => setZoom((z) => Math.min(4, +(z + 0.1).toFixed(2)))}>+</button>
            </div>

            <div className="upp-crop-area"
              onMouseDown={onMouseDown} onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}   onMouseLeave={onMouseUp}
              style={{ cursor: dragging ? "grabbing" : "grab" }}
            >
              <img src={objUrl.current} className="upp-crop-img" draggable={false}
                style={editorStyle} alt="" />
              <div className="upp-crop-mask" />
            </div>

            <input ref={replaceRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                URL.revokeObjectURL(objUrl.current);
                objUrl.current = URL.createObjectURL(f);
                setOffset({ x: 0, y: 0 });
                const img = new Image();
                img.onload = () => {
                  setNatSize({ w: img.naturalWidth, h: img.naturalHeight });
                  setZoom(1);
                };
                img.src = objUrl.current;
                e.target.value = "";
              }}
            />
            <button className="upp-crop-upload-btn" onClick={() => replaceRef.current?.click()}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              UPLOAD
            </button>
          </div>

          {/* Ok */}
          <div className="upp-crop-arrow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </div>

          {/* Sağ — preview */}
          <div className="upp-crop-preview">
            <div className="upp-crop-preview-circle">
              <img src={objUrl.current} className="upp-crop-img" draggable={false}
                style={previewStyle} alt="" />
            </div>
            <span className="upp-crop-preview-label">Preview</span>
          </div>
        </div>

        {/* Footer */}
        <div className="upp-crop-footer">
          <button className="upp-crop-save" onClick={handleSave} disabled={uploading}>
            {uploading ? <span className="upp-save-spinner" /> : "SAVE"}
          </button>
          <button className="upp-crop-cancel-btn" onClick={onCancel} disabled={uploading}>CANCEL</button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── UserProfilePanel ─────────────────────────────────────────────────────────
function UserProfilePanel({ userId, currentUserId, isAdmin, onClose, onStartChat, onlineUsers }) {
  const [profile, setProfile]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(false);
  const [actionsOpen, setActionsOpen]   = useState(false);
  const [actionConfirm, setActionConfirm] = useState(null); // "admin" | "deactivate"
  const [actionLoading, setActionLoading] = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [editData, setEditData]       = useState({});
  const [editVisible, setEditVisible] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [positions, setPositions]     = useState([]);
  const [confirmOpen, setConfirmOpen]   = useState(false);
  const [saving, setSaving]             = useState(false);
  const [subordinates, setSubordinates]   = useState([]);
  const [showAllSubs, setShowAllSubs]     = useState(false);
  const [nestedUserId, setNestedUserId]   = useState(null);
  const [aboutEditMode, setAboutEditMode] = useState(false);
  const [aboutDraft, setAboutDraft]       = useState("");
  const [activeTab, setActiveTab]         = useState("General");
  const [pwForm, setPwForm]               = useState({ current: "", newPw: "", confirm: "" });
  const [pwErrors, setPwErrors]           = useState({});
  const [pwLoading, setPwLoading]         = useState(false);
  const [pwSuccess, setPwSuccess]         = useState(false);
  const [recoverModal, setRecoverModal]   = useState(false);
  const [showPw, setShowPw]               = useState({ current: false, newPw: false, confirm: false });
  const [cropFile, setCropFile]               = useState(null);  // crop modal üçün seçilmiş fayl
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);

  const handleAvatarClick = () => { if (canEdit) fileInputRef.current?.click(); };

  const handleFileSelect = (e) => {
    const f = e.target.files?.[0];
    if (f) setCropFile(f);
    e.target.value = "";
  };

  const handleAvatarSave = async (croppedFile) => {
    setAvatarUploading(true);
    try {
      const form = new FormData();
      form.append("File", croppedFile);
      const targetId = isAdmin && !isOwn ? profile.id : null;
      const uploadEndpoint = targetId
        ? `/api/files/upload/profile-picture?targetUserId=${targetId}`
        : "/api/files/upload/profile-picture";
      const result = await apiUpload(uploadEndpoint, form);

      // Avatar URL-ni identity modulunda yenilə
      const updateEndpoint = targetId ? `/api/users/${targetId}` : "/api/users/me";
      await apiPut(updateEndpoint, { avatarUrl: result.downloadUrl });

      setProfile((prev) => ({ ...prev, avatarUrl: result.downloadUrl }));
      setCropFile(null);
    } catch {
      // upload failed — modal açıq qalır
    } finally {
      setAvatarUploading(false);
    }
  };
  const originalData = useRef({});
  const actionsRef   = useRef(null);
  const aboutCardRef = useRef(null);
  const panelRef     = useRef(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(false);
    setProfile(null);
    setEditMode(false);
    setSubordinates([]);
    setShowAllSubs(false);
    setNestedUserId(null);
    setAboutEditMode(false);
    setAboutDraft("");
    getUserProfile(userId)
      .then((data) => setProfile(data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
    getSubordinates(userId)
      .then((data) => setSubordinates(data ?? []))
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!actionsOpen) return;
    const onClick = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) setActionsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [actionsOpen]);

  const handleActionConfirm = async () => {
    if (!profile) return;
    setActionLoading(true);
    try {
      if (actionConfirm === "admin") {
        const isCurrentlyAdmin = profile.role === "Administrator";
        await apiPut(`/api/users/${profile.id}`, { role: isCurrentlyAdmin ? 0 : 1 });
        setProfile((p) => ({ ...p, role: isCurrentlyAdmin ? "User" : "Administrator" }));
      } else if (actionConfirm === "deactivate") {
        if (profile.isActive) {
          await deactivateUser(profile.id);
        } else {
          await activateUser(profile.id);
        }
        setProfile((p) => ({ ...p, isActive: !p.isActive }));
      }
    } catch {
      // Xəta baş verdi — modal bağlı qalır
    } finally {
      setActionLoading(false);
      setActionConfirm(null);
    }
  };

  const handleEditOpen = async () => {
    setAboutEditMode(false);
    setAboutDraft("");
    const initial = {
      firstName:      profile.firstName      ?? "",
      lastName:       profile.lastName       ?? "",
      dateOfBirth:    toDateInput(profile.dateOfBirth),
      departmentId:   profile.departmentId   ?? null,
      departmentName: profile.departmentName ?? "",
      positionId:     profile.positionId     ?? null,
      positionName:   profile.position       ?? "",
      email:          profile.email          ?? "",
      workPhone:      profile.workPhone      ?? "",
      mobilePhone:    profile.mobilePhone    ?? "",
      hiringDate:           toDateInput(profile.hiringDate),
      headOfDepartmentName: profile.headOfDepartmentName ?? null,
    };
    originalData.current = initial;
    setEditData(initial);
    setEditMode(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setEditVisible(true)));

    try {
      const deps = await getDepartments();
      setDepartments(deps ?? []);
      if (profile.departmentId) {
        const pos = await getPositionsByDepartment(profile.departmentId);
        setPositions(pos ?? []);
      }
    } catch { /* ignore */ }
  };

  // isDirty — hər hansı dəyişiklik olubmu
  const isDirty = JSON.stringify(editData) !== JSON.stringify(originalData.current);

  const closeEditMode = () => {
    setEditVisible(false);
    setTimeout(() => { setEditMode(false); setSaving(false); }, 220);
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setConfirmOpen(true);
    } else {
      closeEditMode();
    }
  };

  useEffect(() => {
    if (!aboutEditMode) return;
    const t = setTimeout(() => {
      if (panelRef.current) {
        panelRef.current.scrollTo({ top: panelRef.current.scrollHeight, behavior: "smooth" });
      }
    }, 120);
    return () => clearTimeout(t);
  }, [aboutEditMode]);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    const isAdminEdit = isAdmin && !isOwn;
    const errs = {};

    if (!isAdminEdit && !pwForm.current)
      errs.current = "Current password is required";

    if (!pwForm.newPw) {
      errs.newPw = "New password is required";
    } else {
      if (pwForm.newPw.length < 8)           errs.newPw = "Password must be at least 8 characters";
      else if (pwForm.newPw.length > 100)    errs.newPw = "Password must not exceed 100 characters";
      else if (!/[A-Z]/.test(pwForm.newPw))  errs.newPw = "Must contain at least one uppercase letter";
      else if (!/[a-z]/.test(pwForm.newPw))  errs.newPw = "Must contain at least one lowercase letter";
      else if (!/[0-9]/.test(pwForm.newPw))  errs.newPw = "Must contain at least one number";
      else if (!/[\W_]/.test(pwForm.newPw))  errs.newPw = "Must contain at least one special character";
    }

    if (!pwForm.confirm)
      errs.confirm = "Please confirm new password";
    else if (pwForm.newPw && pwForm.newPw !== pwForm.confirm)
      errs.confirm = "Passwords do not match";

    if (Object.keys(errs).length) { setPwErrors(errs); return; }
    setPwLoading(true);
    setPwErrors({});
    try {
      if (isAdminEdit) {
        await adminChangePassword(profile.id, pwForm.newPw, pwForm.confirm);
      } else {
        await changePassword(profile.id, pwForm.current, pwForm.newPw, pwForm.confirm);
      }
      setPwSuccess(true);
      setPwForm({ current: "", newPw: "", confirm: "" });
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err) {
      setPwErrors({ general: err?.message || "An error occurred" });
    } finally {
      setPwLoading(false);
    }
  };

  const handleAboutSave = () => {
    // TODO: real API call
    setProfile((prev) => ({ ...prev, aboutMe: aboutDraft }));
    setAboutEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const endpoint = isOwn ? "/api/users/me" : `/api/users/${profile.id}`;
      await apiPut(endpoint, {
        firstName:   editData.firstName   || null,
        lastName:    editData.lastName    || null,
        email:       editData.email       || null,
        dateOfBirth: editData.dateOfBirth || null,
        positionId:  editData.positionId  || null,
        workPhone:   editData.workPhone   || null,
        hiringDate:  editData.hiringDate  || null,
      });

      // Department dəyişibsə ayrı endpoint
      if (editData.departmentId && editData.departmentId !== profile.departmentId) {
        await assignEmployeeToDepartment(profile.id, editData.departmentId);
      }

      setProfile((prev) => ({
        ...prev,
        firstName:            editData.firstName    || prev.firstName,
        lastName:             editData.lastName     || prev.lastName,
        email:                editData.email        || prev.email,
        dateOfBirth:          editData.dateOfBirth  || null,
        positionId:           editData.positionId   ?? null,
        position:             editData.positionName || null,
        departmentId:         editData.departmentId  ?? null,
        departmentName:       editData.departmentName || null,
        workPhone:            editData.workPhone    || null,
        hiringDate:           editData.hiringDate   || null,
        headOfDepartmentName: editData.headOfDepartmentName || null,
      }));
      closeEditMode();
    } catch {
      setSaving(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDepartmentChange = async (id, name) => {
    const dept = departments.find((d) => d.id === id);
    setEditData((prev) => ({
      ...prev,
      departmentId: id,
      departmentName: name,
      positionId: null,
      positionName: "",
      headOfDepartmentName: dept?.headOfDepartmentName ?? null,
    }));
    setPositions([]);
    if (id) {
      try {
        const pos = await getPositionsByDepartment(id);
        setPositions(pos ?? []);
      } catch { /* ignore */ }
    }
  };

  const handlePositionChange = (id, name) => {
    setEditData((prev) => ({ ...prev, positionId: id, positionName: name }));
  };

  const isOnline = onlineUsers?.has(userId);
  const isOwn    = userId === currentUserId;
  const canEdit  = isOwn || isAdmin;
  const fullName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : "";

  return (
    <>
      <div className="upp-overlay" onClick={onClose} />

      <button className="upp-close-btn" onClick={onClose} title="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {!isOwn && (
        <button className="upp-chat-icon-btn" onClick={() => { onStartChat?.(userId); onClose(); }} title="Send message">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      <div className="upp-panel">
        <div className="upp-panel-scroll" ref={panelRef}>
        <div className="upp-header">
          <div className="upp-header-info">
            <h1 className="upp-name">{loading ? "\u00A0" : fullName || "Unknown User"}</h1>
          </div>
          <div className="upp-tab-bar">
            {["General", "Drive", "Feed", "Security"].map((tab) => (
              <span
                key={tab}
                className={`upp-tab${activeTab === tab ? " active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >{tab}</span>
            ))}
          </div>
        </div>

        {/* ─── Drive & Feed — Coming Soon ──────────────── */}
        {(activeTab === "Drive" || activeTab === "Feed") && (
          <div className="upp-coming-soon">
            <div className="upp-coming-soon-icon-wrap">
              {activeTab === "Drive" ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 17H2a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9l2 3h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2z" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2H3v16h5l3 3 3-3h7V2z" />
                  <line x1="8" y1="8" x2="16" y2="8" />
                  <line x1="8" y1="12" x2="14" y2="12" />
                </svg>
              )}
            </div>
            <p className="upp-coming-soon-title">{activeTab}</p>
            <p className="upp-coming-soon-text">We will implement soon</p>
          </div>
        )}

        {/* ─── Security Tab ─────────────────────────────── */}
        {activeTab === "Security" && (isOwn || isAdmin) && (
          <div className={`upp-security-body${isAdmin && !isOwn ? " compact" : ""}`}>

            {loading ? (
              <>
                <div className="upp-sec-card upp-sec-skel-card">
                  <div className="upp-sk-title" />
                  {[...Array(isAdmin && !isOwn ? 2 : 3)].map((_, i) => (
                    <div key={i} className="upp-sk-sec-field" />
                  ))}
                  <div className="upp-sk-sec-btn" />
                </div>
                <div className="upp-sec-card upp-sec-skel-card upp-sec-skel-recover">
                  <div className="upp-sk-sec-circle" />
                  <div className="upp-sk-sec-line" style={{ width: 120 }} />
                  <div className="upp-sk-sec-line" style={{ width: "90%" }} />
                  <div className="upp-sk-sec-line" style={{ width: "70%" }} />
                  <div className="upp-sk-sec-email-row">
                    <div className="upp-sk-sec-icon" />
                    <div className="upp-sk-sec-line" style={{ width: 160 }} />
                  </div>
                  <div className="upp-sk-sec-btn" />
                </div>
              </>
            ) : (
            <>

            {/* Change Password */}
            <div className="upp-sec-card">
              <div className="upp-card-header">
                <h3 className="upp-card-title">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight:6,verticalAlign:"middle",opacity:0.7}}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  Change password
                </h3>
              </div>
              {profile?.passwordChangedAt && (
                <div className="upp-sec-hint">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Last changed: {fmtDateTime(profile.passwordChangedAt)}
                </div>
              )}
              <form className="upp-sec-form" onSubmit={handlePasswordChange} noValidate>
                {pwSuccess && (
                  <div className="upp-sec-success">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Password changed successfully.
                  </div>
                )}
                {pwErrors.general && (
                  <div className="upp-sec-error">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    {pwErrors.general}
                  </div>
                )}
                {[
                  ...((isAdmin && !isOwn) ? [] : [{ key: "current", label: "Current password" }]),
                  { key: "newPw",   label: "New password" },
                  { key: "confirm", label: "Confirm new password" },
                ].map(({ key, label }) => (
                  <div className="upp-sec-field" key={key}>
                    <label className="upp-field-label">{label}</label>
                    <div className="upp-sec-pw-wrap">
                      <input
                        className={`upp-field-input${pwErrors[key] ? " err" : ""}`}
                        type={showPw[key] ? "text" : "password"}
                        value={pwForm[key]}
                        onChange={e => setPwForm(p => ({ ...p, [key]: e.target.value }))}
                        autoComplete={key === "current" ? "current-password" : "new-password"}
                      />
                      <button
                        type="button"
                        className="upp-sec-eye"
                        onClick={() => setShowPw(p => ({ ...p, [key]: !p[key] }))}
                        tabIndex={-1}
                      >
                        {showPw[key] ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        )}
                      </button>
                    </div>
                    {pwErrors[key] && <span className="upp-sec-field-err">{pwErrors[key]}</span>}
                  </div>
                ))}
                <button className="upp-sec-submit" type="submit" disabled={pwLoading}>
                  {pwLoading ? <span className="upp-save-spinner" /> : "SAVE"}
                </button>
              </form>
            </div>

            {/* Recover Password */}
            <div className="upp-sec-card upp-sec-recover-card">
              <div className="upp-sec-recover-visual">
                <div className="upp-sec-recover-circle">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    <circle cx="12" cy="16" r="1" fill="currentColor"/>
                  </svg>
                </div>
                <h3 className="upp-sec-recover-title">Recover password</h3>
                <p className="upp-sec-recover-desc">Send a secure password reset link directly to the user's registered email address.</p>
              </div>
              <div className="upp-sec-recover-email-row">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                <span className="upp-sec-email">{profile?.email}</span>
              </div>
              <button className="upp-sec-via-btn" onClick={() => setRecoverModal(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
                Send recovery link
              </button>
            </div>

            </>
            )}

          </div>
        )}

        {/* ─── Recover modal ────────────────────────────── */}
        {recoverModal && createPortal(
          <div className="upp-confirm-overlay" onClick={() => setRecoverModal(false)}>
            <div className="upp-sec-modal" onClick={e => e.stopPropagation()}>
              <button className="upp-sec-modal-close" onClick={() => setRecoverModal(false)}>×</button>
              <div className="upp-sec-modal-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <p className="upp-sec-modal-title">Recovery link sent</p>
              <p className="upp-sec-modal-text">
                A password recovery link has been sent to the user's email address.
                This link expires after use or when a new one is requested.
              </p>
              <hr className="upp-sec-modal-hr" />
              <div className="upp-sec-modal-footer">
                <button className="upp-sec-modal-btn" onClick={() => setRecoverModal(false)}>Got it</button>
              </div>
            </div>
          </div>,
          document.body
        )}

        <div className="upp-body" style={{ display: activeTab === "General" ? undefined : "none" }}>
          <div className="upp-col-left">
            <div className="upp-avatar-card">
              <div className="upp-status-bar">
                {!loading && profile?.role === "Administrator" && (
                  <div className="upp-admin-ribbon">ADMINISTRATOR</div>
                )}
                {isAdmin && !isOwn && !loading && (
                  <div className="upp-actions-wrap" ref={actionsRef}>
                    <button className="upp-actions-btn" onClick={() => setActionsOpen((p) => !p)}>
                      ACTIONS
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    {actionsOpen && (
                      <div className="upp-actions-dropdown">
                        <button className="upp-actions-item" onClick={() => { setActionsOpen(false); setActionConfirm("admin"); }}>
                          {profile?.role === "Administrator" ? "Revoke admin permissions" : "Grant admin permissions"}
                        </button>
                        <button className="upp-actions-item upp-actions-item--danger" onClick={() => { setActionsOpen(false); setActionConfirm("deactivate"); }}>
                          {profile?.isActive ? "Disable account" : "Enable account"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <div className="upp-status-right">
                  <span className={`upp-status-badge ${isOnline ? "online" : "offline"}`}>
                    <span className="upp-status-dot" />
                    {isOnline ? "ONLINE" : "OFFLINE"}
                  </span>
                  {!isOnline && profile?.lastVisit && (
                    <span className="upp-last-seen">last seen {fmtDateTime(profile.lastVisit)}</span>
                  )}
                </div>
              </div>

              <div
                className={`upp-avatar-wrap${canEdit ? " editable" : ""}`}
                onClick={handleAvatarClick}
              >
                {profile?.avatarUrl ? (
                  <img src={getFileUrl(profile.avatarUrl)} alt={fullName} className="upp-avatar-img" />
                ) : profile ? (
                  <div className="upp-avatar-initials">
                    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="100" cy="100" r="100" fill="#cdd3da"/>
                      <circle cx="100" cy="78" r="30" fill="white" opacity="0.95"/>
                      <path d="M40 170 Q40 118 100 118 Q160 118 160 170 L160 200 L40 200 Z" fill="white" opacity="0.95"/>
                    </svg>
                  </div>
                ) : (
                  <div className="upp-avatar-skeleton" />
                )}
                {canEdit && (
                  <div className="upp-avatar-upload-overlay">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span>Upload a photo</span>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />
            </div>
          </div>

          <div className="upp-col-right">
            {loading && (
              <div className="upp-card-skeleton">
                <div className="upp-sk-title" />
                {[...Array(6)].map((_, i) => <div key={i} className="upp-sk-field" />)}
              </div>
            )}
            {error && <div className="upp-state-msg">Failed to load profile</div>}

            {!loading && profile && (
              <>
                <div className="upp-info-card">
                  <div className="upp-card-header">
                    <h3 className="upp-card-title">Contact info</h3>
                    {canEdit && !editMode && (
                      <button className="upp-card-edit" onClick={handleEditOpen}>edit</button>
                    )}
                    {editMode && (
                      <button className="upp-card-edit" onClick={handleCancelClick}>cancel</button>
                    )}
                  </div>

                  {!editMode && (
                    <div className="upp-fields">
                      <Field label="First name"    value={profile.firstName} />
                      <Field label="Last name"     value={profile.lastName} />
                      <Field label="Date of birth" value={fmtDate(profile.dateOfBirth)} />
                      <Field label="Position"      value={profile.position} />
                      <Field label="Department"    value={profile.departmentName} />
                      <Field label="Email"         value={profile.email} isEmail />
                      <Field label="Work phone"    value={profile.workPhone} />
                      <Field label="Hiring date"   value={fmtDate(profile.hiringDate)} />
                      <Field label="Last visit"    value={fmtDateTime(profile.lastVisit)} />
                      {profile.headOfDepartmentName && (
                        <Field label="Head of department" value={profile.headOfDepartmentName} />
                      )}
                    </div>
                  )}

                  {editMode && (
                    <div className={`upp-fields upp-edit-fields ${editVisible ? "visible" : ""}`}>
                      <EditField label="First name"    name="firstName"   value={editData.firstName}   onChange={handleChange} />
                      <EditField label="Last name"     name="lastName"    value={editData.lastName}    onChange={handleChange} />
                      <EditField label="Date of birth" name="dateOfBirth" value={editData.dateOfBirth} onChange={handleChange} type="date" inputClass="upp-field-input--half" />
                      <SelectField label="Department" options={departments} value={editData.departmentId} onChange={handleDepartmentChange} />
                      <SelectField label="Position"   options={positions}   value={editData.positionId}   onChange={handlePositionChange} />
                      <EditField label="Email"        name="email"     value={editData.email}     onChange={handleChange} type="email" />
                      <EditField label="Work phone"   name="workPhone" value={editData.workPhone} onChange={handleChange} />
                      <EditField label="Hiring date"  name="hiringDate"  value={editData.hiringDate}  onChange={handleChange} type="date" inputClass="upp-field-input--half" />
                      {editData.headOfDepartmentName && (
                        <Field label="Head of department" value={editData.headOfDepartmentName} />
                      )}
                      <Field label="Last visit" value={fmtDateTime(profile.lastVisit)} />
                    </div>
                  )}
                </div>

                {(subordinates.length > 0 || profile.supervisorName) && (
                  <div className="upp-info-card">
                    <div className="upp-card-header">
                      <h3 className="upp-card-title">Additional information</h3>
                    </div>

                    {subordinates.length > 0 && (
                      <div className="upp-sup-wrap">
                        <span className="upp-field-label">Subordinates</span>
                        <div className="upp-person-grid">
                          {(showAllSubs ? subordinates : subordinates.slice(0, 4)).map((p) => (
                            <PersonRow key={p.id} person={p} onClick={setNestedUserId} />
                          ))}
                        </div>
                        {subordinates.length > 4 && !showAllSubs && (
                          <button className="upp-show-more" onClick={() => setShowAllSubs(true)}>
                            Show more ({subordinates.length - 4})
                          </button>
                        )}
                      </div>
                    )}

                    {profile.supervisorName && (
                      <div className="upp-sup-wrap">
                        <span className="upp-field-label">Supervisor</span>
                        <div className="upp-person-grid">
                          <PersonRow
                            person={{
                              id: profile.supervisorId,
                              firstName: profile.supervisorName,
                              lastName: "",
                              position: profile.supervisorPosition ?? null,
                              avatarUrl: profile.supervisorAvatarUrl ?? null,
                            }}
                            onClick={setNestedUserId}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {(isOwn || isAdmin) && (
                  <div className="upp-info-card" ref={aboutCardRef}>
                    <div className="upp-card-header">
                      <h3 className="upp-card-title">About me</h3>
                      {profile.aboutMe && !aboutEditMode && (
                        <button className="upp-card-edit" onClick={() => { closeEditMode(); setAboutDraft(profile.aboutMe); setAboutEditMode(true); }}>edit</button>
                      )}
                    </div>

                    {aboutEditMode ? (
                      <div className="upp-about-editor">
                        <textarea
                          className="upp-about-textarea"
                          value={aboutDraft}
                          onChange={(e) => setAboutDraft(e.target.value)}
                          autoFocus
                          rows={4}
                        />
                        <div className="upp-about-footer-btns">
                          <button className="upp-about-send-btn" onClick={handleAboutSave}>SEND</button>
                          <button className="upp-about-cancel-btn" onClick={() => setAboutEditMode(false)}>CANCEL</button>
                        </div>
                      </div>
                    ) : profile.aboutMe ? (
                      <p className="upp-about">{profile.aboutMe}</p>
                    ) : (
                      <div className="upp-about-empty">
                        <div className="upp-about-empty-icon">
                          <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
                            <rect x="13" y="8" width="26" height="34" rx="3" stroke="#38bdf8" strokeWidth="1.8" fill="none"/>
                            <circle cx="26" cy="20" r="5" stroke="#38bdf8" strokeWidth="1.8" fill="none"/>
                            <path d="M17 36c0-4.418 4.03-8 9-8s9 3.582 9 8" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                          </svg>
                        </div>
                        <div className="upp-about-empty-right">
                          <p className="upp-about-empty-text">Share interesting life stories or tell other users about yourself, upload photos of memorable moments.</p>
                          <button className="upp-about-tell-btn" onClick={() => { closeEditMode(); setAboutDraft(""); setAboutEditMode(true); }}>TELL ABOUT YOURSELF</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {editMode && (
          <div className={`upp-edit-footer ${editVisible ? "visible" : ""}`}>
            <button
              className="upp-edit-save"
              onClick={handleSave}
              disabled={!isDirty || saving}
            >
              {saving
                ? <span className="upp-save-spinner" />
                : "SAVE"}
            </button>
            <button className="upp-edit-cancel" onClick={handleCancelClick} disabled={saving}>
              CANCEL
            </button>
          </div>
        )}
        </div>{/* upp-panel-scroll */}
      </div>{/* upp-panel */}

      {confirmOpen && (
        <ConfirmDialog
          message="Are you sure you want to cancel the changes?"
          onYes={() => { setConfirmOpen(false); closeEditMode(); }}
          onNo={() => setConfirmOpen(false)}
        />
      )}

      {actionConfirm === "admin" && (
        <ConfirmDialog
          message={profile?.role === "Administrator"
            ? `Revoke admin permissions from ${profile?.firstName}?`
            : `Grant admin permissions to ${profile?.firstName}?`}
          onYes={handleActionConfirm}
          onNo={() => setActionConfirm(null)}
          loading={actionLoading}
        />
      )}

      {actionConfirm === "deactivate" && (
        <ConfirmDialog
          message={profile?.isActive
            ? `Disable ${profile?.firstName}'s account?`
            : `Enable ${profile?.firstName}'s account?`}
          onYes={handleActionConfirm}
          onNo={() => setActionConfirm(null)}
          loading={actionLoading}
        />
      )}

      {cropFile && (
        <AvatarCropModal
          file={cropFile}
          uploading={avatarUploading}
          onSave={handleAvatarSave}
          onCancel={() => setCropFile(null)}
        />
      )}

      {nestedUserId && (
        <UserProfilePanel
          userId={nestedUserId}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onClose={() => setNestedUserId(null)}
          onStartChat={onStartChat}
          onlineUsers={onlineUsers}
        />
      )}
    </>
  );
}

export default memo(UserProfilePanel);
