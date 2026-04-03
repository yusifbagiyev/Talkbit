import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { getInitials, getAvatarColor } from "../utils/chatUtils";
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from "../services/api";
import { useToast } from "../context/ToastContext";
import "./ChannelPanel.css";

// ─── Hierarchy helpers ──────────────────────────────────────────────────────

// NodeType enum backend-dən integer (0,1,2) və ya string ("Department","User","Company")
// olaraq gələ bilər. Bu helper hər iki formatı normallaşdırır.
const NODE_TYPE_MAP = { 0: "Department", 1: "User", 2: "Company" };
function nodeType(node) {
  const t = node.type;
  if (typeof t === "number") return NODE_TYPE_MAP[t] || "";
  return t || "";
}

// Hierarchy ağacını normallaşdır — bütün node-larda type-ı string et (recursive)
function normalizeHierarchy(nodes) {
  if (!nodes) return [];
  return nodes.map((node) => ({
    ...node,
    type: nodeType(node),
    children: normalizeHierarchy(node.children),
  }));
}

// Departmentin altındakı bütün user-ləri tapır (recursive — sub-dept-lər daxil)
function collectDepartmentUsers(deptNode) {
  const users = [];
  for (const child of deptNode.children || []) {
    if (child.type === "User") {
      users.push({ id: child.id, name: child.name });
    } else if (child.type === "Department") {
      users.push(...collectDepartmentUsers(child));
    }
  }
  return users;
}

// Hierarchy ağacında node-u ID ilə tapır (recursive)
function findNodeById(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node;
    const found = findNodeById(node.children, id);
    if (found) return found;
  }
  return null;
}

// Axtarış mətninə uyğun ağac filter — yalnız uyğun node-ları saxlayır
function filterHierarchy(nodes, query) {
  if (!query) return nodes;
  const q = query.toLowerCase();
  const filtered = [];
  for (const node of nodes) {
    const nameMatch = node.name?.toLowerCase().includes(q);
    if (nameMatch && (node.type === "Department" || node.type === "Company")) {
      // Department/Company adı match edirsə — bütün uşaqları olduğu kimi saxla
      filtered.push(node);
    } else {
      // Uşaqları rekursiv filter et
      const filteredChildren = node.children?.length
        ? filterHierarchy(node.children, query)
        : [];
      if (nameMatch || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children:
            filteredChildren.length > 0 ? filteredChildren : node.children,
        });
      }
    }
  }
  return filtered;
}

// Axtarış zamanı avtomatik expand olunacaq department ID-lərini tap
function getAutoExpandIds(nodes, query) {
  if (!query) return new Set();
  const q = query.toLowerCase();
  const ids = new Set();
  for (const node of nodes) {
    if (node.children?.length) {
      // Uşaqlardan hər hansı biri match edirsə bu node-u expand et
      const childMatch = node.children.some(
        (c) => c.type === "User" && c.name?.toLowerCase().includes(q),
      );
      if (childMatch) ids.add(node.id);
      // Rekursiv — alt department-lərdə də yoxla
      const childExpands = getAutoExpandIds(node.children, query);
      if (childExpands.size > 0) {
        ids.add(node.id);
        for (const id of childExpands) ids.add(id);
      }
    }
  }
  return ids;
}

// ─── HierarchyNode — recursive tree node render ────────────────────────────
const HierarchyNode = memo(function HierarchyNode({
  node,
  selectedIds,
  onToggle,
  expandedDepts,
  onToggleExpand,
}) {
  const isDept = node.type === "Department";
  const isCompany = node.type === "Company";
  const isUser = node.type === "User";
  const isSelected = selectedIds.has(node.id);
  const isExpanded = expandedDepts.has(node.id);
  const hasChildren = node.children?.length > 0;

  if (isCompany) {
    // Company node-u sadəcə wrapper — children-i göstər
    return (
      <div className="add-member-company">
        {node.children?.map((child) => (
          <HierarchyNode
            key={child.id}
            node={child}
            selectedIds={selectedIds}
            onToggle={onToggle}
            expandedDepts={expandedDepts}
            onToggleExpand={onToggleExpand}
          />
        ))}
      </div>
    );
  }

  if (isDept) {
    return (
      <div className="add-member-dept">
        <div
          className={`add-member-dept-row${isSelected ? " selected" : ""}`}
          onClick={() => onToggle(node)}
        >
          {/* Expand/collapse chevron */}
          {hasChildren && (
            <button
              className="add-member-expand-btn"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand(node.id);
              }}
            >
              <svg
                className={`add-member-chevron${isExpanded ? " open" : ""}`}
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 6 15 12 9 18" />
              </svg>
            </button>
          )}
          {!hasChildren && <span className="add-member-expand-placeholder" />}

          {/* Department icon */}
          <div className="add-member-dept-icon">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>

          <div className="add-member-dept-info">
            <span className="add-member-dept-label">Department</span>
            <span className="add-member-dept-name">{node.name}</span>
          </div>

          {/* Check icon — seçilmişdirsə */}
          {isSelected && (
            <svg
              className="add-member-check"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2e87bf"
              strokeWidth="2.5"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Sub-items (sub-depts + users) — expanded olduqda */}
        {isExpanded && hasChildren && (
          <div className="add-member-children">
            {node.children.map((child) => (
              <HierarchyNode
                key={child.id}
                node={child}
                selectedIds={selectedIds}
                onToggle={onToggle}
                expandedDepts={expandedDepts}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (isUser) {
    return (
      <div
        className={`add-member-user-row${isSelected ? " selected" : ""}`}
        onClick={() => onToggle(node)}
      >
        {/* User avatar */}
        <div
          className="add-member-user-avatar"
          style={{
            background: node.avatarUrl
              ? "transparent"
              : getAvatarColor(node.name),
          }}
        >
          {node.avatarUrl ? (
            <img src={node.avatarUrl} alt="" />
          ) : (
            getInitials(node.name)
          )}
        </div>
        <span className="add-member-user-name">{node.name}</span>

        {/* Check icon — seçilmişdirsə */}
        {isSelected && (
          <svg
            className="add-member-check"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2e87bf"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
    );
  }

  return null;
});

// ─── ChannelPanel — Bitrix24 stilində channel yaratma/redaktə paneli ─────────
function ChannelPanel({
  onCancel,
  onChannelCreated,
  onChannelUpdated,
  currentUser,
  editMode = false,
  channelData = null,
}) {
  // Local state — editMode-da channelData-dan pre-fill olunur
  const [channelName, setChannelName] = useState(
    editMode && channelData ? channelData.name : "",
  );
  const [channelType, setChannelType] = useState(
    editMode && channelData ? channelData.type : "private",
  );
  const [description, setDescription] = useState(
    editMode && channelData ? channelData.description : "",
  );
  const [settingsOpen, setSettingsOpen] = useState(editMode);
  const [members, setMembers] = useState(() => {
    if (editMode && channelData?.members) return channelData.members;
    return currentUser
      ? [{ id: currentUser.id, name: currentUser.fullName, isAdmin: true }]
      : [];
  });

  // Channel name validation state
  const [nameError, setNameError] = useState(null); // error mesajı və ya null
  const [nameChecking, setNameChecking] = useState(false); // backend sorğusu gedir
  const [nameValid, setNameValid] = useState(editMode); // edit mode-da başlanğıcda valid
  const nameCheckTimer = useRef(null);

  // Debounced channel name validation — hər dəfə channelName dəyişəndə 500ms gözlə, sonra yoxla
  useEffect(() => {
    // Timer-i sıfırla (debounce)
    if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current);

    const name = channelName.trim();

    // Boş ad — heç bir şey göstərmə
    if (!name) {
      setNameError(null);
      setNameValid(false);
      setNameChecking(false);
      return;
    }

    // Frontend-də sürətli yoxlama (backendə sorğu göndərmədən)
    if (name.length < 2) {
      setNameError("Channel name must be at least 2 characters");
      setNameValid(false);
      setNameChecking(false);
      return;
    }
    if (name.length > 100) {
      setNameError("Channel name cannot exceed 100 characters");
      setNameValid(false);
      setNameChecking(false);
      return;
    }

    // EDIT MODE: ad dəyişməyibsə — backend-ə sorğu göndərmə, valid say
    if (editMode && channelData && name === channelData.name.trim()) {
      setNameValid(true);
      setNameError(null);
      setNameChecking(false);
      return;
    }

    // Backend-ə debounced sorğu göndər (500ms)
    setNameChecking(true);
    setNameError(null);
    setNameValid(false);

    nameCheckTimer.current = setTimeout(async () => {
      try {
        const result = await apiGet(
          `/api/channels/check-name?name=${encodeURIComponent(name)}`,
        );
        if (result.available) {
          setNameValid(true);
          setNameError(null);
        } else {
          setNameValid(false);
          setNameError(result.error || "This name is not available");
        }
      } catch {
        // Backend error — validation uğursuz, amma bloklamırıq
        setNameValid(false);
        setNameError(null);
      } finally {
        setNameChecking(false);
      }
    }, 500);

    return () => {
      if (nameCheckTimer.current) clearTimeout(nameCheckTimer.current);
    };
  }, [channelName, editMode, channelData]);

  const { showToast } = useToast();

  // Channel avatar state — müvəqqəti, yalnız frontendda saxlanılır
  const [avatarPreview, setAvatarPreview] = useState(
    editMode && channelData?.avatarUrl ? channelData.avatarUrl : null,
  ); // data URL string və ya edit mode-da mövcud avatar URL
  const [avatarFile, setAvatarFile] = useState(null); // File object — backendə göndəriləcək
  const fileInputRef = useRef(null);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // 0-byte və corrupt şəkil yoxlaması
    if (file.size === 0) {
      showToast(`"${file.name}" is empty (0 bytes)`, "error");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast(`"${file.name}" — corrupt or unreadable image`, "error");
    };
    img.src = url;
  };

  // Add member dropdown state
  const [addOpen, setAddOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [hierarchy, setHierarchy] = useState([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [expandedDepts, setExpandedDepts] = useState(new Set());

  const searchInputRef = useRef(null);
  const panelRef = useRef(null);

  // Seçilmiş member/department ID-ləri — sürətli lookup üçün Set
  const selectedIds = useMemo(() => {
    return new Set(members.map((m) => m.id));
  }, [members]);

  // ─── Hierarchy fetch ────────────────────────────────────────────────────
  // Add butonu ilk klik olunanda backend-dən hierarchy yüklənir
  useEffect(() => {
    if (!addOpen) return;
    if (hierarchy.length > 0) return; // Artıq yüklənibsə, təkrar yükləmə

    async function loadHierarchy() {
      setHierarchyLoading(true);
      try {
        const raw = await apiGet("/api/identity/organization/hierarchy");
        const data = normalizeHierarchy(raw || []);
        setHierarchy(data);
      } catch {
        showToast("Failed to load organization hierarchy.", "error");
      } finally {
        setHierarchyLoading(false);
      }
    }
    loadHierarchy();
  }, [addOpen, hierarchy.length, showToast]);

  // Dropdown açıldıqda input-a focus
  useEffect(() => {
    if (addOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [addOpen]);

  // Panel xaricində klik olunanda bağla
  useEffect(() => {
    if (!addOpen) return;
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setAddOpen(false);
        setSearchText("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [addOpen]);

  // Axtarışa görə filter olunmuş hierarchy
  const filteredHierarchy = useMemo(() => {
    return filterHierarchy(hierarchy, searchText);
  }, [hierarchy, searchText]);

  // Axtarış dəyişdikdə uyğun department-ləri avtomatik expand et
  useEffect(() => {
    if (!searchText.trim()) return;
    const ids = getAutoExpandIds(hierarchy, searchText);
    if (ids.size > 0) {
      setExpandedDepts((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    }
  }, [searchText, hierarchy]);

  // Department expand/collapse toggle
  const handleToggleExpand = useCallback((deptId) => {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(deptId)) {
        next.delete(deptId);
      } else {
        next.add(deptId);
      }
      return next;
    });
  }, []);

  // User və ya Department seçimi/unselect
  const handleToggle = useCallback(
    (node) => {
      const isDept = node.type === "Department";
      const isAlreadySelected = members.some((m) => m.id === node.id);

      if (isAlreadySelected) {
        // Owner (admin) unselect oluna bilməz
        const memberToRemove = members.find((m) => m.id === node.id);
        if (memberToRemove?.isAdmin) return;
        // Unselect — sil
        setMembers((prev) => prev.filter((m) => m.id !== node.id));
      } else {
        // Select — əlavə et
        if (isDept) {
          // Department seçimi: department adı chip olaraq əlavə olunur
          // type: "department" — CREATE basıldıqda bütün user-ləri resolve edəcəyik
          setMembers((prev) => [
            ...prev,
            {
              id: node.id,
              name: node.name,
              type: "department",
              // departmentUsers: sonra CREATE-də resolve olacaq
            },
          ]);
        } else {
          // User seçimi
          setMembers((prev) => [
            ...prev,
            { id: node.id, name: node.name, type: "user" },
          ]);
        }
      }
    },
    [members],
  );

  // CREATE CHAT state
  const [creating, setCreating] = useState(false);

  // ─── handleCreateChannel — CREATE CHAT butonu ─────────────────────────────
  // 1. Department member-ləri resolve edir (hierarchy-dən user ID-lər çıxarır)
  // 2. Backend-ə POST /api/channels göndərir
  // 3. Uğurlu → onChannelCreated callback çağırır
  const handleCreateChannel = async () => {
    if (creating || !nameValid) return;
    setCreating(true);

    try {
      // Members array-dan user ID-lərini topla
      // Department seçilibsə — hierarchy-dən bütün user-ləri resolve et
      const memberIds = new Set();
      for (const m of members) {
        if (m.isAdmin) continue; // Creator — backend constructor-da artıq əlavə olunur
        if (m.type === "department") {
          // Hierarchy-dən department node-u tap və user-lərini çıxar
          const deptNode = findNodeById(hierarchy, m.id);
          if (deptNode) {
            for (const u of collectDepartmentUsers(deptNode)) {
              if (u.id !== currentUser?.id) memberIds.add(u.id);
            }
          }
        } else {
          memberIds.add(m.id);
        }
      }

      // ChannelType: "private" → 2, "public" → 1
      const typeEnum = channelType === "public" ? 1 : 2;

      const result = await apiPost("/api/channels", {
        name: channelName.trim(),
        description: description.trim() || null,
        type: typeEnum,
        memberIds: [...memberIds],
      });

      // Avatar seçilibsə — upload et və channel-ı yenilə
      const channelId = result?.id;
      if (avatarFile && channelId) {
        try {
          const fd = new FormData();
          fd.append("File", avatarFile);
          const uploadResult = await apiUpload(
            `/api/files/upload/channel-avatar/${channelId}`,
            fd,
          );
          if (uploadResult?.fileUrl) {
            await apiPut(`/api/channels/${channelId}`, {
              avatarUrl: uploadResult.fileUrl,
            });
            result.avatarUrl = uploadResult.fileUrl;
          }
        } catch {
          // Channel yaradılıb, avatar uğursuz olsa da davam et
        }
      }

      // Backend channel DTO qaytarır — onChannelCreated callback ilə Chat.jsx-ə ötür
      if (onChannelCreated) onChannelCreated(result);
    } catch (err) {
      showToast(err.message || "Failed to create channel", "error");
    } finally {
      setCreating(false);
    }
  };

  // ─── handleUpdateChannel — SAVE CHANGES butonu (edit mode) ────────────────
  const handleUpdateChannel = async () => {
    if (creating || !nameValid || !editMode || !channelData) return;
    setCreating(true);

    try {
      // 1. Avatar upload (əgər dəyişibsə)
      let newAvatarUrl = null;
      if (avatarFile) {
        try {
          const fd = new FormData();
          fd.append("File", avatarFile);
          const uploadResult = await apiUpload(
            `/api/files/upload/channel-avatar/${channelData.id}`,
            fd,
          );
          if (uploadResult?.fileUrl) newAvatarUrl = uploadResult.fileUrl;
        } catch {
          // Avatar upload uğursuz — digər dəyişikliklər davam edir
        }
      }

      // 2. Channel məlumatlarını yenilə
      const typeEnum = channelType === "public" ? 1 : 2;
      await apiPut(`/api/channels/${channelData.id}`, {
        name: channelName.trim(),
        description: description.trim() || null,
        type: typeEnum,
        ...(newAvatarUrl ? { avatarUrl: newAvatarUrl } : {}),
      });

      // 2. Member diff hesabla
      const originalUserIds = new Set(
        channelData.members.filter((m) => !m.isAdmin).map((m) => m.id),
      );

      const currentUserIds = new Set();
      for (const m of members) {
        if (m.isAdmin) continue; // Owner həmişə qalır
        if (m.type === "department") {
          const deptNode = findNodeById(hierarchy, m.id);
          if (deptNode) {
            for (const u of collectDepartmentUsers(deptNode)) {
              if (u.id !== currentUser?.id) currentUserIds.add(u.id);
            }
          }
        } else {
          currentUserIds.add(m.id);
        }
      }

      // Yeni əlavə olunanlar
      const toAdd = [...currentUserIds].filter(
        (id) => !originalUserIds.has(id),
      );
      // Silinənlər
      const toRemove = [...originalUserIds].filter(
        (id) => !currentUserIds.has(id),
      );

      // 3. Əlavə et — parallel execution
      await Promise.all(
        toAdd.map((userId) =>
          apiPost(`/api/channels/${channelData.id}/members`, {
            userId,
            showChatHistory: true,
          }).catch(() => {}),
        ),
      );

      // 4. Sil — parallel execution
      await Promise.all(
        toRemove.map((userId) =>
          apiDelete(`/api/channels/${channelData.id}/members/${userId}`).catch(
            () => {},
          ),
        ),
      );

      // 5. Callback
      if (onChannelUpdated) {
        onChannelUpdated({
          id: channelData.id,
          name: channelName.trim(),
          avatarUrl: newAvatarUrl || channelData.avatarUrl,
        });
      }
    } catch (err) {
      showToast(err.message || "Failed to update channel", "error");
    } finally {
      setCreating(false);
    }
  };

  // +Add butonu klik
  const handleAddClick = () => {
    setAddOpen(true);
  };

  return (
    <div className="create-channel-panel">
      {/* Scrollable content */}
      <div className="create-channel-content">
        {/* Yuxarı: Avatar + Channel adı input */}
        <div className="create-channel-top">
          <div className="create-channel-avatar" onClick={handleAvatarClick}>
            {avatarPreview ? (
              <img
                src={avatarPreview}
                alt="Channel avatar"
                className="create-channel-avatar-img"
              />
            ) : (
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            )}
            {/* Gizli file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: "none" }}
            />
          </div>
          <div className="create-channel-name-wrapper">
            <input
              type="text"
              className={`create-channel-name-input${nameError ? " error" : ""}`}
              placeholder="Enter chat name"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              autoFocus
            />
            <div
              className={`create-channel-name-status${nameError ? " error" : ""}`}
            >
              {nameError || "\u00A0"}
            </div>
          </div>
        </div>

        {/* Members bölməsi — panel xaricində, background F1F4F6 */}
        <div className="create-channel-members-section">
          <div className="create-channel-section-label">
            <span className="create-channel-label-text">Members</span>
            <span className="create-channel-label-hint">
              (add a person or a department)
            </span>
          </div>
          <div className="create-channel-members-card" ref={panelRef}>
            <div className="create-channel-members">
              {members.map((member) => (
                <div
                  key={member.id}
                  className={`create-channel-member-chip${member.type === "department" ? " dept" : ""}`}
                >
                  {member.isAdmin && (
                    <svg
                      className="create-channel-crown"
                      width="10"
                      height="10"
                      viewBox="0 0 24 24"
                      fill="#f59e0b"
                    >
                      <path d="M2 20h20l-2-12-5 5-3-7-3 7-5-5z" />
                    </svg>
                  )}
                  {member.type === "department" ? (
                    <div className="create-channel-chip-dept-icon">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                  ) : (
                    <div
                      className="create-channel-chip-avatar"
                      style={{ background: getAvatarColor(member.name) }}
                    >
                      {getInitials(member.name)}
                    </div>
                  )}
                  <span className="create-channel-chip-name">
                    {member.name}
                  </span>
                  {/* Admin (yaradıcı) silinə bilməz */}
                  {!member.isAdmin && (
                    <button
                      className="create-channel-chip-remove"
                      onClick={() =>
                        setMembers((prev) =>
                          prev.filter((m) => m.id !== member.id),
                        )
                      }
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}

              {/* +Add butonu / Search input */}
              {addOpen ? (
                <input
                  ref={searchInputRef}
                  type="text"
                  className="add-member-search-input"
                  placeholder="Search..."
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
              ) : (
                <button
                  className="create-channel-add-btn"
                  onClick={handleAddClick}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Add</span>
                </button>
              )}
            </div>
            {/* Hierarchy panel — input-un altında açılır */}
            {addOpen && (
              <div className="add-member-panel">
                {hierarchyLoading ? (
                  <div className="add-member-loading" />
                ) : filteredHierarchy.length === 0 ? (
                  <div className="add-member-empty">No results found</div>
                ) : (
                  <div className="add-member-list">
                    {filteredHierarchy.map((node) => (
                      <HierarchyNode
                        key={node.id}
                        node={node}
                        selectedIds={selectedIds}
                        onToggle={handleToggle}
                        expandedDepts={expandedDepts}
                        onToggleExpand={handleToggleExpand}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chat Settings — həmişə göstərilir */}
        <div className={`create-channel-card${settingsOpen ? " open" : ""}`}>
          <button
            className="create-channel-card-header"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            <div className="create-channel-card-title">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>Chat settings</span>
            </div>
            <svg
              className={`create-channel-chevron ${settingsOpen ? "open" : ""}`}
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {settingsOpen && (
            <div className="create-channel-card-body">
              {/* Chat type */}
              <div className="create-channel-field-label">Chat type</div>

              <label className="create-channel-radio">
                <input
                  type="radio"
                  name="channelType"
                  value="private"
                  checked={channelType === "private"}
                  onChange={() => setChannelType("private")}
                />
                <span className="create-channel-radio-dot" />
                <div className="create-channel-radio-content">
                  <span className="create-channel-radio-title">Private</span>
                  <span className="create-channel-radio-desc">
                    This chat will not be visible in the chat list. Chat members
                    can only be added manually. Perfect for private
                    communications.
                  </span>
                </div>
              </label>

              <label className="create-channel-radio">
                <input
                  type="radio"
                  name="channelType"
                  value="public"
                  checked={channelType === "public"}
                  onChange={() => setChannelType("public")}
                />
                <span className="create-channel-radio-dot" />
                <div className="create-channel-radio-content">
                  <span className="create-channel-radio-title">Public</span>
                  <span className="create-channel-radio-desc">
                    This chat is visible to everyone in the chat list. Anyone
                    can join this chat. Perfect for interdepartmental
                    communication and general conversations.
                  </span>
                </div>
              </label>

              {/* Description */}
              <div className="create-channel-field-label">Description</div>
              <textarea
                className="create-channel-description"
                placeholder="Enter chat description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
            </div>
          )}
        </div>
      </div>

      {/* Alt buttonlar */}
      <div className="create-channel-footer">
        <button
          className="create-channel-submit-btn"
          disabled={!nameValid || nameChecking || creating}
          onClick={editMode ? handleUpdateChannel : handleCreateChannel}
        >
          {creating
            ? editMode
              ? "SAVING..."
              : "CREATING..."
            : editMode
              ? "SAVE CHANGES"
              : "CREATE CHAT"}
        </button>
        <button className="create-channel-cancel-btn" onClick={onCancel}>
          CANCEL
        </button>
      </div>
    </div>
  );
}

export default memo(ChannelPanel);
