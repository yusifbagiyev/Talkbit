// React hook-ları
// useState — state, useEffect — side effect, useContext — global state
// useRef — re-render etmədən dəyər saxlamaq, useMemo — hesablamanı cache-lər
// useCallback — funksiyanı cache-lər
import {
  useState,
  useEffect,
  useLayoutEffect,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from "react";

// SignalR bağlantı idarəetməsi
import {
  getConnection, // aktiv SignalR bağlantısını qaytarır
  onConnectionStateChange, // SignalR bağlantı state listener
} from "../services/signalr";

// Custom hook-lar — ayrı fayllarda saxlanılan məntiqi bloklar
// .NET ekvivalenti: service class-ı inject etmək kimi
import useChatSignalR from "../hooks/useChatSignalR"; // real-time event handler-lar
import useChatScroll from "../hooks/useChatScroll"; // infinite scroll + pagination
import useMessageSelection from "../hooks/useMessageSelection"; // mesaj seçmə rejimi
import useMention from "../hooks/useMention"; // @ mention sistemi
import useSearchPanel from "../hooks/useSearchPanel"; // chat daxili axtarış
import useFileUpload from "../hooks/useFileUpload"; // fayl yükləmə state (seçmə)
import useFileUploadManager from "../hooks/useFileUploadManager"; // global upload manager
import useSidebarPanels from "../hooks/useSidebarPanels"; // sidebar panel state + məntiq
import useChannelManagement from "../hooks/useChannelManagement"; // channel + üzv idarəsi

// Global auth state — user, logout
import { AuthContext } from "../context/AuthContext";
// Toast notification — alert() əvəzinə modern UI notification
import { useToast } from "../context/ToastContext";

// API servis — HTTP metodları (GET, POST, PUT, DELETE)
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";

// UI komponentlər — hər biri ayrı bir visual blok
import Sidebar from "../components/Sidebar"; // sol nav bar
import ConversationList from "../components/ConversationList"; // söhbət siyahısı
import MessageBubble from "../components/MessageBubble"; // tək mesaj balonu
import ForwardPanel from "../components/ForwardPanel"; // mesaj yönləndir panel
import ChatHeader from "../components/ChatHeader"; // chat başlığı (ad, status)
import ChatInputArea from "../components/ChatInputArea"; // mesaj yazma sahəsi
import DetailSidebar from "../components/DetailSidebar"; // sağ detail panel
import ChatStatusBar from "../components/ChatStatusBar"; // viewed/typing status bar
import ReadersPanel from "../components/ReadersPanel"; // oxuyanlar panel
import ImageViewer from "../components/ImageViewer"; // şəkil lightbox viewer
import SelectToolbar from "../components/SelectToolbar"; // çox mesaj seç toolbar
import ChannelPanel from "../components/ChannelPanel"; // channel yaratma/redaktə paneli
import PinnedBar, { PinnedExpanded } from "../components/PinnedBar"; // pinlənmiş mesajlar
import ConfirmDialog from "../components/ConfirmDialog"; // təsdiqləmə modalı

// Util-lər və sabitlər
import {
  groupMessagesByDate, // mesajları tarixə görə qruplaşdır
  getChatEndpoint, // chat tipinə görə doğru API endpoint-i qaytar
  getAvatarColor, // avatar rəngi (hash-based)
  getInitials, // addan 2 hərf (avatar mətni)
  MESSAGE_PAGE_SIZE, // bir dəfədə neçə mesaj yükləmək
  CONVERSATION_PAGE_SIZE, // söhbət siyahısı səhifə ölçüsü
  HIGHLIGHT_DURATION_MS, // mesaj vurğulama müddəti (millisaniyə)
  TYPING_DEBOUNCE_MS, // typing siqnalı debounce müddəti
  BATCH_DELETE_THRESHOLD, // batch delete üçün minimum mesaj sayı
  MAX_BATCH_FILES, // backend batch limit (max 20 mesaj bir request-də)
  mergeMessageWithPrev, // API + SignalR state merge
  computeOptimisticReactions, // reaction toggle-u lokal hesabla
} from "../utils/chatUtils";

import { Virtuoso } from "react-virtuoso";
import "./Chat.css";


// Chat komponenti — əsas chat səhifəsi
// .NET ekvivalenti: @page "/" ilə ChatPage.razor
function Chat() {
  // --- AUTH ---
  // useContext ilə AuthContext-dən user və logout al
  const { user, logout } = useContext(AuthContext);
  const { showToast } = useToast();

  // --- STATE DEĞİŞƏNLƏRİ ---

  // Söhbət siyahısı — sol paneldəki bütün chatlar
  const [conversations, setConversations] = useState([]);

  // Seçilmiş chat — sağ paneldə açıq olan söhbət
  // null olduqda "Select a chat" boş ekranı görünür
  const [selectedChat, setSelectedChat] = useState(null);

  // --- CUSTOM HOOK STATE-LƏRİ (aşağıda hook çağırışlarında) ---
  // Channel, sidebar, search, mention, file upload, message selection state-ləri
  // ayrı hook-lara çıxarılıb — bax: hooks/ qovluğu

  // Mesajlar siyahısı — aktiv chatın mesajları
  // Backend DESC qaytarır (yeni → köhnə), biz tersine çeviririk
  const [messages, setMessages] = useState([]);

  // Söhbət siyahısı yüklənirkən true — LoadingState göstərmək üçün
  const [isLoading, setIsLoading] = useState(true);

  // Axtarış mətni — ConversationList filtri üçün
  const [searchText, setSearchText] = useState("");

  // Mesaj yazma sahəsinin dəyəri
  const [messageText, setMessageText] = useState("");

  // Draft saxlama — conversation dəyişdikdə yazılan mətn yadda qalır
  const draftsRef = useRef({});

  // messagesEndRef — mesaj siyahısının ən sonuna yerləşdirilmiş gizli div
  // scrollIntoView() ilə ən yeni mesaja scroll etmək üçün
  const messagesEndRef = useRef(null);

  // messagesAreaRef — scroll container-i (Virtuoso scrollerRef ilə bağlanır)
  const messagesAreaRef = useRef(null);

  // floatingDateRef — scroll zamanı cari tarixi göstərən sabit element
  const floatingDateRef = useRef(null);

  // pendingHighlightRef — around endpoint-dən sonra vurğulanacaq mesajın id-si
  // useLayoutEffect-də istifadə olunur
  const pendingHighlightRef = useRef(null);

  // highlightTimerRef — highlight setTimeout ID-si (unmount-da təmizləmək üçün)
  const highlightTimerRef = useRef(null);
  const handleSendMessageRef = useRef(null);

  // showScrollDownRef — scroll-to-bottom buton görünürmü (ref — stale closure yoxdur)
  const showScrollDownRef = useRef(false);

  // ─── Conversation Cache — chat dəyişəndə blank screen əvəzinə cache-dən göstər ───
  // Map<chatId, { messages, pinnedMessages, hasMore, hasMoreDown, timestamp }>
  const messageCacheRef = useRef(new Map());
  const CACHE_TTL = 5 * 60 * 1000; // 5 dəqiqə
  const CACHE_MAX_SIZE = 10;       // Ən çox 10 chat cache-lənir

  // allReadPatchRef — unreadCount===0 ilə girdikdə true olur
  // useChatScroll-da scroll ilə yüklənən mesajları da isRead:true patch etmək üçün
  // Backend channel mesajları üçün oxunmuş olsa belə isRead:false qaytarır
  const allReadPatchRef = useRef(false);

  // shouldScrollBottom — yeni mesaj gəldikdə / chat seçildikdə aşağıya scroll et
  const [shouldScrollBottom, setShouldScrollBottom] = useState(false);

  // ─── Network / Connection State ─────────────────────────────────────────────
  // isOffline: navigator.onLine === false (internet bağlantısı yoxdur)
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  // Toast: yalnız əvvəl connected olub sonra kəsilən halda göstər
  const wasConnectedRef = useRef(false);
  const [toast, setToast] = useState(null); // { type, message, hiding }
  const toastTimerRef = useRef(null);

  // chatLoading — conversation seçildikdə mesajlar yüklənənə qədər true
  const [chatLoading, setChatLoading] = useState(false);

  // showScrollDown — 1 viewport yuxarı scroll edildikdə true → scroll-to-bottom butonu göstər
  const [showScrollDown, setShowScrollDown] = useState(false);

  // onlineUsers — Set<userId> — online olan istifadəçilərin id-ləri
  // Set — unikal dəyərlər (dublikat yoxdur), like HashSet<T> in C#
  const [onlineUsers, setOnlineUsers] = useState(new Set());

  // typingUsers — { conversationId: true } — yazma indicator-u
  // key: conversationId, value: true (yazır), undefined (yazmır)
  const [typingUsers, setTypingUsers] = useState({});

  // Typing debounce üçün — son typing siqnalından 2 saniyə sonra "stopped typing" göndər
  const typingTimeoutRef = useRef(null);

  // isTypingRef — hazırda typing siqnalı göndərilib-göndərilmədiyi
  // useRef istifadə olunur çünki dəyişmə re-render etməməlidir
  const isTypingRef = useRef(false);

  // Emoji picker açıq/bağlı
  const [emojiOpen, setEmojiOpen] = useState(false);

  // emojiPanelRef — emoji panel-i (kənar klik bağlama üçün)
  const emojiPanelRef = useRef(null);

  // replyTo — reply ediləcək mesaj (null = reply yoxdur)
  const [replyTo, setReplyTo] = useState(null);

  // editMessage — redaktə ediləcək mesaj (null = edit mode yox)
  const [editMessage, setEditMessage] = useState(null);

  // forwardMessage — yönləndirilən mesaj (null = forward panel bağlı)
  const [forwardMessage, setForwardMessage] = useState(null);

  // pinnedMessages — aktiv chatda pinlənmiş mesajların siyahısı
  const [pinnedMessages, setPinnedMessages] = useState([]);

  // pinBarExpanded — pinlənmiş mesajlar siyahısı genişlənib (PinnedExpanded görünür)
  const [pinBarExpanded, setPinBarExpanded] = useState(false);

  // currentPinIndex — PinnedBar-da hazırda göstərilən pin-in indeksi
  const [currentPinIndex, setCurrentPinIndex] = useState(0);

  // readLaterMessageId — "sonra oxu" olaraq işarələnmiş mesajın id-si (separator üçün)
  const [readLaterMessageId, setReadLaterMessageId] = useState(null);

  // newMessagesStartId — conversation açılanda ilk oxunmamış mesajın id-si (separator üçün)
  const [newMessagesStartId, setNewMessagesStartId] = useState(null);

  // pendingScrollToReadLater — around mode-da separator-a scroll etmək lazım olduqda true
  const pendingScrollToReadLaterRef = useRef(false);

  // pendingScrollToUnread — normal mode-da new messages separator-a scroll etmək üçün
  const pendingScrollToUnreadRef = useRef(false);

  // chatRequestId — hər handleSelectChat çağırışında artır, stale API cavablarını ignore etmək üçün
  const chatRequestIdRef = useRef(0);

  // pendingDeleteMsg — action menu-dan tək mesaj silmə təsdiqləməsi
  const [pendingDeleteMsg, setPendingDeleteMsg] = useState(null);

  // pendingLeaveChannel — channel-dan ayrılma təsdiqləməsi (null = bağlı, obyekt = təsdiq gözləyir)
  const [pendingLeaveChannel, setPendingLeaveChannel] = useState(null);

  // pendingDeleteConv — conversation/channel silmə təsdiqləməsi (null = bağlı, obyekt = təsdiq gözləyir)
  const [pendingDeleteConv, setPendingDeleteConv] = useState(null);

  // inputRef — textarea element-i (focus vermək üçün)
  const inputRef = useRef(null);

  // lastReadTimestamp — DM: mesajın oxunma vaxtı (SignalR event-dən capture edilir)
  const [lastReadTimestamp, setLastReadTimestamp] = useState({});

  // channelMembers — channel üzvlərinin lookup map-i
  // { [channelId]: { [userId]: { fullName, avatarUrl } } }
  const [channelMembers, setChannelMembers] = useState({});

  // readersPanel — reader list panel state (null = bağlı)
  const [readersPanel, setReadersPanel] = useState(null);

  // imageViewer — lightbox state (null = bağlı, { currentIndex } = açıq)
  const [imageViewer, setImageViewer] = useState(null);

  // --- CUSTOM HOOKS ---

  // useChatScroll — infinite scroll pagination (Virtuoso callback-ları çağırır)
  const {
    handleStartReached,
    handleEndReached,
    hasMoreRef,
    hasMoreDownRef,
    loadingOlder,
    loadOlderTriggeredRef,
    loadingMoreRef,
    prependAnchorRef,
  } = useChatScroll(messages, selectedChat, setMessages, allReadPatchRef, messagesAreaRef);

  // virtuosoRef — Virtuoso komponentinə ref (scrollToIndex üçün)
  const virtuosoRef = useRef(null);

  // virtuosoResetKey — Virtuoso-nu tam remount etmək üçün (height cache sıfırlamaq)
  // Data tamamilə dəyişdikdə (handleScrollToBottom, around mode) Virtuoso-nun
  // daxili height cache-i köhnə data-dan qalır → scrollHeight yanlış olur.
  // Key dəyişdikdə Virtuoso remount olur → initialTopMostItemIndex tətbiq olunur.
  const [virtuosoResetKey, setVirtuosoResetKey] = useState(0);

  // firstItemIndex — Virtuoso prepend mexanizmi üçün (köhnə mesajlar yüklənəndə azalır)
  // QEYD: useRef istifadə olunur, useState DEYİL — çünki firstItemIndex senderRuns ilə
  // EYNİ RENDER-də dəyişməlidir. useEffect 1-render gecikmə yaradır → scroll jump.
  const firstItemIndexRef = useRef(100_000);

  // scrollbarTimerRef — scrollbar gizlənmə timer-i (800ms inactivity sonra)
  const scrollbarTimerRef = useRef(null);
  // programmaticScrollRef — programmatic scroll zamanı scrollbar-ı suppress et
  const programmaticScrollRef = useRef(false);

  // useMessageSelection — mesaj seçmə rejimi (SelectToolbar)
  const {
    selectMode, selectedMessages, deleteConfirmOpen, setDeleteConfirmOpen,
    hasOthersSelected,
    handleEnterSelectMode, handleToggleSelect, handleExitSelectMode,
    handleDeleteSelected, resetSelection,
  } = useMessageSelection(selectedChat, messages, setMessages, user);

  // useMention — @ mention sistemi
  const mention = useMention({
    selectedChat, channelMembers, conversations, user,
    inputRef, messageText, setMessageText,
  });

  // useSearchPanel — chat daxili mesaj axtarışı
  const search = useSearchPanel(selectedChat);

  // useFileUpload — fayl seçmə state (FilePreviewPanel üçün)
  const fileUpload = useFileUpload();
  // Upload fallback reload — SignalR echo miss olduqda mesajları yenidən yüklə
  const handleUploadFallbackReload = useCallback(async (chatId, chatType) => {
    try {
      const endpoint = getChatEndpoint(chatId, chatType, "/messages");
      if (!endpoint) return;
      const data = await apiGet(`${endpoint}?pageSize=${MESSAGE_PAGE_SIZE}`);
      // Yalnız hələ eyni chat açıqdırsa yenilə
      setSelectedChat((current) => {
        if (current && current.id === chatId) {
          setMessages((prev) => {
            const prevMap = new Map(prev.map(m => [m.id, m]));
            return data.map((m) => mergeMessageWithPrev(m, prevMap.get(m.id)));
          });
        }
        return current;
      });
    } catch { /* ignore */ }
  }, []);

  // Upload-dan sonra ConversationList statusunu "Sent" et — DM ilə eyni davranış
  const handleUploadMessageSent = useCallback((chatId) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === chatId && c.lastMessageStatus === "Pending"
          ? { ...c, lastMessageStatus: "Sent" }
          : c,
      ),
    );
  }, []);

  // useFileUploadManager — global upload manager (progress, cancel, retry)
  const uploadManager = useFileUploadManager(user, handleUploadFallbackReload, handleUploadMessageSent);

  // useSidebarPanels — sidebar panel state + məntiq
  const sidebar = useSidebarPanels(selectedChat, messages, channelMembers, setChannelMembers);

  // useChannelManagement — channel + üzv idarəsi
  const channel = useChannelManagement(
    selectedChat, conversations, channelMembers, setChannelMembers,
    sidebar.showMembersPanel, sidebar.loadMembersPanelPage,
  );

  // --- EFFECT-LƏR ---

  // Mount olduqda bir dəfə söhbət siyahısını yüklə
  // [] — boş dependency array = yalnız ilk render-də işlə (like OnInitializedAsync)
  useEffect(() => {
    loadConversations();

    // Səhifə refresh/bağlanma — typing siqnalını dayandır (Ctrl+R, tab bağlama vs.)
    const handleBeforeUnload = () => {
      stopTypingSignal();
      flushReadBatch();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Unmount cleanup — timer/timeout memory leak-lərin qarşısını al
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      stopTypingSignal(); // Component unmount — typing dayandır
      flushReadBatch();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // useChatSignalR — real-time event-ləri dinlə (NewMessage, UserOnline, Typing, etc.)
  // Bu hook içəridə useEffect ilə SignalR event handler-larını qeydiyyata alır
  useChatSignalR(
    user.id,
    setSelectedChat,
    setMessages,
    setConversations,
    setShouldScrollBottom,
    setOnlineUsers,
    setTypingUsers,
    setPinnedMessages,
    setCurrentPinIndex,
    setLastReadTimestamp,
    uploadManager.checkForCompletion, // Upload task-ı sil — real mesaj gəldikdə
    messagesAreaRef, // Scroll container — reaction scroll compensation üçün
    showScrollDownRef, // Scroll-to-bottom buton görünürmü — compensation yalnız aşağıdaysa
    messageCacheRef, // Cache invalidasiya — yeni mesaj gəldikdə köhnə cache-i sil
  );

  // ─── Network / Connection State Effect ──────────────────────────────────────
  // Online/offline event + SignalR connection state listener
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // SignalR connection state callback + toast logic
    onConnectionStateChange((state) => {
      if (state === "connected") {
        if (wasConnectedRef.current) {
          // Əvvəl connected idi, kəsildi, indi yenidən qoşuldu —
          // səhifəni reload et ki, qaçırılmış mesajlar, statuslar hamısı təmiz yüklənsin
          window.location.reload();
          return;
        }
        wasConnectedRef.current = true;
      } else if (wasConnectedRef.current && (state === "reconnecting" || state === "disconnected")) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToast({
          type: state,
          message: state === "reconnecting" ? "Reconnecting..." : "Connection lost. Reconnecting...",
        });
      }
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      onConnectionStateChange(null);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // --- MEMOIZED DATA (effects-dən əvvəl təyin olunmalıdır) ---

  // Upload task-larını optimistic mesajlara çevir və messages ilə birləşdir
  // messages DESC-dir (ən yeni index 0-da), upload mesajları da index 0-a gedir
  const messagesWithUploads = useMemo(() => {
    const currentUploads = uploadManager.getUploadsForChat(selectedChat?.id);
    if (currentUploads.length === 0) return messages;

    // "sent" statuslu task-lar üçün: real mesaj artıq messages-dədirsə göstərmə
    // (SignalR echo gəlib, amma checkForCompletion hələ çağırılmayıb — dublikat qoruması)
    const messageFileIds = new Set(messages.map((m) => m.fileId).filter(Boolean));

    // Upload task → optimistic mesaj formatına çevir
    const uploadMsgs = currentUploads
      .filter((task) => {
        // Sent statuslu task-ın fileId-si artıq messages-dədirsə → dublikatdır, göstərmə
        if (task.status === "sent" && task.fileId && messageFileIds.has(task.fileId)) return false;
        return true;
      })
      .map((task) => ({
        id: task.tempId,
        content: task.text || "",
        senderId: user?.id,
        senderFullName: user?.fullName || "",
        senderAvatarUrl: user?.avatarUrl || null,
        createdAtUtc: task.createdAtUtc,
        isRead: true,
        isEdited: false,
        isDeleted: false,
        isPinned: false,
        status: task.status === "sent" ? 1 : 0, // sent → checkmark, qalanları → clock
        reactions: [],
        fileUrl: task.previewUrl, // local Object URL (şəkillər üçün)
        fileContentType: task.fileContentType,
        fileName: task.fileName,
        fileSizeInBytes: task.fileSizeInBytes,
        fileId: task.fileId || null,
        fileWidth: task.fileWidth || null,   // Lokal ölçülər → layout shift yox
        fileHeight: task.fileHeight || null,
        replyToMessageId: task.replyToMessageId,
        replyToContent: task.replyToContent,
        replyToSenderName: task.replyToSenderName,
        // Upload-specific flag-lar (MessageBubble overlay üçün)
        _optimistic: true,
        _uploading: task.status !== "sent", // "sent" → normal görünüş (overlay yox)
        _localPreview: !!task.previewUrl,   // Local Object URL — getFileUrl istifadə etmə
        _uploadStatus: task.status,
        _uploadProgress: task.totalBytes > 0 ? task.uploadedBytes / task.totalBytes : 0,
        _uploadedBytes: task.uploadedBytes,
        _totalBytes: task.totalBytes,
        _uploadTempId: task.tempId,
      }));

    if (uploadMsgs.length === 0) return messages;

    // Upload mesajları ən yeni — DESC sırada əvvələ əlavə et
    return [...uploadMsgs, ...messages];
  }, [messages, uploadManager, selectedChat?.id, user]);

  // grouped — mesajları tarix separator-ları ilə qruplaşdır
  // useMemo — messages dəyişmədikdə bu hesablamanı yenidən etmə
  // [...messages].reverse() — messages DESC-dir, ASC-ə çevir (köhnə → yeni)
  const grouped = useMemo(
    () => groupMessagesByDate([...messagesWithUploads].reverse(), readLaterMessageId, newMessagesStartId),
    [messagesWithUploads, readLaterMessageId, newMessagesStartId],
  );

  // senderRuns — ardıcıl eyni-sender mesajlarını qruplara ayır
  // Separator-lar ayrı item olaraq qalır, mesajlar sender-group run-larına bükülür
  const senderRuns = useMemo(() => {
    const runs = [];
    let currentRun = null;

    for (let i = 0; i < grouped.length; i++) {
      const item = grouped[i];
      if (item.type !== "message") {
        if (currentRun) { runs.push(currentRun); currentRun = null; }
        runs.push(item);
        continue;
      }
      const msg = item.data;
      const senderId = msg.senderId;
      if (currentRun && currentRun.senderId === senderId) {
        currentRun.messages.push(msg);
      } else {
        if (currentRun) runs.push(currentRun);
        currentRun = {
          type: "senderRun",
          senderId,
          isOwn: senderId === user?.id,
          senderFullName: msg.senderFullName,
          messages: [msg],
        };
      }
    }
    if (currentRun) runs.push(currentRun);
    return runs;
  }, [grouped, user?.id]);

  // flatItems — senderRuns-ı düzləşdir: hər mesaj = 1 Virtuoso item
  // Bu sayədə firstItemIndex düzgün işləyir (prepend zamanı item sayı HƏMİŞƏ artır)
  // Əvvəl: senderRun(A, [m1, m2, old1]) — köhnə mesajlar mövcud item-ə birləşirdi
  // İndi: [msg(m1), msg(m2), msg(old1)] — hər mesaj ayrı item, firstItemIndex azalır
  const flatItems = useMemo(() => {
    const items = [];
    for (const run of senderRuns) {
      if (run.type !== "senderRun") {
        items.push(run);
        continue;
      }
      const { messages: runMsgs, isOwn, senderFullName, senderId } = run;
      for (let i = 0; i < runMsgs.length; i++) {
        items.push({
          type: "message",
          message: runMsgs[i],
          isOwn,
          senderFullName,
          senderId,
          isFirstInGroup: i === 0,
          isLastInGroup: i === runMsgs.length - 1,
        });
      }
    }
    return items;
  }, [senderRuns]);

  // flatItemsMetadata — messageId → flatItems index mapping + date label lookup
  // Virtuoso scrollToIndex üçün lazımdır (around mode, highlight, reply jump)
  const flatItemsMetadata = useMemo(() => {
    const msgIdToIndex = new Map();
    const indexToDateLabel = new Map();
    let currentDateLabel = "";
    for (let i = 0; i < flatItems.length; i++) {
      const item = flatItems[i];
      if (item.type === "date") currentDateLabel = item.label;
      indexToDateLabel.set(i, currentDateLabel);
      if (item.type === "message") {
        msgIdToIndex.set(item.message.id, i);
      }
    }
    return { msgIdToIndex, indexToDateLabel };
  }, [flatItems]);

  // ─── Stabil ref-lər — useCallback dependency-lərini azaltmaq üçün ───────────
  // flatItemsMetadata və flatItems hər mesaj dəyişikliğində yenidən yaranır.
  // Callback-larda birbaşa istifadə etsək, callback hər dəfə yenilənir →
  // renderFlatItem yenilənir → bütün MessageBubble-lar yenidən render olur (flash).
  // Ref ilə callback stabil qalır, amma həmişə ən son data-ya çatır.
  const flatItemsRef = useRef(flatItems);
  flatItemsRef.current = flatItems;
  const flatItemsMetadataRef = useRef(flatItemsMetadata);
  flatItemsMetadataRef.current = flatItemsMetadata;

  // ─── firstItemIndex — Virtuoso prepend mexanizmi ─────────────────────────────
  // Köhnə mesajlar yüklənəndə flatItems BAŞLANĞICINDA yeni item-lər əlavə olunur.
  // firstItemIndex bu fərq qədər azalır → Virtuoso scroll pozisiyasını avtomatik saxlayır.
  //
  // QEYD: render vaxtı hesablanır (useEffect DEYİL) — firstItemIndex yeni data ilə
  // EYNİ RENDER-də dəyişməlidir, əks halda 1-frame jump olur.
  const prevFlatLenRef = useRef(0);
  const currFlatLen = flatItems.length;
  if (prevFlatLenRef.current > 0 && currFlatLen > prevFlatLenRef.current && loadOlderTriggeredRef.current) {
    firstItemIndexRef.current -= (currFlatLen - prevFlatLenRef.current);
    loadOlderTriggeredRef.current = false;
  }
  prevFlatLenRef.current = currFlatLen;
  const firstItemIndex = firstItemIndexRef.current;

  // ─── Prepend scroll correction ─────────────────────────────────────────────
  // Virtuoso firstItemIndex ilə scroll pozisiyasını estimated hündürlüklərlə düzəldir.
  // Lakin variable-height mesajlarda (şəkil, uzun mətn) estimation xətası olur →
  // kiçik amma gözəçarpan scroll jump yaranır.
  //
  // Həll: useLayoutEffect (paint-dən ƏVVƏL) ilə anchor elementin faktiki pozisiyasını
  // prepend əvvəli pozisiyası ilə müqayisə edib scrollTop-u düzəldirik.
  // Virtuoso child komponent olduğu üçün öz useLayoutEffect-i BİZDƏN ƏVVƏL çalışır →
  // biz yalnız residual error-u düzəldirik, conflict yoxdur.
  useLayoutEffect(() => {
    const area = messagesAreaRef.current;
    const anchor = prependAnchorRef.current;
    if (!anchor) {
      // Anchor yoxdur amma prepending class qalıb → təmizlə
      area?.classList.remove("prepending");
      return;
    }
    prependAnchorRef.current = null;

    if (!area) return;

    const el = area.querySelector(`[data-bubble-id="${anchor.id}"]`);
    if (el) {
      const containerTop = area.getBoundingClientRect().top;
      const currentRelativeTop = el.getBoundingClientRect().top - containerTop;
      const diff = currentRelativeTop - anchor.relativeTop;

      // 1px-dən böyük fərq varsa — düzəlt (sub-pixel fərqləri ignore et)
      if (Math.abs(diff) > 1) {
        area.scrollTop += diff;
      }
    }
    // Prepend flash suppress — scroll correction bitdi, messages area-nı göstər
    area.classList.remove("prepending");
  }); // dependency yoxdur — hər render-də yoxlayır, anchor varsa düzəldir

  // ─── Virtuoso scroll effektləri ───
  // QEYD: useEffect + setTimeout istifadə olunur çünki Virtuoso data dəyişikliyi sonrası
  // daxili layout hesablamalarını bitirməyə vaxt lazımdır. useLayoutEffect çox tez fire edir.

  // shouldScrollBottom → Virtuoso scrollTo API istifadə et
  // Birbaşa DOM (area.scrollTop) istifadə etmək OLMAZ — Virtuoso daxili state-ini yeniləmir
  // və sonra scroll pozisiyasını "düzəldir" (override edir).
  // Bir neçə cəhd edir — Virtuoso layout hesablamalarını bitirməyə vaxt lazımdır.
  // scrollBottomCancelRef — istifadəçi yuxarı scroll etdikdə gözləyən doScroll-ları ləğv edir
  // QEYD: cleanup YOXDUR — setShouldScrollBottom(false) re-render yaradır,
  // cleanup timer-ları ləğv edərdi (timer self-cancel bug). Əvəzinə ref-based cancel.
  const scrollBottomCancelRef = useRef(false);
  useEffect(() => {
    if (!shouldScrollBottom) return;
    setShouldScrollBottom(false);
    scrollBottomCancelRef.current = false;
    programmaticScrollRef.current = true; // Scrollbar suppress — programmatic scroll başlayır

    const doScroll = () => {
      if (scrollBottomCancelRef.current) return;
      virtuosoRef.current?.scrollTo({ top: 999999 });
    };

    // 150ms sonra user-scroll listener bağla — öz scroll-larımız bitsin,
    // bundan sonra istifadəçi scroll edərsə cancel flag + suppress söndür
    const area = messagesAreaRef.current;
    const onUserScroll = () => {
      scrollBottomCancelRef.current = true;
      programmaticScrollRef.current = false;
    };
    setTimeout(() => {
      area?.addEventListener("scroll", onUserScroll, { once: true, passive: true });
    }, 150);

    // rAF loop — Virtuoso layout hesablamalarını gözlə (8 frame ≈ 130ms)
    let attempts = 0;
    const tryScroll = () => {
      doScroll();
      if (++attempts < 8) requestAnimationFrame(tryScroll);
    };
    requestAnimationFrame(tryScroll);

    // Tək timeout fallback — şəkillər/lazy content yüklənə bilər
    setTimeout(doScroll, 350);

    // Programmatic scroll bitdi — scrollbar suppress-i söndür (cancel olmadısa)
    setTimeout(() => { programmaticScrollRef.current = false; }, 600);
  }, [shouldScrollBottom]);

  // getAround / highlight — mesajlar yüklənəndən sonra hədəfə scroll + highlight
  // QEYD: cleanup yoxdur — messages/flatItemsMetadata eyni batch-da dəyişə bilər,
  // cleanup timer-i ləğv edərdi
  useEffect(() => {
    const messageId = pendingHighlightRef.current;
    if (!messageId) return;
    pendingHighlightRef.current = null;

    setTimeout(() => {
      const targetIndex = flatItemsMetadataRef.current.msgIdToIndex.get(messageId);
      if (targetIndex === undefined) return;

      // Virtuoso scrollToIndex DATA ARRAY INDEX istəyir (firstItemIndex ilə əlaqəsi yoxdur)
      virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: "center", behavior: "auto" });

      // Render-dən sonra highlight et (2 frame gözlə — Virtuoso render-i bitsin)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = messagesAreaRef.current?.querySelector(`[data-bubble-id="${messageId}"]`);
          if (target) {
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            // Class sil → 1 frame gözlə → class əlavə et → animation restart
            target.classList.remove("highlight-message");
            requestAnimationFrame(() => {
              target.classList.add("highlight-message");
              highlightTimerRef.current = setTimeout(() => {
                target.classList.remove("highlight-message");
                highlightTimerRef.current = null;
              }, HIGHLIGHT_DURATION_MS);
            });
          }
        });
      });
    }, 100);
  }, [messages]);

  // Read later separator-a scroll — conversation açılanda separator mərkəzə gəlsin
  useEffect(() => {
    if (!pendingScrollToReadLaterRef.current) return;
    pendingScrollToReadLaterRef.current = false;

    setTimeout(() => {
      const idx = flatItemsRef.current.findIndex((r) => r.type === "readLater");
      if (idx !== -1) {
        virtuosoRef.current?.scrollToIndex({ index: idx, align: "center", behavior: "auto" });
      }
    }, 100);
  }, [messages]);

  // New messages separator-a scroll — unread mesaj olduqda separator görünsün
  useEffect(() => {
    if (!pendingScrollToUnreadRef.current) return;
    pendingScrollToUnreadRef.current = false;

    setTimeout(() => {
      const idx = flatItemsRef.current.findIndex((r) => r.type === "newMessages");
      if (idx !== -1) {
        virtuosoRef.current?.scrollToIndex({ index: idx, align: "center", behavior: "auto" });
      } else {
        virtuosoRef.current?.scrollToIndex({ index: "LAST", align: "end", behavior: "auto" });
      }
    }, 100);
  }, [messages]);

  // ─── Mark-as-read mexanizmi ───
  // initialMsgIdsRef — conversation açılanda yüklənən mesaj ID-ləri
  //   Bu mesajlar viewport-da görünəndə dərhal read olur (scroll ilə)
  //   Yeni SignalR mesajları bu set-də yoxdur → yazmağa/göndərməyə qədər unread qalır
  // hasNewUnreadRef — SignalR ilə yeni unread mesaj gəlib mi?
  //   Yazmağa başlayanda/göndərəndə mark-all-read çağırılır
  const initialMsgIdsRef = useRef(new Set());
  const hasNewUnreadRef = useRef(false);
  const firstUnreadMsgIdRef = useRef(null);
  const visibleUnreadRef = useRef(new Set());
  const readBatchChatRef = useRef(null);
  const readBatchTimerRef = useRef(null);
  const processedMsgIdsRef = useRef(new Set());

  // hasNewUnreadRef-i yeni SignalR mesajı gəldikdə true et
  // firstUnreadMsgIdRef — ilk unread mesajı yadda saxla (scroll limit üçün)
  // Bütün yeni mesajlar oxunanda (isRead: true) → hasNewUnreadRef = false
  useEffect(() => {
    const newUnreads = messages.filter(
      (m) => !m.isRead && m.senderId !== user?.id && !initialMsgIdsRef.current.has(m.id),
    );
    if (newUnreads.length > 0) {
      hasNewUnreadRef.current = true;
      // İlk unread-i yadda saxla (messages newest-first → sonuncu = ən köhnə)
      if (!firstUnreadMsgIdRef.current) {
        firstUnreadMsgIdRef.current = newUnreads[newUnreads.length - 1].id;
      }
    } else if (hasNewUnreadRef.current) {
      // Bütün yeni mesajlar oxundu (IntersectionObserver ilə) → reset
      hasNewUnreadRef.current = false;
      firstUnreadMsgIdRef.current = null;
    }
  }, [messages, user?.id]);

  // flushReadBatch — buferdəki mesajları batch göndər
  function flushReadBatch() {
    const ids = visibleUnreadRef.current;
    const chatInfo = readBatchChatRef.current;
    if (ids.size === 0 || !chatInfo) return;

    const batch = [...ids];
    visibleUnreadRef.current = new Set();

    if (readBatchTimerRef.current) {
      clearTimeout(readBatchTimerRef.current);
      readBatchTimerRef.current = null;
    }

    const { chatId, chatType } = chatInfo;

    // Frontend — mesajları isRead: true et
    const idSet = new Set(batch);
    setMessages((prev) =>
      prev.map((m) => idSet.has(m.id) ? { ...m, isRead: true } : m),
    );

    // Conversation list unreadCount azalt
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id === chatId && c.unreadCount > 0) {
          return { ...c, unreadCount: Math.max(0, c.unreadCount - batch.length) };
        }
        return c;
      }),
    );

    // Backend-ə batch read göndər
    Promise.all(
      batch.map((msgId) =>
        chatType === "0"
          ? apiPost(`/api/conversations/${chatId}/messages/${msgId}/read`)
          : apiPost(`/api/channels/${chatId}/messages/${msgId}/mark-as-read`),
      ),
    ).catch(() => {});
  }

  // markAllAsReadForCurrentChat — bütün unread mesajları oxundu et
  // Yazmağa başlayanda və ya mesaj göndərəndə çağırılır
  const markAllAsReadForCurrentChat = useCallback(() => {
    if (!hasNewUnreadRef.current) return;
    hasNewUnreadRef.current = false;
    firstUnreadMsgIdRef.current = null;

    const chatInfo = readBatchChatRef.current;
    if (!chatInfo) return;
    const { chatId, chatType } = chatInfo;

    setMessages((prev) =>
      prev.map((m) => m.isRead ? m : { ...m, isRead: true }),
    );

    const endpoint = chatType === "0"
      ? `/api/conversations/${chatId}/messages/mark-all-read`
      : `/api/channels/${chatId}/messages/mark-as-read`;
    apiPost(endpoint).catch(() => {});

    setConversations((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, unreadCount: 0 } : c,
      ),
    );

    visibleUnreadRef.current = new Set();
  }, []);

  // handleScrollToBottom — scroll-to-bottom butonu basıldığında
  // Həmişə API-dən ən son mesajları yüklə — around mode-da da, normal mode-da da
  // Bu, SignalR ilə miss olmuş mesajların da görsənməsini təmin edir
  // QEYD: Virtuoso remount EDİLMİR — scrollToIndex ilə aşağıya scroll olunur.
  // Remount (virtuosoResetKey) bütün mesajları silir və yenidən render edir → "flash" effekti.
  async function handleScrollToBottom() {
    if (!selectedChat) return;
    // Butonu dərhal gizlət — aşağı scroll zamanı yenidən görünməsin
    setShowScrollDown(false);
    showScrollDownRef.current = false;
    scrollBottomCancelRef.current = false; // Əvvəlki cancel-i sıfırla
    programmaticScrollRef.current = true; // Scrollbar suppress
    try {
      const endpoint = getChatEndpoint(selectedChat.id, selectedChat.type, "/messages");
      if (!endpoint) return;
      const data = await apiGet(`${endpoint}?pageSize=${MESSAGE_PAGE_SIZE}`);
      // initialMsgIdsRef yenilə — yeni mesajlar "initial" sayılsın
      // Bu, useEffect-in hasNewUnreadRef-i yenidən true etməsinin qarşısını alır
      initialMsgIdsRef.current = new Set(data.map((m) => m.id));
      setMessages(data);
    } catch {
      // API uğursuz → mövcud mesajlardan ən yenilərini saxla
      setMessages((prev) => prev.slice(0, MESSAGE_PAGE_SIZE));
    }
    hasMoreRef.current = true;
    hasMoreDownRef.current = false;
    firstItemIndexRef.current = 100_000; prevFlatLenRef.current = 0; // Fresh data — reset
    // startReached guard — data dəyişəndə Virtuoso dərhal fire etməsin
    loadingMoreRef.current = true;
    setTimeout(() => { loadingMoreRef.current = false; }, 300);
    // Unread tracking sıfırla — istifadəçi açıq şəkildə aşağıya scroll etdi
    hasNewUnreadRef.current = false;
    firstUnreadMsgIdRef.current = null;
    // Data yeniləndikdən sonra Virtuoso-ya ən sona scroll et
    // Cancel-aware doScroll — istifadəçi scroll etdikdə bütün gözləyən scroll-lar ləğv olur
    const doScroll = () => {
      if (scrollBottomCancelRef.current) return;
      virtuosoRef.current?.scrollTo({ top: 999999 });
    };
    // rAF loop — Virtuoso layout hesablamalarını gözlə (8 frame ≈ 130ms)
    let attempts = 0;
    const tryScroll = () => {
      doScroll();
      if (++attempts < 8) requestAnimationFrame(tryScroll);
    };
    requestAnimationFrame(tryScroll);
    // Tək timeout fallback — şəkillər/lazy content yüklənə bilər
    setTimeout(doScroll, 350);
    // 150ms sonra user-scroll listener — istifadəçi scroll edərsə bütün doScroll-lar ləğv olur
    const area = messagesAreaRef.current;
    const onUserScroll = () => {
      scrollBottomCancelRef.current = true;
      programmaticScrollRef.current = false;
    };
    setTimeout(() => {
      area?.addEventListener("scroll", onUserScroll, { once: true, passive: true });
    }, 150);
    // Programmatic scroll bitdi — scrollbar suppress-i söndür (cancel olmadısa)
    setTimeout(() => { programmaticScrollRef.current = false; }, 600);
  }

  // IntersectionObserver SİLİNDİ — Virtuoso rangeChanged callback ilə əvəz olundu (aşağıda)

  // --- API FUNKSIYALARI ---

  // loadConversations — bütün söhbətləri backend-dən yüklə
  // GET /api/unified-conversations?pageNumber=1&pageSize=50
  async function loadConversations() {
    try {
      const data = await apiGet(
        `/api/unified-conversations?pageNumber=1&pageSize=${CONVERSATION_PAGE_SIZE}`,
      );
      // data.items — paged response-dan items array
      setConversations(data.items);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoading(false); // Yüklənmə bitdi (uğurlu olsa da olmasada)
    }
  }

  // loadPinnedMessages — seçilmiş chatın pinlənmiş mesajlarını yüklə
  // Yalnız handleSelectChat-dan sonra çağırılır
  const loadPinnedMessages = useCallback(async (chat) => {
    try {
      const endpoint = getChatEndpoint(chat.id, chat.type, "/messages/pinned");
      if (!endpoint) return;
      const data = await apiGet(endpoint);
      // DESC sıralama — ən son pinlənmiş birinci görünsün
      const sorted = (data || []).sort(
        (a, b) => new Date(b.pinnedAtUtc) - new Date(a.pinnedAtUtc),
      );
      setPinnedMessages(sorted);
    } catch (err) {
      console.error("Failed to load pinned messages:", err);
      setPinnedMessages([]);
    }
  }, []);

  // loadFavoriteMessages → useSidebarPanels hook-una çıxarılıb

  // handleSelectSearchUser — search nəticəsindən user seçildikdə
  // Mövcud conversation varsa seç, yoxdursa POST /api/conversations ilə yarat
  // Hidden conversation: listdə yoxdur amma backend-də mövcuddur — listə əlavə etmədən aç
  async function handleSelectSearchUser(selectedUser) {
    // 1. Mövcud conversations-da bu user ilə conversation varmı?
    const existing = conversations.find((c) => c.otherUserId === selectedUser.id);
    if (existing) {
      handleSelectChat(existing);
      setSearchText("");
      return;
    }

    // 2. Yoxdursa — yeni conversation yarat (və ya hidden olanı backend-dən al)
    try {
      const result = await apiPost("/api/conversations", {
        otherUserId: selectedUser.id,
      });

      // 3. Conversation-ı listə əlavə etmədən birbaşa aç
      // Mesaj göndərdikdən və ya yeni mesaj gəldikdən sonra listdə görünəcək
      const newChat = {
        id: result.conversationId,
        name: selectedUser.fullName,
        type: 0,
        otherUserId: selectedUser.id,
        otherUserPosition: selectedUser.position,
        unreadCount: 0,
        lastMessage: null,
        lastMessageAtUtc: null,
      };
      handleSelectChat(newChat);
    } catch (err) {
      console.error("Failed to create conversation:", err);
    }
    setSearchText("");
  }

  // handleSelectSearchChannel — search nəticəsindən channel seçildikdə
  // handleSelectSearchChannel — search nəticəsindən channel seçildikdə
  // Conversations array-da varsa seç, yoxdursa (hidden) birbaşa aç
  function handleSelectSearchChannel(channel) {
    const existing = conversations.find((c) => c.id === channel.id);
    if (existing) {
      handleSelectChat(existing);
    } else {
      // Hidden channel — listdə yoxdur, birbaşa aç
      const hiddenChat = {
        id: channel.id,
        name: channel.name,
        type: 1,
        memberCount: channel.memberCount,
        unreadCount: 0,
        lastMessage: null,
        lastMessageAtUtc: null,
      };
      handleSelectChat(hiddenChat);
    }
    setSearchText("");
  }

  // handleMarkAllAsRead — bütün oxunmamış conversation-ların mesajlarını oxunmuş işarələ
  // Filter button → "Mark all as read" seçildikdə çağırılır
  async function handleMarkAllAsRead() {
    // unreadCount > 0 olan conversation-ları tap
    const unreadConvos = conversations.filter((c) => c.unreadCount > 0);
    if (unreadConvos.length === 0) return;

    // Hər biri üçün uyğun endpoint çağır (paralel)
    // type 1 → Channel, type 0 → DM
    await Promise.all(
      unreadConvos.map((c) => {
        if (c.type === 1) {
          return apiPost(`/api/channels/${c.id}/messages/mark-as-read`).catch(() => {});
        }
        // DM (type 0) və Notes
        return apiPost(`/api/conversations/${c.id}/messages/mark-all-read`).catch(() => {});
      }),
    );

    // Conversations siyahısını yenilə (unreadCount → 0)
    await loadConversations();
  }

  // ─── Context menu handler-ləri ─────────────────────────────────────────────

  // handleTogglePin — conversation-ı pin/unpin et
  async function handleTogglePin(conv) {
    try {
      const endpoint = conv.type === 1
        ? `/api/channels/${conv.id}/toggle-pin`
        : `/api/conversations/${conv.id}/messages/toggle-pin`;
      const result = await apiPost(endpoint);
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === conv.id);
        if (exists) {
          // Mövcud conversation-ı yenilə
          return prev.map((c) => c.id === conv.id ? { ...c, isPinned: result.isPinned } : c);
        }
        // Hidden idi, pin edildikdə backend unhide etdi — listə geri əlavə et
        if (result.isPinned) {
          return [...prev, { ...conv, isPinned: true }];
        }
        return prev;
      });
      // Seçili chat eyni conversation-dırsa, selectedChat-ı da yenilə
      if (selectedChat && selectedChat.id === conv.id) {
        setSelectedChat((prev) => ({ ...prev, isPinned: result.isPinned }));
      }
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  }

  // handleToggleMute — conversation-ı mute/unmute et
  async function handleToggleMute(conv) {
    try {
      const endpoint = conv.type === 1
        ? `/api/channels/${conv.id}/toggle-mute`
        : `/api/conversations/${conv.id}/messages/toggle-mute`;
      const result = await apiPost(endpoint);
      setConversations((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, isMuted: result.isMuted } : c),
      );
      // Seçili chat eyni conversation-dırsa, selectedChat-ı da yenilə
      if (selectedChat && selectedChat.id === conv.id) {
        setSelectedChat((prev) => ({ ...prev, isMuted: result.isMuted }));
      }
    } catch (err) {
      console.error("Failed to toggle mute:", err);
    }
  }

  // handleToggleReadLater — conversation-ı "sonra oxu" işarələ / sil
  async function handleToggleReadLater(conv) {
    try {
      const endpoint = conv.type === 1
        ? `/api/channels/${conv.id}/toggle-read-later`
        : `/api/conversations/${conv.id}/messages/toggle-read-later`;
      const result = await apiPost(endpoint);
      setConversations((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, isMarkedReadLater: result.isMarkedReadLater } : c),
      );
      // Seçili chat eyni conversation-dırsa, selectedChat-ı da yenilə
      if (selectedChat && selectedChat.id === conv.id) {
        setSelectedChat((prev) => ({ ...prev, isMarkedReadLater: result.isMarkedReadLater }));
      }
    } catch (err) {
      console.error("Failed to toggle read later:", err);
    }
  }

  // handleToggleHide — conversation-ı hide/unhide toggle et
  async function handleToggleHide(conv) {
    try {
      const endpoint = conv.type === 1
        ? `/api/channels/${conv.id}/hide`
        : `/api/conversations/${conv.id}/messages/hide`;
      const result = await apiPost(endpoint);

      if (result.isHidden) {
        // Gizlədildi — siyahıdan sil, sidebar bağla
        setConversations((prev) => prev.filter((c) => c.id !== conv.id));
        setSelectedChat((current) => {
          if (current && current.id === conv.id) {
            setMessages([]);
            return null;
          }
          return current;
        });
      } else {
        // Unhide olundu — isHidden bayrağını yenilə
        setConversations((prev) =>
          prev.map((c) => c.id === conv.id ? { ...c, isHidden: false } : c),
        );
        if (selectedChat && selectedChat.id === conv.id) {
          setSelectedChat((prev) => ({ ...prev, isHidden: false }));
        }
      }
    } catch (err) {
      console.error("Failed to toggle hide:", err);
    }
  }

  // handleLeaveChannel — channel-dan ayrıl
  const handleLeaveChannel = useCallback(async (conv) => {
    try {
      await apiPost(`/api/channels/${conv.id}/members/leave`);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (selectedChat && selectedChat.id === conv.id) {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to leave channel:", err);
    }
  }, [selectedChat]);

  // handleDeleteConversation — conversation/channel-ı sil
  const handleDeleteConversation = useCallback(async (conv) => {
    try {
      const endpoint = conv.type === 1
        ? `/api/channels/${conv.id}`
        : `/api/conversations/${conv.id}`;
      await apiDelete(endpoint);
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (selectedChat && selectedChat.id === conv.id) {
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }, [selectedChat]);

  // handleMessageTextChange — textarea onChange (mention detection ilə birlikdə)
  const handleMessageTextChange = useCallback((newText, caretPos) => {
    setMessageText(newText);
    markAllAsReadForCurrentChat();
    mention.detectMentionInText(newText, caretPos, () => { if (emojiOpen) setEmojiOpen(false); });
  }, [emojiOpen, mention, markAllAsReadForCurrentChat]);

  // handleInputResize — textarea böyüdükdə/kiçildikdə mesajları aşağı scroll et
  const handleInputResize = useCallback(() => {
    requestAnimationFrame(() => {
      const area = messagesAreaRef.current;
      if (area) area.scrollTop = area.scrollHeight;
    });
  }, []);

  // handleMentionClick — mesajdakı mention-a klik (conversation-a keçid)
  // Ref pattern — conversations dəyişəndə renderFlatItem yenidən yaranmasın
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const handleMentionClick = useCallback((m) => {
    if (m.isAll) {
      if (selectedChat?.type === 1) {
        sidebar.setShowSidebar(true);
        sidebar.setShowMembersPanel(true);
        sidebar.setMembersPanelDirect(true);
        sidebar.loadMembersPanelPage(selectedChat.id, 0, true);
      }
      return;
    }
    const convs = conversationsRef.current;
    const channelConv = convs.find((c) => c.type === 1 && c.id === m.userId);
    if (channelConv) { handleSelectChat(channelConv); return; }
    const existing = convs.find((c) => c.type === 0 && c.otherUserId === m.userId);
    if (existing) { handleSelectChat(existing); return; }
    const deptUser = convs.find((c) => c.type === 2 && (c.otherUserId === m.userId || c.userId === m.userId));
    if (deptUser) { handleSelectChat(deptUser); return; }
    // İstifadəçi conversationlist-də yoxdur — virtual DM yarat (type=2 pattern)
    // İlk mesaj göndəriləndə real conversation yaranacaq
    handleSelectChat({
      id: m.userId,
      type: 2,
      name: m.userFullName,
      otherUserId: m.userId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat]);

  // ─── Search panel handler-ləri (state useSearchPanel hook-unda) ──────────────

  const handleCloseSearch = useCallback(() => {
    search.resetSearch();
    if (!search.searchFromSidebar) sidebar.setShowSidebar(false);
  }, [search, sidebar]);

  const handleOpenSearch = useCallback(() => {
    if (search.showSearchPanel) { handleCloseSearch(); return; }
    search.setSearchFromSidebar(sidebar.showSidebar);
    sidebar.setShowSidebar(true);
    search.setShowSearchPanel(true);
    sidebar.setShowFavorites(false);
    sidebar.setShowAllLinks(false);
    sidebar.setShowFilesMedia(false);
    sidebar.setShowMembersPanel(false);
    sidebar.setMembersPanelDirect(false);
    sidebar.setShowChatsWithUser(false);
  }, [search, sidebar, handleCloseSearch]);

  // refreshChannelMembers, loadMembersPanelPage, handleMakeAdmin,
  // handleRemoveAdmin, handleRemoveFromChat → useChannelManagement hook-una çıxarılıb

  // handleOpenCreateChannel — pencil button klikləndikdə channel yaratma paneli açılır
  function handleOpenCreateChannel() {
    // Draft saxla
    if (selectedChat) {
      const currentText = messageText.trim();
      if (currentText) {
        draftsRef.current[selectedChat.id] = currentText;
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id ? { ...c, draft: currentText } : c,
          ),
        );
      }
    }
    setSelectedChat(null);
    setMessages([]);
    setMessageText("");
    channel.setShowCreateChannel(true);
  }

  // handleCancelCreateChannel — panel bağlanır
  function handleCancelCreateChannel() {
    channel.setShowCreateChannel(false);
    channel.setEditChannelData(null);
  }

  // handleEditChannel — sidebar Edit butonundan channel redaktə paneli açılır
  async function handleEditChannel() {
    if (!selectedChat || selectedChat.type !== 1) return;
    sidebar.setShowSidebarMenu(false);

    try {
      const details = await apiGet(`/api/channels/${selectedChat.id}`);
      const formattedMembers = (details.members || []).map((m) => ({
        id: m.userId,
        name: m.fullName,
        type: "user",
        isAdmin: m.role === 3 || m.role === "Owner",
        role: m.role,
      }));
      const typeStr =
        details.type === 1 || details.type === "Public" ? "public" : "private";

      channel.setEditChannelData({
        id: selectedChat.id,
        name: details.name,
        description: details.description || "",
        type: typeStr,
        avatarUrl: selectedChat.avatarUrl || null,
        members: formattedMembers,
      });

      sidebar.setShowSidebar(false);
      channel.setShowCreateChannel(true);
    } catch (err) {
      console.error("Failed to load channel data for editing:", err);
    }
  }

  // handleChannelCreated — channel uğurla yaradıldıqda çağırılır
  async function handleChannelCreated(channelData) {
    channel.setShowCreateChannel(false);

    // 2. Channel DTO-nu conversation formatına çevir
    // Backend ChannelType qaytarır (1=Public, 2=Private) — unified type deyil!
    // Unified type: 0=Conversation, 1=Channel, 2=DepartmentUser
    // Yaradılan şey həmişə channel-dir → type: 1
    const newConversation = {
      id: channelData.id,
      name: channelData.name,
      type: 1, // Unified type: Channel
      avatarUrl: channelData.avatarUrl,
      createdBy: channelData.createdBy,
      memberCount: channelData.memberCount,
      lastMessage: channelData.lastMessageContent,
      lastMessageAtUtc: channelData.lastMessageAtUtc,
      lastMessageSenderId: channelData.lastMessageSenderId,
      lastMessageSenderFullName: null,
      lastMessageSenderAvatarUrl: channelData.lastMessageSenderAvatarUrl,
      lastMessageStatus: channelData.lastMessageStatus,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isMarkedReadLater: false,
    };

    // 3. Conversation list-ə əlavə et (duplicate check)
    setConversations((prev) => {
      if (prev.some((c) => c.id === channelData.id)) return prev;
      return [newConversation, ...prev];
    });

    // 4. Yeni yaradılmış channeli seç
    handleSelectChat(newConversation);
  }

  // handleChannelUpdated — channel uğurla redaktə edildikdə çağırılır
  function handleChannelUpdated(updatedData) {
    channel.setShowCreateChannel(false);
    channel.setEditChannelData(null);
    setConversations((prev) =>
      prev.map((c) =>
        c.id === updatedData.id
          ? { ...c, name: updatedData.name, avatarUrl: updatedData.avatarUrl ?? c.avatarUrl }
          : c
      )
    );
    if (selectedChat && selectedChat.id === updatedData.id) {
      setSelectedChat((prev) => ({
        ...prev,
        name: updatedData.name,
        avatarUrl: updatedData.avatarUrl ?? prev.avatarUrl,
      }));
    }
    channel.refreshChannelMembers(updatedData.id);
  }

  // handleOpenChatsWithUser → useSidebarPanels hook-una çıxarılıb

  // handleInviteMembers → useChannelManagement hook-una çıxarılıb

  // handleSelectChat — istifadəçi sol siyahıdan bir chata klikləyəndə çağırılır
  // chat.type: 0 = DM Conversation, 1 = Channel, 2 = DepartmentUser
  async function handleSelectChat(chat) {
    // Eyni conversation-a yenidən klik → yalnız aşağıya scroll et, yenidən yükləmə
    if (selectedChat && selectedChat.id === chat.id) {
      setShouldScrollBottom(true);
      return;
    }

    // Stale request detection — hər yeni chat seçimində ID artır
    const requestId = ++chatRequestIdRef.current;

    // Hook state-lərini sıfırla
    channel.setShowCreateChannel(false);
    channel.setEditChannelData(null);
    search.resetSearch();
    mention.resetMention();

    // Draft saxla — əvvəlki chatın yazısını yadda saxla
    if (selectedChat) {
      const currentText = messageText.trim();
      if (currentText) {
        draftsRef.current[selectedChat.id] = currentText;
        // Conversation list-də draft göstər
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id ? { ...c, draft: currentText } : c,
          ),
        );
      } else {
        delete draftsRef.current[selectedChat.id];
        // Draft sil
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id ? { ...c, draft: null } : c,
          ),
        );
      }
    }

    // Əvvəlki chatda yazırdısa, dərhal dayandır
    stopTypingSignal();

    // Əvvəlki chatın gözləyən mark-as-read mesajlarını göndər
    flushReadBatch();

    // Yeni chatın draft-ını yüklə
    const savedDraft = draftsRef.current[chat.id] || "";
    setMessageText(savedDraft);

    // ── Cache SAVE — köhnə chatın mesajlarını cache-ə yaz ──
    // Optimistic mesajları cache-ə yazma — pending/uploading mesajlar cache-də qalmamalıdır
    const cacheableMessages = messages.filter((m) => !m._optimistic);
    if (selectedChat && cacheableMessages.length > 0) {
      messageCacheRef.current.set(selectedChat.id, {
        messages: cacheableMessages,
        pinnedMessages,
        favoriteMessages: sidebar.favoriteMessages,
        hasMore: hasMoreRef.current,
        hasMoreDown: hasMoreDownRef.current,
        firstItemIndex,
        timestamp: Date.now(),
      });
      // Cache limit — ən köhnə entry-ləri sil
      if (messageCacheRef.current.size > CACHE_MAX_SIZE) {
        const oldest = messageCacheRef.current.keys().next().value;
        messageCacheRef.current.delete(oldest);
      }
    }

    // ── Cache RESTORE — yeni chatın cache-i varsa dərhal göstər ──
    const cached = messageCacheRef.current.get(chat.id);
    const cacheValid = cached && (Date.now() - cached.timestamp < CACHE_TTL);
    // Around-mode cache keçərsizdir — getAround sonrası cache-də yalnız hədəf ətrafı
    // 30 mesaj var, son mesajlar yoxdur. Geri qayıtdıqda həmişə API-dən yüklə.
    const aroundModeCache = cacheValid && cached.hasMoreDown;
    const usableCache = cacheValid && !aroundModeCache;

    // State sıfırla — yeni chat seçildi
    setChatLoading(!usableCache); // Usable cache varsa loading göstərmə
    setSelectedChat(chat);
    setMessages(usableCache ? cached.messages : []);
    setPinnedMessages(usableCache ? cached.pinnedMessages : []);
    firstItemIndexRef.current = usableCache ? (cached.firstItemIndex || 100_000) : 100_000;
    prevFlatLenRef.current = 0; // flatItems length tracking sıfırla
    // Cache-dən yüklənəndə aşağıya scroll — Virtuoso key={selectedChat.id} remount +
    // initialTopMostItemIndex={senderRuns.length - 1} bunu avtomatik edir
    // unreadCount dərhal sıfırlanmır — IntersectionObserver mesajlar göründükcə 1-1 azaldır
    setPinBarExpanded(false);
    setCurrentPinIndex(0);
    sidebar.resetSidebarPanels();
    sidebar.resetChatsWithUser();
    channel.resetChannelState();
    resetSelection();
    setReplyTo(null);
    setEditMessage(null);
    setForwardMessage(null);
    setEmojiOpen(false);
    setReadersPanel(null);
    setImageViewer(null);
    setReadLaterMessageId(null); // Əvvəlki chatın read later mark-ını sıfırla
    setNewMessagesStartId(null); // Əvvəlki chatın new messages separator-ını sıfırla
    setShowScrollDown(false); // Əvvəlki chatın scroll-to-bottom butonunu sıfırla
    // newUnreadCount useMemo-dur, setMessages([]) ilə avtomatik 0 olur
    hasNewUnreadRef.current = false; // Əvvəlki chatın SignalR unread flag-ını sıfırla
    firstUnreadMsgIdRef.current = null; // Əvvəlki chatın ilk unread mesaj ID-sini sıfırla
    pendingScrollToUnreadRef.current = false; // Əvvəlki chatın pending scroll-unu sıfırla
    processedMsgIdsRef.current = new Set(); // Mark-as-read processed set-ini sıfırla
    // startReached guard — Virtuoso mount zamanı dərhal fire etməsin
    loadingMoreRef.current = true;
    setTimeout(() => { loadingMoreRef.current = false; }, 300);
    hasMoreRef.current = usableCache ? cached.hasMore : true;
    hasMoreDownRef.current = false; // Geri qayıtdıqda həmişə ən son mesajlardan başla
    // lastReadLaterMessageId varsa — around endpoint ilə yüklə, əks halda normal
    const hasReadLater = !!chat.lastReadLaterMessageId;

    // isMarkedReadLater varsa — daxil olduqda avtomatik unmark et
    if (chat.isMarkedReadLater) {
      const rlEndpoint = chat.type === 1
        ? `/api/channels/${chat.id}/toggle-read-later`
        : `/api/conversations/${chat.id}/messages/toggle-read-later`;
      apiPost(rlEndpoint).catch(() => {});
      setConversations((prev) =>
        prev.map((c) => c.id === chat.id ? { ...c, isMarkedReadLater: false } : c),
      );
    }

    // ── Cache HIT — API call-ları skip et, yalnız post-processing ──
    // readLater varsa cache-dən istifadə etmə — around endpoint lazımdır
    // Around-mode cache keçərsizdir — son mesajlar yoxdur, API-dən yüklə
    if (usableCache && !hasReadLater) {
      readBatchChatRef.current = { chatId: chat.id, chatType: String(chat.type) };
      const unread = chat.unreadCount || 0;
      allReadPatchRef.current = (unread === 0);
      initialMsgIdsRef.current = new Set(
        cached.messages.filter((m) => !m.isRead && m.senderId !== user?.id).map((m) => m.id),
      );
      // Favorites — cache-dən restore et
      if (cached.favoriteMessages) {
        sidebar.setFavoriteMessages(cached.favoriteMessages);
      }
      // Online status / channel members — fire-and-forget
      if (chat.type === 0 && chat.otherUserId) {
        const conn = getConnection();
        if (conn) {
          conn.invoke("GetOnlineStatus", [chat.otherUserId])
            .then((statusMap) => {
              if (statusMap?.[chat.otherUserId]) {
                setOnlineUsers((prev) => { const next = new Set(prev); next.add(chat.otherUserId); return next; });
              }
            })
            .catch(() => {});
        }
      } else if (chat.type === 1 && !channelMembers[chat.id]) {
        apiGet(`/api/channels/${chat.id}/members?take=100`)
          .then((members) => {
            setChannelMembers((prev) => ({
              ...prev,
              [chat.id]: members.reduce((map, m) => {
                map[m.userId] = { fullName: m.fullName, avatarUrl: m.avatarUrl, role: m.role };
                return map;
              }, {}),
            }));
          })
          .catch(() => {});
      }
      setTimeout(() => inputRef.current?.focus(), 0);
      setChatLoading(false);
      // Cache-dən yüklənəndə də aşağıya scroll et — initialTopMostItemIndex
      // mount zamanı item ölçüləri bilinmədiyi üçün etibarlı deyil
      setShouldScrollBottom(true);
      return;
    }

    try {
      const msgBase = getChatEndpoint(chat.id, chat.type, "/messages");
      if (!msgBase) return;
      const pinEndpoint = `${msgBase}/pinned`;

      const favEndpoint = `${msgBase}/favorites`;

      // Read later varsa around endpoint, yoxdursa normal endpoint
      const msgEndpoint = hasReadLater
        ? `${msgBase}/around/${chat.lastReadLaterMessageId}`
        : `${msgBase}?pageSize=${MESSAGE_PAGE_SIZE}`;

      // Promise.all — API çağrılarını paralel icra et (favorites daxil)
      const promises = [
        apiGet(msgEndpoint),
        apiGet(pinEndpoint).catch(() => []),
        apiGet(favEndpoint).catch(() => []),
      ];

      // Read later varsa: həm də DELETE read-later çağır (icon-u conversation list-dən sil)
      // + unread varsa: separator pozisiyası üçün ən son mesajları paralel yüklə
      if (hasReadLater) {
        const clearEndpoint = chat.type === 0
          ? `/api/conversations/${chat.id}/messages/read-later`
          : `/api/channels/${chat.id}/read-later`;
        promises.push(apiDelete(clearEndpoint).catch(() => {}));

        const unread = chat.unreadCount || 0;
        if (unread > 0) {
          // pageSize max 30 — çox olsa aşağıda əlavə səhifə yüklənəcək
          promises.push(
            apiGet(`${msgBase}?pageSize=${Math.min(unread, MESSAGE_PAGE_SIZE)}`).catch(() => null),
          );
        }
      }

      const [msgData, pinData, favData, , latestForSeparator] = await Promise.all(promises);

      // Stale response — istifadəçi artıq başqa conversation-a keçib
      if (requestId !== chatRequestIdRef.current) return;

      // Pinlənmiş mesajları DESC sırala
      const sortedPins = (pinData || []).sort(
        (a, b) => new Date(b.pinnedAtUtc) - new Date(a.pinnedAtUtc),
      );
      setPinnedMessages(sortedPins);

      // Favori mesajları set et
      const sortedFavs = (favData || []).sort(
        (a, b) => new Date(b.favoritedAtUtc) - new Date(a.favoritedAtUtc),
      );
      sidebar.setFavoriteMessages(sortedFavs);

      // ─── Separator üçün əlavə səhifə yüklə ─────────────────────────────────
      // unread > ilk yüklənmiş mesaj sayı → separator sərhədi hələ yüklənməyib
      // Before cursor ilə əlavə 1 səhifə yüklə (pageSize=30 dəyişmir)
      const unread = chat.unreadCount || 0;
      let finalMsgData = msgData || [];
      let finalLatestForSep = latestForSeparator;

      if (unread > MESSAGE_PAGE_SIZE) {
        // Normal mode — msgData-dan əlavə səhifə
        if (!hasReadLater && finalMsgData.length > 0 && unread > finalMsgData.length) {
          const oldest = finalMsgData[finalMsgData.length - 1];
          const beforeDate = oldest.createdAtUtc || oldest.sentAt;
          if (beforeDate) {
            try {
              const extra = await apiGet(
                `${msgBase}?pageSize=${MESSAGE_PAGE_SIZE}&before=${encodeURIComponent(beforeDate)}`,
              );
              if (extra && extra.length > 0) {
                const ids = new Set(finalMsgData.map((m) => m.id));
                finalMsgData = [...finalMsgData, ...extra.filter((m) => !ids.has(m.id))];
              }
            } catch (err) {
              console.error("Separator extra page failed:", err);
            }
          }
        }
        // ReadLater mode — latestForSeparator-dan əlavə səhifə
        if (hasReadLater && finalLatestForSep && finalLatestForSep.length > 0 && unread > finalLatestForSep.length) {
          const oldest = finalLatestForSep[finalLatestForSep.length - 1];
          const beforeDate = oldest.createdAtUtc || oldest.sentAt;
          if (beforeDate) {
            try {
              const extra = await apiGet(
                `${msgBase}?pageSize=${MESSAGE_PAGE_SIZE}&before=${encodeURIComponent(beforeDate)}`,
              );
              if (extra && extra.length > 0) {
                const ids = new Set(finalLatestForSep.map((m) => m.id));
                finalLatestForSep = [...finalLatestForSep, ...extra.filter((m) => !ids.has(m.id))];
              }
            } catch (err) {
              console.error("ReadLater separator extra page failed:", err);
            }
          }
        }
      }

      if (hasReadLater) {
        // Around mode — marked message ətrafında yüklə (highlight yox, unread qalmalıdır)
        setReadLaterMessageId(chat.lastReadLaterMessageId);
        hasMoreRef.current = true;
        hasMoreDownRef.current = true;
        firstItemIndexRef.current = 100_000; prevFlatLenRef.current = 0; // Around mode — reset
        setVirtuosoResetKey((k) => k + 1); // Virtuoso remount — height cache sıfırla
        pendingScrollToReadLaterRef.current = true; // Separator-a scroll et
        // lastReadLaterMessageId sil ki, növbəti dəfə açanda separator + ikon görünməsin
        setConversations((prev) =>
          prev.map((c) =>
            c.id === chat.id
              ? { ...c, lastReadLaterMessageId: null }
              : c,
          ),
        );
      } else {
        if (unread > 0) {
          // Unread mesaj var → separator-a scroll et (aşağıya deyil)
          pendingScrollToUnreadRef.current = true;
        } else {
          setShouldScrollBottom(true); // Unread yoxdur → ən aşağıya scroll et
        }
      }

      // "New messages" separator — ilk oxunmamış mesajın ID-sini tap
      if (hasReadLater && finalLatestForSep) {
        // Around mode — birinci unread mesajın ID-sini paralel yüklənmiş datadan al
        // finalLatestForSep: DESC (yeni→köhnə), index [unread-1] = ən köhnə unread
        if (finalLatestForSep.length >= unread) {
          setNewMessagesStartId(finalLatestForSep[unread - 1].id);
        } else {
          setNewMessagesStartId(null);
        }
      } else if (!hasReadLater && unread > 0 && finalMsgData.length > 0) {
        // Normal mode — finalMsgData ən son mesajlardır (DESC)
        if (unread <= finalMsgData.length) {
          // Separator düzgün yerdə — unread-inci mesajdan əvvəl
          setNewMessagesStartId(finalMsgData[unread - 1].id);
        } else {
          // Əlavə səhifədən sonra da kifayət deyil (çox nadir: unread > 60)
          // Separator göstərmə — ən aşağıya scroll
          setNewMessagesStartId(null);
        }
      } else {
        setNewMessagesStartId(null);
      }

      // ─── Mark-as-read strategiya ──────────────────────────────────────────────
      // unreadCount === 0 → backend hələ isRead:false qaytara bilir (xüsusilə channel-larda)
      // Bu halda patch et ki, IntersectionObserver lazımsız request göndərməsin
      // unreadCount > 0 → patch etmə, observer scroll ilə tək-tək mark edəcək (düzgün davranış)
      allReadPatchRef.current = (!hasReadLater && unread === 0);
      setMessages(
        allReadPatchRef.current
          ? finalMsgData.map((m) => m.isRead ? m : { ...m, isRead: true })
          : finalMsgData,
      );
      // CRITICAL: setChatLoading(false) burada olmalıdır (setMessages ilə eyni React batch-da)
      // Əks halda Virtuoso wrapper display:none olur → scrollToIndex/initialTopMostItemIndex işləmir
      setChatLoading(false);

      // ── Cache UPDATE — API-dən gələn fresh data ilə cache-i yenilə ──
      messageCacheRef.current.set(chat.id, {
        messages: allReadPatchRef.current
          ? finalMsgData.map((m) => m.isRead ? m : { ...m, isRead: true })
          : finalMsgData,
        pinnedMessages: sortedPins,
        favoriteMessages: sortedFavs,
        hasMore: hasMoreRef.current,
        hasMoreDown: hasMoreDownRef.current,
        firstItemIndex: 100_000, // Fresh API data — həmişə default
        timestamp: Date.now(),
      });

      readBatchChatRef.current = {
        chatId: chat.id,
        chatType: String(chat.type),
      };

      // İlkin mesaj ID-lərini yadda saxla — bu mesajlar scroll ilə görünəndə dərhal read olacaq
      // Yeni SignalR mesajları bu set-də olmayacaq → yazmağa/göndərməyə qədər unread qalacaq
      initialMsgIdsRef.current = new Set(
        finalMsgData.filter((m) => !m.isRead && m.senderId !== user?.id).map((m) => m.id),
      );

      // Yeni chatın SignalR qrupuna qoşul
      if (chat.type === 0) {
        // DM — digər istifadəçinin online status-unu SignalR hub-dan al
        // conn.invoke("GetOnlineStatus", [...]) — hub metodu çağır
        if (chat.otherUserId) {
          const conn = getConnection();
          if (conn) {
            try {
              // Hub metodu: GetOnlineStatus(List<string> userIds) → Dictionary<string,bool>
              const statusMap = await conn.invoke("GetOnlineStatus", [
                chat.otherUserId,
              ]);
              if (statusMap && statusMap[chat.otherUserId]) {
                // Functional update — prev state əsasında yeni Set yarat
                setOnlineUsers((prev) => {
                  const next = new Set(prev);
                  next.add(chat.otherUserId);
                  return next;
                });
              }
            } catch (err) {
              console.error("Failed to get online status:", err);
            }
          }
        }
      } else if (chat.type === 1) {
        // Channel members yüklə — status bar-da "Viewed by X" üçün
        if (!channelMembers[chat.id]) {
          try {
            const members = await apiGet(`/api/channels/${chat.id}/members?take=100`);
            setChannelMembers((prev) => ({
              ...prev,
              [chat.id]: members.reduce((map, m) => {
                map[m.userId] = { fullName: m.fullName, avatarUrl: m.avatarUrl, role: m.role };
                return map;
              }, {}),
            }));
          } catch (err) {
            console.error("Failed to load channel members:", err);
          }
        }
      }

      // setTimeout(..., 0) — bir sonraki event loop-da textarea-ya focus ver
      // Birbaşa çağırsaq, DOM hazır olmaya bilər
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      if (requestId !== chatRequestIdRef.current) return;
      console.error("Failed to load messages:", err);
      setMessages([]);
    } finally {
      // Yalnız cari request-in finally-si — loading catch block üçün sıfırla
      if (requestId === chatRequestIdRef.current) {
        setChatLoading(false); // Catch block üçün lazımdır — try-da artıq çağırılır
        setShowScrollDown(false);
      }
    }
  }

  // handleForward — ForwardPanel-dan chat seçilib, mesajı ora göndər
  async function handleForward(targetChat) {
    if (!forwardMessage) return;

    const fwd = forwardMessage;
    // Optimistic close — API cavabını gözləmədən paneli bağla (sürətli UI)
    setForwardMessage(null);

    try {
      // Yeni user və ya DepartmentUser (conversation yoxdur) → əvvəlcə conversation yarat
      let chatId = targetChat.id;
      let chatType = targetChat.type;
      if (targetChat.isNewUser || targetChat.type === 2) {
        const result = await apiPost("/api/conversations", {
          otherUserId: targetChat.otherUserId || targetChat.userId,
        });
        chatId = result.conversationId;
        chatType = 0;
      }

      const endpoint = getChatEndpoint(chatId, chatType, "/messages");
      if (!endpoint) return;

      if (fwd.isMultiSelect) {
        // Çoxlu mesaj forward — seçilmiş hər mesajı ardıcıl göndər
        const allMessages = [...messages].reverse(); // chronological order (köhnə → yeni)
        const selectedMsgs = allMessages.filter((m) => fwd.ids.includes(m.id));
        for (const m of selectedMsgs) {
          await apiPost(endpoint, {
            content: m.content || "",
            fileId: m.fileId || null,
            isForwarded: true,
            ...(m.mentions?.length > 0 ? { mentions: m.mentions } : {}),
          });
        }
        handleExitSelectMode(); // Select mode-dan çıx
      } else {
        // Tək mesaj forward — fileId varsa onu da göndər, mention varsa qoru
        await apiPost(endpoint, {
          content: fwd.content || "",
          fileId: fwd.fileId || null,
          isForwarded: true,
          ...(fwd.mentions?.length > 0 ? { mentions: fwd.mentions } : {}),
        });
      }

      // Söhbət siyahısını yenilə (son mesaj dəyişdi)
      loadConversations();

      // Əgər forward edilən chat hazırda açıqdırsa, mesajları da yenilə
      if (selectedChat && selectedChat.id === chatId) {
        const data = await apiGet(
          `${getChatEndpoint(selectedChat.id, selectedChat.type, "/messages")}?pageSize=${MESSAGE_PAGE_SIZE}`,
        );
        hasMoreDownRef.current = false;
        setShouldScrollBottom(true);
        setMessages((prev) => {
          const prevMap = new Map(prev.map(m => [m.id, m]));
          return data.map((m) => mergeMessageWithPrev(m, prevMap.get(m.id)));
        });
      }
    } catch (err) {
      console.error("Failed to forward message:", err);
      showToast("Failed to forward message", "error");
    }
  }

  // handlePinMessage — mesajı pin/unpin et
  // useCallback — selectedChat dəyişmədikdə eyni funksiya referansı saxla
  // Bu sayədə MessageBubble yenidən render olmur (React.memo ilə birlikdə)
  const handlePinMessage = useCallback(
    async (msg) => {
      if (!selectedChat) return;
      const endpoint = getChatEndpoint(
        selectedChat.id,
        selectedChat.type,
        `/messages/${msg.id}/pin`,
      );
      if (!endpoint) return;

      const newIsPinned = !msg.isPinned;
      // Optimistic — dərhal göstər
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, isPinned: newIsPinned } : m,
        ),
      );

      try {
        if (msg.isPinned) {
          await apiDelete(endpoint);
        } else {
          await apiPost(endpoint);
        }
        // Server-dən pinned siyahısını yenilə
        loadPinnedMessages(selectedChat);
      } catch (err) {
        console.error("Failed to pin/unpin message:", err);
        // Revert
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, isPinned: msg.isPinned } : m,
          ),
        );
        showToast("Pin əməliyyatı uğursuz oldu", "error");
      }
    },
    [selectedChat, showToast, loadPinnedMessages],
  );

  // handleFavoriteMessage, handleRemoveFavorite → useSidebarPanels hook-una çıxarılıb

  // handleMarkLater — mesajı "sonra oxu" olaraq işarələ / işarəni sil (toggle)
  // Backend toggle məntiqi: eyni mesaj → sil, fərqli mesaj → köhnəni sil + yenisini qoy
  const handleMarkLater = useCallback(
    async (msg) => {
      if (!selectedChat) return;
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/${msg.id}/mark-later/toggle`,
        );
        if (!endpoint) return;
        await apiPost(endpoint);

        // Toggle məntiqi: eyni mesaj seçilibsə → sil, fərqli mesaj → yenilə
        const isToggleOff = readLaterMessageId === msg.id;
        setReadLaterMessageId(isToggleOff ? null : msg.id);

        // Conversation list-dəki lastReadLaterMessageId yenilə (mesaj səviyyəsində)
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id
              ? { ...c, lastReadLaterMessageId: isToggleOff ? null : msg.id }
              : c,
          ),
        );
      } catch (err) {
        console.error("Failed to toggle mark later:", err);
      }
    },
    [selectedChat, readLaterMessageId],
  );

  // Select mode handlers → useMessageSelection hook-una çıxarılıb

  // handleForwardSelected — seçilmiş mesajları forward et (Chat.jsx-də qalır — setForwardMessage lazımdır)
  const handleForwardSelected = useCallback(() => {
    if (selectedMessages.size === 0) return;
    setForwardMessage({ isMultiSelect: true, ids: [...selectedMessages] });
  }, [selectedMessages]);

  // handleDeleteMessage — tək mesajı sil (action menu-dan çağırılır)
  // Backend hardDeleted flag qaytarır:
  //   hardDeleted=true  → heç kim oxumayıb, mesaj tamamilə silinir (UI-dan yox olur)
  //   hardDeleted=false → kimsə oxuyub, soft delete (UI-da "This message was deleted." göstərilir)
  const handleDeleteMessage = useCallback(
    async (msg) => {
      if (!selectedChat) return;
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/${msg.id}`,
        );
        if (!endpoint) return;
        const res = await apiDelete(endpoint);

        if (res?.hardDeleted) {
          // Hard delete — mesajı sil + conversation list-i qalan mesajlara görə yenilə
          setMessages((prev) => {
            const remaining = prev.filter((m) => m.id !== msg.id);
            const lastRemaining = remaining[remaining.length - 1];
            // Conversation list — son mesaj bu idisə qalan mesaja görə yenilə
            setConversations((prevConvs) =>
              prevConvs.map((c) => {
                if (c.id !== selectedChat.id || c._lastProcessedMsgId !== msg.id) return c;
                if (lastRemaining) {
                  return {
                    ...c,
                    lastMessage: lastRemaining.content || "",
                    lastMessageAtUtc: lastRemaining.createdAtUtc,
                    _lastProcessedMsgId: lastRemaining.id,
                  };
                }
                return { ...c, lastMessage: "", lastMessageAtUtc: null, _lastProcessedMsgId: null };
              }),
            );
            return remaining;
          });
        } else {
          // Soft delete — kimsə oxuyub, isDeleted: true et
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, isDeleted: true } : m)),
          );
          // Conversation list — son mesaj idisə preview yenilə
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== selectedChat.id) return c;
              if (c._lastProcessedMsgId === msg.id) {
                return { ...c, lastMessage: "This message was deleted." };
              }
              return c;
            }),
          );
        }
      } catch (err) {
        console.error("Failed to delete message:", err);
      }
    },
    [selectedChat],
  );

  // handleDeleteMsgAction — delete düyməsinə basıldıqda:
  //   status < 3 (oxunmayıb) → təsdiqlənmə olmadan birbaşa sil
  //   status >= 3 (oxunub)   → təsdiqlənmə modalı göstər
  const handleDeleteMsgAction = useCallback(
    (msg) => {
      if (msg.status < 3) {
        handleDeleteMessage(msg);
        return;
      }
      setPendingDeleteMsg(msg);
    },
    [handleDeleteMessage],
  );

  // handleDeleteSelected → useMessageSelection hook-una çıxarılıb

  // handleFilesSelected, handleRemoveFile, handleReorderFiles, handleClearFiles → useFileUpload hook-una çıxarılıb

  // handleSendFiles — faylları optimistic UI ilə göndər
  // FilePreviewPanel dərhal bağlanır, upload chat bubble-da progress ilə görünür
  async function handleSendFiles(text) {
    if (!selectedChat || fileUpload.selectedFiles.length === 0) return;

    // 1. Data-nı capture et (state sıfırlanmadan əvvəl)
    const files = [...fileUpload.selectedFiles];
    const currentReply = replyTo;
    const mentionsToSend = mention.prepareMentionsForSend(text, selectedChat.type);

    let chatId = selectedChat.id;
    let chatType = selectedChat.type;

    // DepartmentUser (type=2) → əvvəlcə conversation yarat
    if (chatType === 2) {
      try {
        const result = await apiPost("/api/conversations", {
          otherUserId: selectedChat.id,
        });
        chatId = result.conversationId;
        chatType = 0;
        const updatedChat = { ...selectedChat, id: chatId, type: 0, otherUserId: selectedChat.id };
        setSelectedChat(updatedChat);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id && c.type === 2
              ? { ...c, id: chatId, type: 0, otherUserId: selectedChat.id }
              : c,
          ),
        );
      } catch (err) {
        console.error("Failed to create conversation:", err);
        showToast("Söhbət yaradıla bilmədi", "error");
        return;
      }
    }

    // 2. FilePreviewPanel DƏRHAL bağla — istifadəçi gözləməsin
    fileUpload.handleClearFiles();
    setReplyTo(null);
    setMessageText("");
    const savedH2 = localStorage.getItem("chatInputHeight");
    if (inputRef.current) inputRef.current.style.height = savedH2 ? savedH2 + "px" : "auto";
    const mirror2 = document.querySelector(".message-input-mirror");
    if (mirror2) mirror2.style.height = savedH2 ? savedH2 + "px" : "auto";

    // 3. ConversationList-də dərhal göstər + başa gətir
    const now = new Date().toISOString();
    const firstFileName = files[0]?.name || "Fayl";
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === chatId
          ? {
              ...c,
              lastMessage: text || `📎 ${firstFileName}`,
              lastMessageAtUtc: now,
              lastMessageSenderId: user.id,
              lastMessageStatus: "Pending",
            }
          : c,
      );
      const idx = updated.findIndex((c) => c.id === chatId);
      if (idx > 0) {
        const [item] = updated.splice(idx, 1);
        updated.unshift(item);
      }
      return updated;
    });

    // 4. Upload manager-ə ver — await et ki, upload task yaransın, sonra scroll et
    await uploadManager.startUpload(files, chatId, chatType, text, currentReply, mentionsToSend);

    // 5. Aşağı scroll et — upload task artıq messagesWithUploads-dadır
    setShouldScrollBottom(true);
  }

  // handleSendMessage — mesaj göndər (Enter / Send button)
  async function handleSendMessage() {
    // Fayllar seçilibsə → FilePreviewPanel açılır, oradan göndərilir
    if (fileUpload.selectedFiles.length > 0) {
      handleSendFiles(messageText.trim());
      return;
    }

    if (!selectedChat) return;

    // Boş mesaj göndərmə — yalnız yeni mesaj üçün (edit modunda boş text icazəlidir)
    if (!messageText.trim() && !editMessage) return;

    const text = messageText.trim();
    // Mesaj göndərəndə bütün unread mesajları oxundu et
    markAllAsReadForCurrentChat();
    // Typing siqnalını dərhal dayandır — mesaj göndərilib
    stopTypingSignal();
    setMessageText(""); // Yazma sahəsini dərhal sıfırla (UI cavabdehliyi)

    // Draft sil — mesaj göndərildi
    if (selectedChat) {
      delete draftsRef.current[selectedChat.id];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedChat.id ? { ...c, draft: null } : c,
        ),
      );
    }

    // Textarea + mirror hündürlüyünü saxlanılmış ölçüyə qaytar (və ya default 71px)
    // Overflow hidden — boş textarea-da scroll lazım deyil
    const savedH = localStorage.getItem("chatInputHeight");
    const resetH = savedH ? savedH + "px" : "71px";
    if (inputRef.current) {
      inputRef.current.style.height = resetH;
      inputRef.current.style.overflow = "hidden";
    }
    const mirror = document.querySelector(".message-input-mirror");
    if (mirror) {
      mirror.style.height = resetH;
      mirror.style.overflow = "hidden";
    }

    // --- EDIT MODE ---
    if (editMessage) {
      const editingMsg = editMessage;
      setEditMessage(null); // Edit mode-dan çıx

      // Boş text + fayl yoxdur → mesajı tamamilə sil
      if (!text && !editingMsg.fileUrl) {
        handleDeleteMessage(editingMsg);
        return;
      }

      // Text var VEYA fayl var → edit (boş text faylı olan mesajda texti silir)
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/${editingMsg.id}`,
        );
        // PUT /api/conversations/{id}/messages/{msgId} — mesajı redaktə et
        await apiPut(endpoint, { newContent: text });

        // Optimistic UI — API cavabı gözləmədən state-i güncəllə
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id === editingMsg.id) {
              // Mesajın content-ini, isEdited və editedAtUtc-ni yenilə
              return {
                ...m,
                content: text,
                isEdited: true,
                editedAtUtc: new Date().toISOString(),
              };
            }
            // Bu mesajı reply etmiş mesajların preview-unu da yenilə
            if (m.replyToMessageId === editingMsg.id) {
              return { ...m, replyToContent: text };
            }
            return m;
          }),
        );
      } catch (err) {
        console.error("Failed to edit message:", err);
      }
      return; // Edit-dən sonra normal send etmə
    }

    // Reply state-i saxla (optimistic mesaj üçün lazımdır), sonra sıfırla
    const currentReply = replyTo;
    setReplyTo(null);

    // Mentions-ı hazırla (activeMentionsRef sıfırlanır, ona görə API göndərmədən əvvəl saxla)
    const mentionsForSend = mention.prepareMentionsForSend(text, selectedChat.type);

    // ── Optimistic UI: mesajı dərhal göstər, status=Pending ──
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const optimisticMsg = {
      id: tempId,
      content: text,
      senderId: user.id,
      senderFullName: user.fullName,
      createdAtUtc: now,
      isRead: true,
      isEdited: false,
      isDeleted: false,
      isPinned: false,
      status: 0, // Pending — saat ikonu göstərilir
      reactions: [],
      fileUrl: null,
      replyToMessageId: currentReply ? currentReply.id : null,
      replyToContent: currentReply ? currentReply.content : null,
      replyToSenderName: currentReply ? currentReply.senderFullName : null,
      mentions: mentionsForSend, // Mention highlight dərhal görünsün
      _optimistic: true, // Flag — SignalR echo gəldikdə silmək üçün
      _stableKey: tempId, // Virtuoso key — echo gəldikdə key dəyişməsin, remount olmasın
    };

    // Mesajı dərhal UI-da göstər (newest-first: əvvələ əlavə et)
    setMessages((prev) => [optimisticMsg, ...prev]);
    // Yalnız istifadəçi yuxarıda olanda programmatic scroll et.
    // Aşağıdadırsa Virtuoso followOutput="auto" özü smooth scroll edir.
    // İkisini eyni anda çağırsaq bir-biriylə "döyüşür" → sıçrayış.
    if (showScrollDownRef.current) {
      setShouldScrollBottom(true);
    }

    // Cache invalidasiya — mesaj göndərildikdə cache köhnəlir
    messageCacheRef.current.delete(selectedChat.id);

    // ConversationList-də dərhal Pending statusla göstər + başa gətir
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === selectedChat.id
          ? {
              ...c,
              lastMessage: text,
              lastMessageAtUtc: now,
              lastMessageSenderId: user.id,
              lastMessageStatus: "Pending",
            }
          : c,
      );
      // Mesaj göndərilən conversation-ı siyahının başına gətir
      const idx = updated.findIndex((c) => c.id === selectedChat.id);
      if (idx > 0) {
        const [item] = updated.splice(idx, 1);
        updated.unshift(item);
      }
      return updated;
    });

    try {
      let chatId = selectedChat.id;
      let chatType = selectedChat.type;

      // ── DepartmentUser (type=2): əvvəlcə conversation yarat ──
      if (chatType === 2) {
        const result = await apiPost("/api/conversations", {
          otherUserId: selectedChat.id,
        });

        chatId = result.conversationId;
        chatType = 0;

        const updatedChat = {
          ...selectedChat,
          id: chatId,
          type: 0,
          otherUserId: selectedChat.id,
        };
        setSelectedChat(updatedChat);

        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id && c.type === 2
              ? { ...c, id: chatId, type: 0, otherUserId: selectedChat.id }
              : c,
          ),
        );
      }

      const endpoint = getChatEndpoint(chatId, chatType, "/messages");
      if (!endpoint) return;

      // POST — mesaj göndər (mentionsForSend yuxarıda hazırlanıb)
      await apiPost(endpoint, {
        content: text,
        replyToMessageId: currentReply ? currentReply.id : null,
        ...(mentionsForSend.length > 0 ? { mentions: mentionsForSend } : {}),
      });

      // ── API uğurlu → optimistic mesajın statusunu Sent (1) et + _optimistic sil ──
      // _optimistic silinir ki, react/more butonları dərhal görünsün (SignalR echo gözləmədən)
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 1, _optimistic: false } : m)),
      );

      // ConversationList-də statusu Sent et
      setConversations((prev) =>
        prev.map((c) =>
          c.id === chatId && c.lastMessageStatus === "Pending"
            ? { ...c, lastMessageStatus: "Sent" }
            : c,
        ),
      );

      // Hidden conversation — siyahıda yoxdursa əlavə et
      setConversations((prev) => {
        const existsInList = prev.some((c) => c.id === chatId);
        if (!existsInList) {
          const newConv = {
            id: chatId,
            name: selectedChat.name,
            type: chatType,
            avatarUrl: selectedChat.avatarUrl,
            otherUserId: selectedChat.otherUserId,
            otherUserPosition: selectedChat.otherUserPosition,
            lastMessage: text,
            lastMessageAtUtc: now,
            lastMessageSenderId: user.id,
            lastMessageStatus: "Sent",
            unreadCount: 0,
          };
          return [newConv, ...prev];
        }
        return prev;
      });
    } catch (err) {
      console.error("Failed to send message:", err);
      // Optimistic mesajı sil — göndərilə bilmədi
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      // ConversationList-dəki Pending statusu geri qaytar
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedChat.id && c.lastMessageStatus === "Pending"
            ? { ...c, lastMessageStatus: null }
            : c,
        ),
      );
      showToast("Failed to send message", "error");
    }
  }

  // handleSendMessage ref — handleKeyDown useCallback-ında stale closure-dan qoruyur
  handleSendMessageRef.current = handleSendMessage;

  // ─── Birləşdirilmiş click-outside handler ───
  // 7 ayrı useEffect əvəzinə tək event listener — daha az memory, daha az GC
  useEffect(() => {
    const anyOpen = emojiOpen || sidebar.showSidebarMenu || sidebar.favMenuId || sidebar.linksMenuId || sidebar.filesMenuId || sidebar.memberMenuId || channel.showAddMember;
    if (!anyOpen) return;

    function handleClickOutside(e) {
      // Emoji panel — .emoji-btn istisnası (toggle üçün)
      if (emojiOpen && emojiPanelRef.current && !emojiPanelRef.current.contains(e.target) && !e.target.closest(".emoji-btn")) {
        setEmojiOpen(false);
      }
      // Sidebar more menu
      if (sidebar.showSidebarMenu && sidebar.sidebarMenuRef.current && !sidebar.sidebarMenuRef.current.contains(e.target)) {
        sidebar.setShowSidebarMenu(false);
      }
      // Favorite mesaj more menu
      if (sidebar.favMenuId && sidebar.favMenuRef.current && !sidebar.favMenuRef.current.contains(e.target)) {
        sidebar.setFavMenuId(null);
      }
      // Links more menu
      if (sidebar.linksMenuId && sidebar.linksMenuRef.current && !sidebar.linksMenuRef.current.contains(e.target)) {
        sidebar.setLinksMenuId(null);
      }
      // Files more menu
      if (sidebar.filesMenuId && sidebar.filesMenuRef.current && !sidebar.filesMenuRef.current.contains(e.target)) {
        sidebar.setFilesMenuId(null);
      }
      // Member context menu
      if (sidebar.memberMenuId && sidebar.memberMenuRef.current && !sidebar.memberMenuRef.current.contains(e.target)) {
        sidebar.setMemberMenuId(null);
      }
      // Add member panel — əlavə state sıfırlama
      if (channel.showAddMember && channel.addMemberRef.current && !channel.addMemberRef.current.contains(e.target)) {
        channel.setShowAddMember(false);
        channel.setAddMemberSearch("");
        channel.setAddMemberSearchActive(false);
        channel.setAddMemberSelected(new Set());
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emojiOpen, sidebar.showSidebarMenu, sidebar.favMenuId, sidebar.linksMenuId, sidebar.filesMenuId, sidebar.memberMenuId, channel.showAddMember]);

  // Add member effects → useChannelManagement hook-una çıxarılıb
  // Sidebar açılanda channel members yüklə → useSidebarPanels hook-una çıxarılıb

  // Mention search + click-outside effect-ləri → useMention hook-una çıxarılıb

  // stopTypingSignal — typing siqnalını dərhal dayandır
  // Mesaj göndəriləndə / conversation dəyişdirildikdə çağırılır
  const stopTypingSignal = useCallback(() => {
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (!selectedChat || selectedChat.type === 2 || selectedChat.isNotes) return;
    const conn = getConnection();
    if (!conn) return;
    if (selectedChat.type === 0) {
      conn.invoke("TypingInConversation", selectedChat.id, selectedChat.otherUserId, false);
    } else if (selectedChat.type === 1) {
      conn.invoke("TypingInChannel", selectedChat.id, false);
    }
  }, [selectedChat]);

  // sendTypingSignal — istifadəçi yazarkən SignalR hub-a "typing" siqnalı göndər
  const sendTypingSignal = useCallback(() => {
    if (!selectedChat || selectedChat.type === 2 || selectedChat.isNotes) return;
    const conn = getConnection();
    if (!conn) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (selectedChat.type === 0) {
        conn.invoke("TypingInConversation", selectedChat.id, selectedChat.otherUserId, true);
      } else if (selectedChat.type === 1) {
        conn.invoke("TypingInChannel", selectedChat.id, true);
      }
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingSignal();
    }, TYPING_DEBOUNCE_MS);
  }, [selectedChat, stopTypingSignal]);

  // handleScrollToMessage — mesaja scroll et (reply reference / pin bar klik)
  // Mesaj senderRuns-da varsa scrollToIndex, yoxdursa around endpoint-dən yüklə
  // QEYD: flatItemsMetadataRef istifadə olunur (birbaşa flatItemsMetadata yox) —
  // əks halda hər mesaj dəyişikliğində callback yenilənir → renderFlatItem yenilənir →
  // bütün MessageBubble-lar yenidən render olur (flash effekti)
  const handleScrollToMessage = useCallback(
    async (messageId) => {
      if (!selectedChat) return;

      // senderRuns-da bu mesaj varmı? (virtual list-də render olunmaya bilər amma data-da var)
      const targetIndex = flatItemsMetadataRef.current.msgIdToIndex.get(messageId);
      if (targetIndex !== undefined) {
        // Var — scrollToIndex ilə scroll et + highlight (DATA ARRAY INDEX istifadə olunur)
        virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: "center", behavior: "auto" });
        // Render-dən sonra highlight et (Virtuoso scroll bitsin)
        setTimeout(() => {
          const target = messagesAreaRef.current?.querySelector(`[data-bubble-id="${messageId}"]`);
          if (target) {
            if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
            // Eyni mesaja təkrar klik — animasiya yenidən başlamalıdır.
            // Class sil → 1 frame gözlə → class əlavə et → animation restart garantiya olunur.
            target.classList.remove("highlight-message");
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                target.classList.add("highlight-message");
                highlightTimerRef.current = setTimeout(() => {
                  target.classList.remove("highlight-message");
                  highlightTimerRef.current = null;
                }, HIGHLIGHT_DURATION_MS);
              });
            });
          }
        }, 300);
        return;
      }

      // Yoxdur — around endpoint ilə həmin mesajın ətrafındakı mesajları yüklə
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/around/${messageId}`,
        );
        if (!endpoint) return;

        const data = await apiGet(endpoint);
        hasMoreRef.current = true;
        hasMoreDownRef.current = true;
        // startReached guard — around data yüklənəndə Virtuoso dərhal fire etməsin
        loadingMoreRef.current = true;
        setTimeout(() => { loadingMoreRef.current = false; }, 300);

        pendingHighlightRef.current = messageId;
        setMessages(data);
        firstItemIndexRef.current = 100_000; prevFlatLenRef.current = 0; // Fresh data — reset
        setVirtuosoResetKey((k) => k + 1); // Virtuoso remount — height cache sıfırla
      } catch (err) {
        console.error("Failed to load messages around target:", err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedChat],
  );

  // handlePinBarClick — PinnedBar-a klik edildikdə
  const handlePinBarClick = useCallback((messageId) => {
    handleScrollToMessage(messageId);
    setCurrentPinIndex((prev) =>
      prev >= pinnedMessages.length - 1 ? 0 : prev + 1,
    );
  }, [handleScrollToMessage, pinnedMessages.length]);

  // handleKeyDown — textarea-da klaviatura hadisəsi
  // Enter → mesaj göndər (Shift+Enter → yeni sətir)
  const handleKeyDown = useCallback((e) => {
    if (mention.handleMentionKeyDown(e)) return;

    if (e.ctrlKey || e.altKey || e.metaKey) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessageRef.current();
      }
      return;
    }
    if (e.key === "Shift" || e.key === "CapsLock") return;

    sendTypingSignal();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessageRef.current();
    }
  }, [mention, sendTypingSignal]);

  // --- CONFIRM DIALOG useCallback HANDLERS ---

  const handleConfirmDeleteMsg = useCallback(() => {
    handleDeleteMessage(pendingDeleteMsg);
    setPendingDeleteMsg(null);
  }, [handleDeleteMessage, pendingDeleteMsg]);

  const handleCancelDeleteMsg = useCallback(() => setPendingDeleteMsg(null), []);

  const handleConfirmLeaveChannel = useCallback(() => {
    handleLeaveChannel(pendingLeaveChannel);
    setPendingLeaveChannel(null);
    sidebar.setShowSidebar(false);
  }, [handleLeaveChannel, pendingLeaveChannel, sidebar]);

  const handleCancelLeaveChannel = useCallback(() => setPendingLeaveChannel(null), []);

  const handleConfirmDeleteConv = useCallback(() => {
    handleDeleteConversation(pendingDeleteConv);
    setPendingDeleteConv(null);
    sidebar.setShowSidebar(false);
  }, [handleDeleteConversation, pendingDeleteConv, sidebar]);

  const handleCancelDeleteConv = useCallback(() => setPendingDeleteConv(null), []);

  const handleCloseForward = useCallback(() => setForwardMessage(null), []);

  // onFindChatsWithUser — DetailSidebar prop
  const handleFindChatsWithUser = useCallback((otherUserId) => {
    sidebar.setShowSidebar(true);
    sidebar.handleOpenChatsWithUser(otherUserId, "context");
  }, [sidebar]);

  // AddMember close/cancel handler (eyni handler — 2 yerdə istifadə olunur)
  const handleCloseAddMember = useCallback(() => {
    channel.setShowAddMember(false);
    channel.setAddMemberSearch("");
    channel.setAddMemberSearchActive(false);
    channel.setAddMemberSelected(new Set());
  }, [channel]);

  // AddMember chip remove handler (loop daxilində)
  const handleRemoveAddMemberChip = useCallback((uid) => {
    channel.setAddMemberSelected((prev) => { const next = new Set(prev); next.delete(uid); return next; });
  }, [channel]);

  // AddMember user select/toggle handler (loop daxilində)
  const handleToggleAddMemberUser = useCallback((userId) => {
    channel.setAddMemberSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
    channel.setAddMemberSearch("");
    channel.setAddMemberSearchActive(false);
    channel.setAddMemberSearchResults([]);
  }, [channel]);

  // AddMember filtered users — useMemo (hər render-də Set+filter əvəzinə)
  const addMemberFilteredUsers = useMemo(() => {
    if (!channel.showAddMember) return [];
    const query = channel.addMemberSearch.trim();
    const existingIds = channelMembers[selectedChat?.id]
      ? new Set(Object.keys(channelMembers[selectedChat.id]))
      : new Set();
    if (query.length >= 2) {
      return channel.addMemberSearchResults
        .filter((u) => !existingIds.has(u.id))
        .map((u) => ({
          id: u.id,
          fullName: u.fullName || `${u.firstName} ${u.lastName}`,
          avatarUrl: u.avatarUrl,
          position: u.position || "User",
        }));
    }
    return channel.addMemberUsers;
  }, [channel.showAddMember, channel.addMemberSearch, channel.addMemberSearchResults, channel.addMemberUsers, channelMembers, selectedChat?.id]);

  // AddMember chip lookup — useMemo (O(n²) → O(1) Map lookup)
  const addMemberChipMap = useMemo(() => {
    if (!channel.showAddMember || channel.addMemberSelected.size === 0) return new Map();
    const map = new Map();
    for (const u of channel.addMemberUsers) map.set(u.id, u.fullName || u.name || "User");
    for (const c of conversations) {
      if (c.otherUserId && !map.has(c.otherUserId)) map.set(c.otherUserId, c.name || "User");
    }
    return map;
  }, [channel.showAddMember, channel.addMemberSelected.size, channel.addMemberUsers, conversations]);

  // --- MEMOIZED DƏYƏRLƏR ---

  // newUnreadCount — scroll-to-bottom badge üçün oxunmamış mesaj sayı
  // Observer read etdiyi mesajlar isRead:true olur → count-dan çıxır
  // Yeni SignalR mesajları isRead:false qalır → count artır
  const newUnreadCount = useMemo(
    () => messages.filter((m) => !m.isRead && m.senderId !== user?.id).length,
    [messages, user?.id],
  );

  // (prevSenderRunsLenRef silinib — scroll restore useLayoutEffect ilə əvəz edildi)

  // hasOthersSelected → useMessageSelection hook-unda (destructured)
  // favoriteIds, linkMessages, fileMessages → useSidebarPanels hook-unda (sidebar.*)

  // imageMessages — yalnız şəkillər, xronoloji sıra (köhnə → yeni, thumbnail strip üçün)
  const imageMessages = useMemo(() => {
    return sidebar.fileMessages.filter(f => f.isImage).reverse();
  }, [sidebar.fileMessages]);

  // handleOpenImageViewer — MessageBubble-dan çağırılır, şəkil klikləndikdə
  // Ref pattern — imageMessages dəyişəndə renderFlatItem yenidən yaranmasın
  const imageMessagesRef = useRef(imageMessages);
  imageMessagesRef.current = imageMessages;
  const handleOpenImageViewer = useCallback((msgId) => {
    const idx = imageMessagesRef.current.findIndex(img => img.id === msgId);
    if (idx === -1) return;
    setImageViewer({ currentIndex: idx });
  }, []);

  const handleImageViewerNavigate = useCallback((newIndex) => {
    setImageViewer(prev => prev ? { ...prev, currentIndex: newIndex } : null);
  }, []);

  const handleCloseImageViewer = useCallback(() => {
    setImageViewer(null);
  }, []);

  // addMemberUsers → useChannelManagement hook-unda (channel.addMemberUsers)

  // --- STABLE CALLBACK-LƏR ---
  // useCallback([]) — dependency yoxdur, funksiya referansı sabit qalır
  // React.memo ilə birlikdə MessageBubble-ın lazımsız yenidən render-inin qarşısını alır
  // .NET ekvivalenti: static method reference saxlamaq kimi

  const handleReply = useCallback((m) => {
    setReplyTo(m);
    setTimeout(() => inputRef.current?.focus(), 0); // Focus textarea-ya
  }, []);

  const handleForwardMsg = useCallback((m) => {
    setForwardMessage(m); // ForwardPanel-i aç
  }, []);

  const handleEditMsg = useCallback((m) => {
    setEditMessage(m); // Edit mode-a gir
    setReplyTo(null); // Reply-ı ləğv et
    setMessageText(m.content); // Məzmunu textarea-ya qoy
    // Focus + cursor-u mətinin SONUNA qoy (əvvəlinə yox)
    setTimeout(() => {
      const ta = inputRef.current;
      if (!ta) return;
      ta.focus();
      const len = m.content?.length || 0;
      ta.selectionStart = len;
      ta.selectionEnd = len;
    }, 0);
  }, []);

  // handleReaction — mesaja emoji reaksiyası əlavə et / ləğv et (Optimistic UI)
  const handleReaction = useCallback(
    async (msg, emoji) => {
      if (!selectedChat) return;
      const endpoint = getChatEndpoint(
        selectedChat.id,
        selectedChat.type,
        `/messages/${msg.id}/reactions/toggle`,
      );
      if (!endpoint) return;

      // Əvvəlki state-i yadda saxla (revert üçün)
      const prevReactions = msg.reactions;
      // Optimistic — dərhal göstər
      const optimistic = computeOptimisticReactions(prevReactions, emoji, user.id, user.fullName);

      // Scroll compensation — yalnız aşağıya yaxın olduqda (scroll-to-bottom butonu yoxdursa)
      // reaction yuxarıya genişlənsin. Yuxarıya scroll olunubsa (buton varsa) → normal aşağıya genişlənsin.
      const needsCompensation = !showScrollDownRef.current;
      const scroller = needsCompensation ? messagesAreaRef.current : null;
      const scrollHeightBefore = scroller?.scrollHeight;

      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, reactions: optimistic } : m)),
      );

      // DOM yeniləndikdən sonra scroll pozisiyasını kompensasiya et
      if (needsCompensation) {
        requestAnimationFrame(() => {
          if (scroller && scrollHeightBefore != null) {
            const delta = scroller.scrollHeight - scrollHeightBefore;
            if (delta > 0) {
              scroller.scrollTop += delta;
            }
          }
        });
      }

      try {
        // DM → PUT, Channel → POST (backend API fərqi)
        const result =
          selectedChat.type === 0
            ? await apiPut(endpoint, { reaction: emoji })
            : await apiPost(endpoint, { reaction: emoji });
        // Server cavabı ilə əvəz et (authoritative)
        const reactions = result.reactions || result;
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, reactions } : m)),
        );
      } catch (err) {
        console.error("Failed to toggle reaction:", err);
        // Revert — əvvəlki halına qaytar
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, reactions: prevReactions } : m)),
        );
      }
    },
    [selectedChat, user],
  );

  // handleLoadReactionDetails — reaction badge-ə kliklədikdə kim react edib yüklə
  const handleLoadReactionDetails = useCallback(
    async (messageId) => {
      if (!selectedChat) return null;
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/${messageId}/reactions`,
        );
        if (!endpoint) return null;
        const details = await apiGet(endpoint);
        // Reaction detail-ləri (userFullNames) messages state-inə əlavə et
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions: details } : m,
          ),
        );
        return details;
      } catch (err) {
        console.error("Failed to load reaction details:", err);
        return null;
      }
    },
    [selectedChat],
  );

  // ─── Virtuoso callback-ları ───────────────────────────────────────────────

  // handleRangeChanged — Virtuoso görünən aralıq dəyişdikdə çağırılır
  // 1. Floating date label-ini yenilə (DOM query əvəzinə data lookup)
  // 2. Mark-as-read (IntersectionObserver əvəzinə)
  // QEYD: flatItemsRef/flatItemsMetadataRef istifadə olunur — callback stabil qalır,
  // Virtuoso hər render-də yeni callback almır → daxili re-bindlər azalır
  const handleRangeChanged = useCallback(({ startIndex, endIndex }) => {
    const curFlatItems = flatItemsRef.current;
    const curMetadata = flatItemsMetadataRef.current;
    const curFirstItemIndex = firstItemIndexRef.current;

    // Floating date
    const el = floatingDateRef.current;
    if (el) {
      // startIndex Virtuoso virtual index-dir (firstItemIndex ofsetli)
      // flatItems array index-ə çevir
      const dataIndex = startIndex - curFirstItemIndex;
      const label = curMetadata.indexToDateLabel.get(dataIndex) || "";
      // Collision check — əgər ilk görünən item date separator-dursa, floating date gizlət
      const firstVisibleItem = curFlatItems[dataIndex];
      const finalLabel = (firstVisibleItem?.type === "date") ? "" : label;
      if (el.textContent !== finalLabel) el.textContent = finalLabel;
    }

    // Mark-as-read — görünən item-lərdəki unread mesajları topla
    const startDataIndex = startIndex - curFirstItemIndex;
    const endDataIndex = endIndex - curFirstItemIndex;
    for (let i = Math.max(0, startDataIndex); i <= Math.min(curFlatItems.length - 1, endDataIndex); i++) {
      const item = curFlatItems[i];
      if (item?.type !== "message") continue;
      const msg = item.message;
      if (!msg.isRead && msg.senderId !== user?.id && !processedMsgIdsRef.current.has(msg.id)) {
        processedMsgIdsRef.current.add(msg.id);
        visibleUnreadRef.current.add(msg.id);
        readBatchChatRef.current = {
          chatId: msg.conversationId || msg.channelId,
          chatType: String(selectedChat?.type),
        };
      }
    }
    if (visibleUnreadRef.current.size > 0) {
      if (readBatchTimerRef.current) clearTimeout(readBatchTimerRef.current);
      readBatchTimerRef.current = setTimeout(flushReadBatch, 300);
    }
  }, [user?.id, selectedChat]);

  // ─── Scroll event listener — startReached/endReached əvəzinə ──────────────
  // Virtuoso-nun startReached/endReached callback-ları az item olduqda etibarsızdır.
  // Birbaşa scroll position yoxlayırıq: yuxarıya yaxın → köhnə mesajlar, aşağıya yaxın → yeni mesajlar
  //
  // QEYD: handleStartReached/handleEndReached useCallback deyil (hər render-də yeni ref).
  // Ref istifadə edirik ki, listener hər render-də re-attach olunmasın.
  const startReachedRef = useRef(handleStartReached);
  const endReachedRef = useRef(handleEndReached);
  useEffect(() => {
    startReachedRef.current = handleStartReached;
    endReachedRef.current = handleEndReached;
  });

  // Scroll listener — scrollerRef callback-ında bağlanır (aşağıda handleScrollerRef)
  // Bu şəkildə Virtuoso scroller-i set etdiyi AN listener bağlanır, timing problemi yoxdur.
  // Throttle: 80ms — sürətli scroll zamanı da tez cavab vermək üçün
  const scrollListenerRef = useRef(null);
  const scrollThrottleRef = useRef(false);
  if (!scrollListenerRef.current) {
    const THRESHOLD = 800;
    scrollListenerRef.current = () => {
      if (scrollThrottleRef.current) return;
      scrollThrottleRef.current = true;
      setTimeout(() => { scrollThrottleRef.current = false; }, 80);

      const area = messagesAreaRef.current;
      if (!area) return;
      if (area.scrollTop < THRESHOLD && !loadOlderTriggeredRef.current) {
        startReachedRef.current();
      }
      if (hasMoreDownRef.current && area.scrollHeight - area.scrollTop - area.clientHeight < THRESHOLD) {
        endReachedRef.current();
      }

      // ─── Scroll-to-bottom buton — 1 viewport yuxarı qalxanda göstər ───
      // Virtuoso atBottomStateChange əvəzinə: daha dəqiq kontrol, threshold = viewport height
      // loadingMoreRef guard — handleScrollToBottom/handleSelectChat zamanı suppress
      // (data yüklənir → scroll hələ tamamlanmayıb → yalançı pozitiv qarşısını al)
      if (!loadingMoreRef.current) {
        const distanceFromBottom = area.scrollHeight - area.scrollTop - area.clientHeight;
        const shouldShow = distanceFromBottom > area.clientHeight; // 1 viewport
        if (shouldShow !== showScrollDownRef.current) {
          showScrollDownRef.current = shouldShow;
          setShowScrollDown(shouldShow);
        }
      }
    };
  }

  // scrollerRef callback — Virtuoso scroller DOM elementini tutur
  // Həm messagesAreaRef-i set edir, həm də scroll listener-i bağlayır
  const handleScrollerRef = useCallback((ref) => {
    // Köhnə scroller-dən listener-i sil
    if (messagesAreaRef.current && messagesAreaRef.current !== ref) {
      messagesAreaRef.current.removeEventListener("scroll", scrollListenerRef.current);
    }
    messagesAreaRef.current = ref;
    // Yeni scroller-ə listener bağla
    if (ref) {
      ref.addEventListener("scroll", scrollListenerRef.current, { passive: true });
    }
  }, []);

  // handleIsScrolling — scrollbar CSS class-ını idarə et
  // Programmatic scroll (mesaj göndərmə, scroll-to-bottom) zamanı scrollbar görünməsin
  const handleIsScrolling = useCallback((scrolling) => {
    const area = messagesAreaRef.current;
    if (!area) return;
    if (programmaticScrollRef.current) return; // Programmatic scroll — scrollbar suppress
    if (scrolling) {
      area.classList.add("scrolling");
      if (scrollbarTimerRef.current) clearTimeout(scrollbarTimerRef.current);
    } else {
      scrollbarTimerRef.current = setTimeout(() => area.classList.remove("scrolling"), 800);
    }
  }, []);

  // handleAtBottomStateChange — Virtuoso daxili callback (followOutput üçün lazımdır)
  // Scroll-to-bottom buton artıq scroll listener-dən idarə olunur (1 viewport threshold)
  const handleAtBottomStateChange = useCallback(() => {}, []);

  // renderFlatItem — Virtuoso itemContent callback-ı
  // Hər bir mesaj/separator üçün JSX qaytarır (flat items — hər mesaj ayrı Virtuoso item)
  const renderFlatItem = useCallback((index, item) => {
    // Separator-lar
    if (item.type === "date") {
      return (
        <div className="date-separator">
          <span>{item.label}</span>
        </div>
      );
    }
    if (item.type === "readLater") {
      return (
        <div className="read-later-separator">
          <span>Read later</span>
        </div>
      );
    }
    if (item.type === "newMessages") {
      return (
        <div className="new-messages-separator">
          <span>New messages</span>
        </div>
      );
    }

    // Mesaj item — flat structure (hər mesaj ayrı Virtuoso item)
    const { message: msg, isOwn, senderFullName, isFirstInGroup, isLastInGroup } = item;

    // Own mesajlar — wrapper lazım deyil
    if (isOwn) {
      return (
        <MessageBubble
          msg={msg}
          isOwn
          showAvatar={isLastInGroup}
          chatType={selectedChat.type}
          selectMode={selectMode}
          isSelected={selectedMessages.has(msg.id)}
          onReply={handleReply}
          onForward={handleForwardMsg}
          onPin={handlePinMessage}
          onFavorite={sidebar.handleFavoriteMessage}
          onRemoveFavorite={sidebar.handleRemoveFavorite}
          isFavorite={sidebar.favoriteIds.has(msg.id)}
          onMarkLater={handleMarkLater}
          readLaterMessageId={readLaterMessageId}
          onSelect={handleEnterSelectMode}
          onToggleSelect={handleToggleSelect}
          onScrollToMessage={handleScrollToMessage}
          onDelete={handleDeleteMsgAction}
          onEdit={handleEditMsg}
          onReaction={handleReaction}
          onLoadReactionDetails={handleLoadReactionDetails}
          onMentionClick={handleMentionClick}
          onOpenImageViewer={handleOpenImageViewer}
          onCancelUpload={uploadManager.cancelUpload}
          onRetryUpload={uploadManager.retryUpload}
          isNewMessage={!initialMsgIdsRef.current.has(msg.id)}
        />
      );
    }

    // Non-own mesajlar — flat layout: avatar yalnız sonuncu mesajda, qalanlarında boşluq
    return (
      <div className={`sender-group-flat${isFirstInGroup ? " first-in-group" : ""}${isLastInGroup ? " has-avatar" : ""}`}>
        {isLastInGroup ? (
          <div className="sender-group-avatar" style={{ background: getAvatarColor(senderFullName) }}>
            {getInitials(senderFullName)}
          </div>
        ) : (
          <div className="sender-group-avatar-space" />
        )}
        <div className="sender-group-msg-wrap">
          <MessageBubble
            msg={msg}
            isOwn={false}
            showAvatar={isLastInGroup}
            chatType={selectedChat.type}
            selectMode={selectMode}
            isSelected={selectedMessages.has(msg.id)}
            onReply={handleReply}
            onForward={handleForwardMsg}
            onPin={handlePinMessage}
            onFavorite={sidebar.handleFavoriteMessage}
            onRemoveFavorite={sidebar.handleRemoveFavorite}
            isFavorite={sidebar.favoriteIds.has(msg.id)}
            onMarkLater={handleMarkLater}
            readLaterMessageId={readLaterMessageId}
            onSelect={handleEnterSelectMode}
            onToggleSelect={handleToggleSelect}
            onScrollToMessage={handleScrollToMessage}
            onDelete={handleDeleteMsgAction}
            onEdit={handleEditMsg}
            onReaction={handleReaction}
            onLoadReactionDetails={handleLoadReactionDetails}
            onMentionClick={handleMentionClick}
            onOpenImageViewer={handleOpenImageViewer}
            onCancelUpload={uploadManager.cancelUpload}
            onRetryUpload={uploadManager.retryUpload}
            isNewMessage={!initialMsgIdsRef.current.has(msg.id)}
          />
        </div>
      </div>
    );
  }, [
    selectedChat, selectMode, selectedMessages, readLaterMessageId,
    handleReply, handleForwardMsg, handlePinMessage, handleMarkLater,
    handleEnterSelectMode, handleToggleSelect, handleScrollToMessage,
    handleDeleteMsgAction, handleEditMsg, handleReaction, handleLoadReactionDetails,
    handleMentionClick, handleOpenImageViewer,
    sidebar.handleFavoriteMessage, sidebar.handleRemoveFavorite, sidebar.favoriteIds,
    uploadManager.cancelUpload, uploadManager.retryUpload,
  ]);

  // --- JSX RENDER ---
  return (
    <div className="main-layout">
      {/* Connection status toast — offline / reconnecting / disconnected */}
      {isOffline && (
        <div className="connection-toast offline">
          <span className="toast-check">⚠</span>
          No internet connection
        </div>
      )}
      {!isOffline && toast && (
        <div className={`connection-toast ${toast.type}${toast.hiding ? " toast-hide" : ""}`}>
          {toast.type === "connected"
            ? <span className="toast-check">✓</span>
            : <span className="toast-spinner" />}
          {toast.message}
        </div>
      )}
      {/* main-body — sidebar + content yan-yana */}
      <div className="main-body">
      {/* Sidebar — sol dar nav bar (logout button) */}
      <Sidebar onLogout={logout} />

      {/* main-content — söhbət siyahısı + chat paneli yan-yana */}
      <div className="main-content">
        {/* ConversationList — sol panel, söhbət siyahısı */}
        <ConversationList
          conversations={conversations}
          selectedChatId={selectedChat?.id} // Optional chaining — selectedChat null ola bilər
          searchText={searchText}
          onSearchChange={setSearchText} // Funksiya prop olaraq ötürülür
          onSelectChat={handleSelectChat}
          onCreateChannel={handleOpenCreateChannel}
          isLoading={isLoading}
          userId={user.id}
          typingUsers={typingUsers}
          onSelectSearchUser={handleSelectSearchUser}
          onSelectSearchChannel={handleSelectSearchChannel}
          onMarkAllAsRead={handleMarkAllAsRead}
          onTogglePin={handleTogglePin}
          onToggleMute={handleToggleMute}
          onToggleReadLater={handleToggleReadLater}
          onHide={handleToggleHide}
          onLeaveChannel={handleLeaveChannel}
          onFindChatsWithUser={handleFindChatsWithUser}
        />

        {/* chat-panel — sağ panel, mesajlar */}
        <div className="chat-panel">
          {/* showCreateChannel → panel, selectedChat → chat, əks halda empty */}
          {channel.showCreateChannel ? (
            <ChannelPanel
              onCancel={handleCancelCreateChannel}
              onChannelCreated={handleChannelCreated}
              onChannelUpdated={handleChannelUpdated}
              currentUser={user}
              editMode={!!channel.editChannelData}
              channelData={channel.editChannelData}
            />
          ) : selectedChat ? (
            <>
              {/* ChatHeader — chat adı, online status, action düymələr */}
              <ChatHeader
                selectedChat={selectedChat}
                onlineUsers={onlineUsers}
                pinnedMessages={pinnedMessages}
                onTogglePinExpand={() => setPinBarExpanded((v) => !v)}
                onOpenAddMember={() => channel.setShowAddMember(true)}
                addMemberOpen={channel.showAddMember}
                onToggleSidebar={() => sidebar.setShowSidebar((v) => !v)}
                sidebarOpen={sidebar.showSidebar}
                onOpenSearch={handleOpenSearch}
                searchOpen={search.showSearchPanel}
              />

              {/* PinnedBar — pinlənmiş mesajlar varsa compact bar göstər */}
              {pinnedMessages.length > 0 && (
                <PinnedBar
                  pinnedMessages={pinnedMessages}
                  currentPinIndex={currentPinIndex}
                  onToggleExpand={() => setPinBarExpanded((v) => !v)}
                  onPinClick={handlePinBarClick}
                />
              )}

              {/* PinnedExpanded — genişləndirilmiş pin siyahısı */}
              {pinBarExpanded && pinnedMessages.length > 0 && (
                <PinnedExpanded
                  pinnedMessages={pinnedMessages}
                  onToggleExpand={() => setPinBarExpanded(false)}
                  onScrollToMessage={handleScrollToMessage}
                  onUnpin={handlePinMessage}
                />
              )}

              {/* chatLoading — mesajlar yüklənərkən overlay göstər */}
              {chatLoading && (
                <div className="chat-loading-overlay">
                  <div className="chat-loading-spinner" />
                  <span>Loading chat...</span>
                </div>
              )}

              {/* messages-area — Virtuoso virtual scroll container */}
              <div style={{ position: "relative", flex: 1, display: chatLoading ? "none" : "flex", flexDirection: "column" }}>
                {/* Loading older — chat header-in altında sabit loading bar */}
                <div className={`loading-older${loadingOlder ? " active" : ""}`} />
                {/* Floating date — Virtuoso-dan kənarda, absolute overlay */}
                <div className="floating-date" ref={floatingDateRef} />

                {/* Empty state — mesaj yoxdur və loading deyil */}
                {!chatLoading && messages.length === 0 && (
                  <div className="empty-chat-state">
                    <div className="empty-chat-icon">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <span className="empty-chat-title">No messages yet</span>
                    <span className="empty-chat-subtitle">Send the first message to start a conversation</span>
                  </div>
                )}

                {flatItems.length > 0 && (
                  <Virtuoso
                    key={`${selectedChat?.id}-${virtuosoResetKey}`}
                    ref={virtuosoRef}
                    className="messages-area"
                    data={flatItems}
                    firstItemIndex={firstItemIndex}
                    initialTopMostItemIndex={{ index: "LAST", align: "end" }}
                    itemContent={renderFlatItem}
                    computeItemKey={(_, item) =>
                      item.type === "message" ? `msg-${item.message._stableKey || item.message.id}`
                      : item.type === "date" ? `date-${item.label}`
                      : `${item.type}-${item.label || item.messageId || ""}`
                    }
                    followOutput={(isAtBottom) => isAtBottom ? "auto" : false}
                    alignToBottom
                    atBottomThreshold={50}
                    /* startReached/endReached SİLİNDİ — scroll event listener əvəz edir
                       (az senderRun item olduqda Virtuoso callback-ları etibarsızdır) */
                    isScrolling={handleIsScrolling}
                    rangeChanged={handleRangeChanged}
                    atBottomStateChange={handleAtBottomStateChange}
                    scrollerRef={handleScrollerRef}
                    defaultItemHeight={52}
                    overscan={{ main: 800, reverse: 800 }}
                    components={{
                      Footer: () => (
                        <>
                          <ChatStatusBar
                            selectedChat={selectedChat}
                            messages={messages}
                            userId={user.id}
                            typingUsers={typingUsers}
                            lastReadTimestamp={lastReadTimestamp}
                            channelMembers={channelMembers}
                            onOpenReadersPanel={setReadersPanel}
                          />
                          <div ref={messagesEndRef} style={{ minHeight: 1, flexShrink: 0 }} />
                        </>
                      ),
                    }}
                  />
                )}
              </div>

              {/* Scroll-to-bottom butonu — 1 viewport yuxarı scroll olunduqda görünür */}
              {showScrollDown && !chatLoading && (
                <button
                  className={`scroll-to-bottom-btn${newUnreadCount > 0 ? " has-unread" : ""}`}
                  onClick={handleScrollToBottom}
                >
                  {newUnreadCount > 0 && (
                    <span className="scroll-unread-badge">{newUnreadCount}</span>
                  )}
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              )}

              {/* selectMode → SelectToolbar, əks halda ChatInputArea */}
              {selectMode ? (
                <SelectToolbar
                  selectedCount={selectedMessages.size}
                  hasOthersSelected={hasOthersSelected}
                  onExit={handleExitSelectMode}
                  onDelete={handleDeleteSelected}
                  onForward={handleForwardSelected}
                  deleteConfirmOpen={deleteConfirmOpen}
                  setDeleteConfirmOpen={setDeleteConfirmOpen}
                />
              ) : (
                <ChatInputArea
                  messageText={messageText}
                  setMessageText={setMessageText}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  editMessage={editMessage}
                  setEditMessage={setEditMessage}
                  emojiOpen={emojiOpen}
                  setEmojiOpen={setEmojiOpen}
                  emojiPanelRef={emojiPanelRef}
                  inputRef={inputRef}
                  onSend={handleSendMessage}
                  onKeyDown={handleKeyDown}
                  onTyping={sendTypingSignal}
                  onTextChange={handleMessageTextChange}
                  mentionOpen={mention.mentionOpen}
                  mentionItems={mention.mentionItems}
                  mentionSelectedIndex={mention.mentionSelectedIndex}
                  mentionLoading={mention.mentionLoading}
                  mentionPanelRef={mention.mentionPanelRef}
                  onMentionSelect={mention.handleMentionSelect}
                  onInputResize={handleInputResize}
                  selectedFiles={fileUpload.selectedFiles}
                  onFilesSelected={fileUpload.handleFilesSelected}
                  onRemoveFile={fileUpload.handleRemoveFile}
                  onReorderFiles={fileUpload.handleReorderFiles}
                  onClearFiles={fileUpload.handleClearFiles}
                  onSendFiles={handleSendFiles}
                />
              )}

              {pendingDeleteMsg && (
                <ConfirmDialog
                  message="Do you want to delete this message?"
                  onConfirm={handleConfirmDeleteMsg}
                  onCancel={handleCancelDeleteMsg}
                />
              )}

              {pendingLeaveChannel && (
                <ConfirmDialog
                  message="Are you sure you want to leave this channel?"
                  confirmText="LEAVE"
                  onConfirm={handleConfirmLeaveChannel}
                  onCancel={handleCancelLeaveChannel}
                />
              )}

              {pendingDeleteConv && (
                <ConfirmDialog
                  message="Are you sure you want to delete this chat?"
                  onConfirm={handleConfirmDeleteConv}
                  onCancel={handleCancelDeleteConv}
                />
              )}

              {/* forwardMessage varsa ForwardPanel-i göstər (modal overlay) */}
              {forwardMessage && (
                <ForwardPanel
                  conversations={conversations}
                  onForward={handleForward}
                  onClose={handleCloseForward}
                />
              )}

              {/* ReadersPanel — channel mesajını oxuyanların siyahısı */}
              {readersPanel && (
                <ReadersPanel
                  readByIds={readersPanel.readByIds}
                  channelMembers={channelMembers[selectedChat?.id] || {}}
                  onClose={() => setReadersPanel(null)}
                />
              )}

              {/* Image Viewer — şəkil lightbox overlay */}
              {imageViewer && (
                <ImageViewer
                  images={imageMessages}
                  currentIndex={imageViewer.currentIndex}
                  onClose={handleCloseImageViewer}
                  onNavigate={handleImageViewerNavigate}
                />
              )}
            </>
          ) : (
            // Chat seçilməyib — empty state
            <div className="chat-empty">
              <svg
                width="48"
                height="48"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#8899aa"
                strokeWidth="1.2"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h2>Select a chat to start communicating</h2>
            </div>
          )}
        </div>

        {/* Detail Sidebar — ayrı komponentə çıxarılıb */}
        {sidebar.showSidebar && selectedChat && (
          <DetailSidebar
            selectedChat={selectedChat}
            channelMembers={channelMembers}
            conversations={conversations}
            user={user}
            inputRef={inputRef}
            sidebar={sidebar}
            channel={channel}
            search={search}
            onTogglePin={handleTogglePin}
            onToggleMute={handleToggleMute}
            onToggleHide={handleToggleHide}
            onEditChannel={handleEditChannel}
            onSelectChat={handleSelectChat}
            onScrollToMessage={handleScrollToMessage}
            onDeleteMessage={handleDeleteMessage}
            onCloseSearch={handleCloseSearch}
            setPendingDeleteConv={setPendingDeleteConv}
            setPendingLeaveChannel={setPendingLeaveChannel}
            setSelectedChat={setSelectedChat}
            setMessageText={setMessageText}
          />
        )}
        {/* Add chat members popup — floating dialog sidebar-ın üstündə */}
        {channel.showAddMember && (
          <div className="ds-am-overlay">
            <div className="ds-am-popup" ref={channel.addMemberRef}>
              {/* Header */}
              <div className="ds-am-header">
                <span className="ds-am-title">Add chat members</span>
                <button
                  className="ds-am-close"
                  onClick={handleCloseAddMember}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Search sahəsi — chips + input / +Add user butonu */}
              <div className="ds-am-search-area">
                {channel.addMemberSearchActive || channel.addMemberSelected.size > 0 ? (
                  <div className="ds-am-search-box">
                    {[...channel.addMemberSelected].map((uid) => {
                      const name = addMemberChipMap.get(uid) || "User";
                      return (
                        <span key={uid} className="ds-am-chip">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z" /></svg>
                          {name}
                          <button
                            className="ds-am-chip-remove"
                            onClick={() => handleRemoveAddMemberChip(uid)}
                          >×</button>
                        </span>
                      );
                    })}
                    <input
                      className="ds-am-search-input"
                      type="text"
                      placeholder="Search..."
                      value={channel.addMemberSearch}
                      onChange={(e) => channel.setAddMemberSearch(e.target.value)}
                      autoFocus
                      onBlur={() => {
                        if (!channel.addMemberSearch.trim() && channel.addMemberSelected.size === 0) {
                          channel.setAddMemberSearchActive(false);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <button className="ds-am-add-user-btn" onClick={() => channel.setAddMemberSearchActive(true)}>
                    + Add user
                  </button>
                )}
              </div>

              {/* Show chat history — false olduqda yeni üzv yalnız qoşulduqdan sonrakı mesajları görür */}
              <label className="ds-am-checkbox-row">
                <input
                  type="checkbox"
                  checked={channel.addMemberShowHistory}
                  onChange={(e) => channel.setAddMemberShowHistory(e.target.checked)}
                  className="ds-am-checkbox"
                />
                <span>Show chat history</span>
              </label>

              {/* Recent chats */}
              <div className="ds-am-section-title">
                {channel.addMemberSearch.trim().length >= 2 ? "Search results" : "Recent chats"}
              </div>

              <div className="ds-am-list">
                {addMemberFilteredUsers.length === 0 ? (
                  <div className="ds-am-empty">{channel.addMemberSearch.trim().length >= 2 ? "No matching users" : "No recent chats"}</div>
                ) : (
                  addMemberFilteredUsers.map((u) => {
                    const isSelected = channel.addMemberSelected.has(u.id);
                    return (
                      <div
                        key={u.id}
                        className={`ds-am-user${isSelected ? " selected" : ""}`}
                        onClick={() => handleToggleAddMemberUser(u.id)}
                      >
                        <div className="ds-am-user-avatar" style={{ background: getAvatarColor(u.fullName) }}>
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" className="ds-am-user-avatar-img" />
                          ) : (
                            getInitials(u.fullName)
                          )}
                        </div>
                        <div className="ds-am-user-info">
                          <span className="ds-am-user-name">{u.fullName}</span>
                          <span className="ds-am-user-role">{u.position}</span>
                        </div>
                        {isSelected && (
                          <svg className="ds-am-check" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00ace3" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer — INVITE + CANCEL */}
              <div className="ds-am-footer">
                <button
                  className="ds-am-invite-btn"
                  disabled={channel.addMemberSelected.size === 0 || channel.addMemberInviting}
                  onClick={channel.handleInviteMembers}
                >
                  {channel.addMemberInviting ? "INVITING..." : "INVITE"}
                </button>
                <button
                  className="ds-am-cancel-btn"
                  onClick={handleCloseAddMember}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

export default Chat;
