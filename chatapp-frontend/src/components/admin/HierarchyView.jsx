import { useState, useEffect } from "react";
import { getOrganizationHierarchy, getFileUrl } from "../../services/api";
import { getInitials, getAvatarColor } from "../../utils/chatUtils";
import "./HierarchyView.css";

// ─── Search filter (recursive) ────────────────────────────────────────────────
function filterTree(nodes, query) {
  return nodes.reduce((acc, node) => {
    const match = node.name?.toLowerCase().includes(query);
    const filteredChildren = node.children?.length ? filterTree(node.children, query) : [];
    if (match || filteredChildren.length > 0)
      acc.push({ ...node, children: filteredChildren });
    return acc;
  }, []);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function HierarchySkeleton() {
  return (
    <div className="hi-skeleton">
      {[1, 2].map(i => (
        <div key={i} className="hi-skeleton-company">
          <div className="hi-skeleton-bar" style={{ width: "220px" }} />
          {[1, 2, 3].map(j => (
            <div key={j} className="hi-skeleton-bar"
              style={{ width: `${180 - j * 20}px`, marginLeft: j * 12 + "px" }} />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── HierarchyView ────────────────────────────────────────────────────────────
function HierarchyView({ isSuperAdmin }) {
  const [tree, setTree]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [collapsed, setCollapsed] = useState(new Set());

  useEffect(() => {
    getOrganizationHierarchy()
      .then(data => setTree(data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id) => setCollapsed(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const renderNode = (node) => {
    const isCollapsed = collapsed.has(node.id);
    const hasChildren = node.children?.length > 0;

    if (node.type === "Company") {
      return (
        <div key={node.id} className="hi-company-node">
          <div className="hi-company-header" onClick={() => toggle(node.id)}>
            <span className={`hi-chevron${isCollapsed ? "" : " hi-chevron--open"}`}>▶</span>
            <div className="hi-company-logo" style={{ background: getAvatarColor(node.name) }}>
              {node.avatarUrl
                ? <img src={getFileUrl(node.avatarUrl)} alt="" />
                : getInitials(node.name)}
            </div>
            <span className="hi-company-name">{node.name}</span>
            <span className="hi-count-badge">{node.userCount ?? 0} users</span>
          </div>
          {!isCollapsed && hasChildren && (
            <div className="hi-children">{node.children.map(renderNode)}</div>
          )}
        </div>
      );
    }

    if (node.type === "Department") {
      const indent = node.level * 24;
      return (
        <div key={node.id} className="hi-dept-node" style={{ paddingLeft: indent + 16 }}>
          <div
            className="hi-dept-header"
            onClick={() => hasChildren && toggle(node.id)}
            style={!hasChildren ? { cursor: "default" } : {}}
          >
            {hasChildren && (
              <span className={`hi-chevron${isCollapsed ? "" : " hi-chevron--open"}`}>▶</span>
            )}
            <svg className="hi-dept-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            </svg>
            <span className="hi-dept-name">{node.name}</span>
            <span className="hi-count-badge">{node.userCount ?? 0} users</span>
            {node.headOfDepartmentName && (
              <span className="hi-dept-head-hint">Head: {node.headOfDepartmentName}</span>
            )}
          </div>
          {!isCollapsed && hasChildren && (
            <div className="hi-children">{node.children.map(renderNode)}</div>
          )}
        </div>
      );
    }

    if (node.type === "User") {
      const indent = node.level * 24;
      return (
        <div
          key={node.id}
          className={`hi-user-row${node.isDepartmentHead ? " hi-user-row--head" : ""}`}
          style={{ paddingLeft: indent + 16 }}
        >
          <div
            className="hi-avatar"
            style={{ background: node.avatarUrl ? "transparent" : getAvatarColor(node.name) }}
          >
            {node.avatarUrl
              ? <img src={getFileUrl(node.avatarUrl)} alt="" />
              : getInitials(node.name)}
          </div>
          <div className="hi-user-info">
            <span className="hi-user-name">{node.name}</span>
            {node.positionName && <span className="hi-position">{node.positionName}</span>}
          </div>
          {node.isDepartmentHead && <span className="hi-head-badge">★ Head</span>}
          {node.role && (
            <span className={`hi-role-badge hi-role-badge--${node.role.toLowerCase()}`}>
              {node.role}
            </span>
          )}
        </div>
      );
    }

    return null;
  };

  // Admin view: company layer-ini keç, birbaşa dept-lər
  const nodes = isSuperAdmin
    ? tree
    : tree.flatMap(n => n.type === "Company" ? n.children : [n]);

  const searchLower = search.toLowerCase().trim();
  const visible = searchLower ? filterTree(nodes, searchLower) : nodes;

  return (
    <div className="hi-root">
      <div className="hi-toolbar">
        <h2 className="hi-title">Users</h2>
        <div className="hi-search-wrap">
          <svg className="hi-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="hi-search"
            placeholder="Search users or departments..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className="hi-tree">
        {loading
          ? <HierarchySkeleton />
          : visible.length === 0
            ? <div className="hi-empty">No users found.</div>
            : visible.map(renderNode)}
      </div>
    </div>
  );
}

export default HierarchyView;
