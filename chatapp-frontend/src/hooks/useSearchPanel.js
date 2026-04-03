// ─── useSearchPanel.js — Custom Hook: Chat Daxili Mesaj Axtarışı ───────────
// Bu hook chat-ın içindəki axtarış panelinin məntiqini idarə edir:
//   - Debounced axtarış (400ms)
//   - Pagination (load more)
//   - State sıfırlama (chat dəyişdikdə)

import { useState, useRef, useEffect } from "react";
import { apiGet } from "../services/api";

// ─── useSearchPanel ──────────────────────────────────────────────────────────
// selectedChat: hansı chat açıqdır (search scope təyin etmək üçün)
export default function useSearchPanel(selectedChat) {
  // ─── State-lər ────────────────────────────────────────────────────────────
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResultsList, setSearchResultsList] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [searchFromSidebar, setSearchFromSidebar] = useState(false);

  // Debounce timer ref
  const searchTimerRef = useRef(null);

  // ─── Debounced search useEffect ────────────────────────────────────────────
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const q = searchQuery.trim();
    if (!q || q.length < 2 || !selectedChat) {
      setSearchResultsList([]);
      setSearchHasMore(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    let cancelled = false;
    searchTimerRef.current = setTimeout(async () => {
      try {
        const scope = selectedChat.type === 1 ? 3 : 4;
        const idParam =
          selectedChat.type === 1
            ? `channelId=${selectedChat.id}`
            : `conversationId=${selectedChat.id}`;
        const data = await apiGet(
          `/api/search?q=${encodeURIComponent(q)}&scope=${scope}&${idParam}&page=1&pageSize=20`,
        );
        if (cancelled) return;
        setSearchResultsList(data.results || []);
        setSearchHasMore(data.hasNextPage || false);
        setSearchPage(1);
      } catch {
        if (cancelled) return;
        /* ignore */
        setSearchResultsList([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedChat?.id, selectedChat?.type]);

  // ─── loadMoreSearchResults ─────────────────────────────────────────────────
  async function loadMoreSearchResults() {
    if (searchLoading || !searchHasMore || !selectedChat) return;
    setSearchLoading(true);
    try {
      const q = searchQuery.trim();
      const nextPage = searchPage + 1;
      const scope = selectedChat.type === 1 ? 3 : 4;
      const idParam =
        selectedChat.type === 1
          ? `channelId=${selectedChat.id}`
          : `conversationId=${selectedChat.id}`;
      const data = await apiGet(
        `/api/search?q=${encodeURIComponent(q)}&scope=${scope}&${idParam}&page=${nextPage}&pageSize=20`,
      );
      setSearchResultsList((prev) => [...prev, ...(data.results || [])]);
      setSearchHasMore(data.hasNextPage || false);
      setSearchPage(nextPage);
    } catch {
      /* ignore */
    } finally {
      setSearchLoading(false);
    }
  }

  // ─── resetSearch ───────────────────────────────────────────────────────────
  // handleSelectChat-da çağırılır (state sıfırlama)
  function resetSearch() {
    setShowSearchPanel(false);
    setSearchQuery("");
    setSearchResultsList([]);
    setSearchPage(1);
    setSearchHasMore(false);
  }

  return {
    showSearchPanel,
    setShowSearchPanel,
    searchQuery,
    setSearchQuery,
    searchResultsList,
    searchLoading,
    searchHasMore,
    searchFromSidebar,
    setSearchFromSidebar,
    loadMoreSearchResults,
    resetSearch,
  };
}
