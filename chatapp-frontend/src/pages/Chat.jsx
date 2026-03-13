// React hook-ları import edirik
// useState    — state yaratmaq (like C# reactive property)
// useEffect   — side effect (API çağrısı, event listener qeydiyyatı)
// useLayoutEffect — DOM paint-dən ƏVVƏL işləyir (scroll restore üçün)
// useContext  — global state-ə daxil olmaq (like @inject)
// useRef      — re-render etmədən dəyər saxlamaq (like C# field)
// useMemo     — hesablamanı cache-lər, yalnız dependency dəyişəndə yenidən hesablar
// useCallback — funksiyanı cache-lər, yalnız dependency dəyişəndə yenidən yaradır
import {
  useState,
  useEffect,
  useLayoutEffect,
  useContext,
  useRef,
  useMemo,
  useCallback,
} from "react";

// SignalR qrup idarəetməsi — conversation/channel-a qoşulma/ayrılma
import {
  joinConversation,
  leaveConversation,
  joinChannel,
  leaveChannel,
  getConnection, // aktiv SignalR bağlantısını qaytarır
} from "../services/signalr";

// Custom hook-lar — ayrı fayllarda saxlanılan məntiqi bloklar
// .NET ekvivalenti: service class-ı inject etmək kimi
import useChatSignalR from "../hooks/useChatSignalR"; // real-time event handler-lar
import useChatScroll from "../hooks/useChatScroll"; // infinite scroll + pagination
import useMessageSelection from "../hooks/useMessageSelection"; // mesaj seçmə rejimi
import useMention from "../hooks/useMention"; // @ mention sistemi
import useSearchPanel from "../hooks/useSearchPanel"; // chat daxili axtarış
import useFileUpload from "../hooks/useFileUpload"; // fayl yükləmə state
import useSidebarPanels from "../hooks/useSidebarPanels"; // sidebar panel state + məntiq
import useChannelManagement from "../hooks/useChannelManagement"; // channel + üzv idarəsi

// Global auth state — user, logout
import { AuthContext } from "../context/AuthContext";
// Toast notification — alert() əvəzinə modern UI notification
import { useToast } from "../context/ToastContext";

// API servis — HTTP metodları (GET, POST, PUT, DELETE)
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from "../services/api";

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
} from "../utils/chatUtils";

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

  // messagesAreaRef — scroll container-i (messages-area div-i)
  // handleScroll, IntersectionObserver üçün lazımdır
  const messagesAreaRef = useRef(null);

  // floatingDateRef — scroll zamanı cari tarixi göstərən sabit element
  const floatingDateRef = useRef(null);

  // pendingHighlightRef — around endpoint-dən sonra vurğulanacaq mesajın id-si
  // useLayoutEffect-də istifadə olunur
  const pendingHighlightRef = useRef(null);

  // highlightTimerRef — highlight setTimeout ID-si (unmount-da təmizləmək üçün)
  const highlightTimerRef = useRef(null);

  // allReadPatchRef — unreadCount===0 ilə girdikdə true olur
  // useChatScroll-da scroll ilə yüklənən mesajları da isRead:true patch etmək üçün
  // Backend channel mesajları üçün oxunmuş olsa belə isRead:false qaytarır
  const allReadPatchRef = useRef(false);

  // shouldScrollBottom — yeni mesaj gəldikdə / chat seçildikdə aşağıya scroll et
  const [shouldScrollBottom, setShouldScrollBottom] = useState(false);

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

  // useChatScroll — infinite scroll (yuxarı scroll → köhnə mesajlar yüklə)
  // handleScroll — scroll event handler (throttled)
  // hasMoreRef — daha köhnə mesaj varmı? false → daha yükləmə
  // hasMoreDownRef — around mode-da altda mesaj varmı?
  // loadingOlder — köhnə mesajlar yüklənirkən true (spinner)
  // scrollRestoreRef — scroll bərpası üçün əvvəlki scroll vəziyyəti
  const {
    handleScroll,
    hasMoreRef,
    hasMoreDownRef,
    loadingOlder,
    scrollRestoreRef,
  } = useChatScroll(messagesAreaRef, messages, selectedChat, setMessages, allReadPatchRef, floatingDateRef, setShowScrollDown);

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

  // useFileUpload — fayl yükləmə state
  const fileUpload = useFileUpload();

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
  );

  // shouldScrollBottom true olduqda ən alt mesaja scroll et
  // useLayoutEffect — paint-dən ƏVVƏL işləyir → flash yoxdur
  // useEffect olsaydı: brauzer mesajları yuxarıda çəkib SONRA scroll edərdi (flash)
  // channelMembers dependency: channel members GECİKMƏLİ yükləndikdə ChatStatusBar
  // "Viewed by X" render olur → hündürlük artır → scroll yenilənməlidir
  useLayoutEffect(() => {
    if (shouldScrollBottom) {
      // area.scrollTop istifadə et — scrollIntoView nested container-ları da scroll edə bilər
      const area = messagesAreaRef.current;
      if (area) {
        area.scrollTop = area.scrollHeight;
      }
      setShouldScrollBottom(false);
      return;
    }
    // Yeni unread mesajlar varsa — viewport-a sığana qədər scroll, sığmayanda dayan
    if (hasNewUnreadRef.current) {
      const area = messagesAreaRef.current;
      if (area && firstUnreadMsgIdRef.current) {
        const firstEl = area.querySelector(
          `[data-bubble-id="${firstUnreadMsgIdRef.current}"]`,
        );
        if (firstEl) {
          // İlk unread-dən scroll area-nın sonuna qədər məsafə
          const distFromUnreadToBottom = area.scrollHeight - firstEl.offsetTop;
          // Viewport-a sığırsa → scroll et (ilk unread hələ görünəcək)
          if (distFromUnreadToBottom <= area.clientHeight) {
            area.scrollTop = area.scrollHeight;
          } else {
            // Sığmırsa → scroll etmə, scroll-to-bottom butonunu göstər
            setShowScrollDown(true);
          }
        }
      }
      return;
    }

    // Auto-scroll: istifadəçi artıq aşağıdadırsa (< 80px) və content dəyişibsə
    const area = messagesAreaRef.current;
    if (area) {
      const distanceFromBottom =
        area.scrollHeight - area.scrollTop - area.clientHeight;
      if (distanceFromBottom < 80) {
        area.scrollTop = area.scrollHeight;
      }
    }
  }, [messages, shouldScrollBottom, pinnedMessages, channelMembers, typingUsers]);

  // Scroll position restore — yuxarı scroll edib köhnə mesaj yüklənəndə
  // useLayoutEffect — brauzer paint etməzdən əvvəl işlə
  // Bu sayədə scroll pozisyonu qorunur, mesajlar "tullanmır"
  useLayoutEffect(() => {
    const area = messagesAreaRef.current;
    const saved = scrollRestoreRef.current;
    if (area && saved) {
      // Yeni scrollHeight - əvvəlki scrollHeight = yeni mesajların hündürlüyü
      // Köhnə scrollTop + bu fərq = mesajlar yuxarı tullanmır
      const heightDiff = area.scrollHeight - saved.scrollHeight;
      area.scrollTop = saved.scrollTop + heightDiff;
      scrollRestoreRef.current = null;
    }
  }, [messages, scrollRestoreRef]);

  // getAround endpoint-dən mesajlar yükləndikdən sonra
  // hədəf mesaja scroll et + highlight et
  useLayoutEffect(() => {
    const messageId = pendingHighlightRef.current;
    if (!messageId) return;
    pendingHighlightRef.current = null; // Bir dəfə işlə, sıfırla

    const area = messagesAreaRef.current;
    if (!area) return;

    // DOM-da data-bubble-id={messageId} olan elementi tap
    const target = area.querySelector(`[data-bubble-id="${messageId}"]`);
    if (target) {
      target.scrollIntoView({ behavior: "instant", block: "center" });
      // Əvvəlki highlight varsa təmizlə (dublikat qarşısı)
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      target.classList.add("highlight-message");
      highlightTimerRef.current = setTimeout(() => {
        target.classList.remove("highlight-message");
        highlightTimerRef.current = null;
      }, HIGHLIGHT_DURATION_MS);
    }
  }, [messages]);

  // Read later separator-a scroll — conversation açılanda separator mərkəzə gəlsin
  useLayoutEffect(() => {
    if (!pendingScrollToReadLaterRef.current) return;
    pendingScrollToReadLaterRef.current = false;

    const area = messagesAreaRef.current;
    if (!area) return;

    const separator = area.querySelector(".read-later-separator");
    if (separator) {
      separator.scrollIntoView({ behavior: "instant", block: "center" });
    }
  }, [messages]);

  // New messages separator-a scroll — unread mesaj olduqda separator görünsün
  useLayoutEffect(() => {
    if (!pendingScrollToUnreadRef.current) return;
    pendingScrollToUnreadRef.current = false;

    const area = messagesAreaRef.current;
    if (!area) return;

    const separator = area.querySelector(".new-messages-separator");
    if (separator) {
      separator.scrollIntoView({ behavior: "instant", block: "center" });
    } else {
      // Separator yoxdursa (bütün mesajlar unread, separator yuxarıda) → ən aşağıya scroll et
      area.scrollTop = area.scrollHeight;
    }
  }, [messages]);

  // Scroll-to-bottom butonu + scrollbar görünürlüyü — useChatScroll-a birləşdirilib

  // ─── Mark-as-read mexanizmi ───
  // initialMsgIdsRef — conversation açılanda yüklənən mesaj ID-ləri
  //   Bu mesajlar viewport-da görünəndə dərhal read olur (scroll ilə)
  //   Yeni SignalR mesajları bu set-də yoxdur → yazmağa/göndərməyə qədər unread qalır
  // hasNewUnreadRef — SignalR ilə yeni unread mesaj gəlib mi?
  //   Yazmağa başlayanda/göndərəndə mark-all-read çağırılır
  const initialMsgIdsRef = useRef(new Set());
  const hasNewUnreadRef = useRef(false);
  const firstUnreadMsgIdRef = useRef(null); // İlk oxunmamış mesajın ID-si (scroll məhdudiyyəti üçün)
  const visibleUnreadRef = useRef(new Set());
  const observerRef = useRef(null);
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
  function markAllAsReadForCurrentChat() {
    if (!hasNewUnreadRef.current) return;
    hasNewUnreadRef.current = false;
    firstUnreadMsgIdRef.current = null;

    const chatInfo = readBatchChatRef.current;
    if (!chatInfo) return;
    const { chatId, chatType } = chatInfo;

    // Frontend-də mesajları isRead: true et
    setMessages((prev) =>
      prev.map((m) => m.isRead ? m : { ...m, isRead: true }),
    );

    // Backend-ə mark-all-read göndər
    const endpoint = chatType === "0"
      ? `/api/conversations/${chatId}/messages/mark-all-read`
      : `/api/channels/${chatId}/messages/mark-as-read`;
    apiPost(endpoint).catch(() => {});

    // Conversation list-dəki unreadCount-u sıfırla
    setConversations((prev) =>
      prev.map((c) =>
        c.id === chatId ? { ...c, unreadCount: 0 } : c,
      ),
    );

    visibleUnreadRef.current = new Set();
  }

  // handleScrollToBottom — scroll-to-bottom butonu basıldığında
  // Həmişə API-dən ən son mesajları yüklə — around mode-da da, normal mode-da da
  // Bu, SignalR ilə miss olmuş mesajların da görsənməsini təmin edir
  async function handleScrollToBottom() {
    if (!selectedChat) return;
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
    // Unread tracking sıfırla — istifadəçi açıq şəkildə aşağıya scroll etdi
    hasNewUnreadRef.current = false;
    firstUnreadMsgIdRef.current = null;
    setShouldScrollBottom(true);
  }

  // Effect 1: Observer yaratma/silmə — YALNIZ selectedChat dəyişdikdə
  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area || !selectedChat) return;

    visibleUnreadRef.current = new Set();
    processedMsgIdsRef.current = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const msgId = entry.target.dataset.msgId;
          const convId = entry.target.dataset.convId;
          const convType = entry.target.dataset.convType;
          if (!msgId) continue;

          if (entry.isIntersecting && !processedMsgIdsRef.current.has(msgId)) {
            // Mesaj viewport-da görünür → oxundu olaraq işarələ
            // Həm ilkin mesajlar, həm SignalR mesajları üçün eyni davranış
            processedMsgIdsRef.current.add(msgId);
            visibleUnreadRef.current.add(msgId);
            readBatchChatRef.current = { chatId: convId, chatType: convType };
            // Debounce — 300ms sonra batch göndər
            if (readBatchTimerRef.current) clearTimeout(readBatchTimerRef.current);
            readBatchTimerRef.current = setTimeout(flushReadBatch, 300);
            observer.unobserve(entry.target);
          }
        }
      },
      { root: area, threshold: 0.5 },
    );

    observerRef.current = observer;
    return () => {
      observer.disconnect();
      observerRef.current = null;
      if (readBatchTimerRef.current) {
        clearTimeout(readBatchTimerRef.current);
        readBatchTimerRef.current = null;
      }
    };
  }, [selectedChat]);

  // Effect 2: Yeni unread elementləri observe et — messages dəyişdikdə
  useEffect(() => {
    const observer = observerRef.current;
    const area = messagesAreaRef.current;
    if (!observer || !area) return;

    const unreadElements = area.querySelectorAll("[data-unread='true']");
    unreadElements.forEach((el) => {
      if (!processedMsgIdsRef.current.has(el.dataset.msgId)) {
        observer.observe(el);
      }
    });
  }, [messages]);

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
  async function loadPinnedMessages(chat) {
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
  }

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
  async function handleLeaveChannel(conv) {
    try {
      await apiPost(`/api/channels/${conv.id}/members/leave`);
      // Siyahıdan sil
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      // Channel hazırda seçilmişdirsə → seçimi sıfırla
      if (selectedChat && selectedChat.id === conv.id) {
        leaveChannel(conv.id);
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to leave channel:", err);
    }
  }

  // handleDeleteConversation — conversation/channel-ı sil
  async function handleDeleteConversation(conv) {
    try {
      const endpoint = conv.type === 1
        ? `/api/channels/${conv.id}`
        : `/api/conversations/${conv.id}`;
      await apiDelete(endpoint);
      // Siyahıdan sil
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      // Hazırda seçilmişdirsə — seçimi sıfırla
      if (selectedChat && selectedChat.id === conv.id) {
        if (conv.type === 1) leaveChannel(conv.id);
        else leaveConversation(conv.id);
        setSelectedChat(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  }

  // handleMessageTextChange — textarea onChange (mention detection ilə birlikdə)
  function handleMessageTextChange(newText, caretPos) {
    setMessageText(newText);
    markAllAsReadForCurrentChat();
    mention.detectMentionInText(newText, caretPos, () => { if (emojiOpen) setEmojiOpen(false); });
  }

  // handleInputResize — textarea böyüdükdə/kiçildikdə mesajları aşağı scroll et
  // scrollTop istifadə edir (scrollIntoView bütün səhifəni scroll edə bilər)
  function handleInputResize() {
    requestAnimationFrame(() => {
      const area = messagesAreaRef.current;
      if (area) area.scrollTop = area.scrollHeight;
    });
  }

  // handleMentionClick — mesajdakı mention-a klik (conversation-a keçid)
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
    const channelConv = conversations.find((c) => c.type === 1 && c.id === m.userId);
    if (channelConv) { handleSelectChat(channelConv); return; }
    const existing = conversations.find((c) => c.type === 0 && c.otherUserId === m.userId);
    if (existing) { handleSelectChat(existing); }
    else {
      const deptUser = conversations.find((c) => c.type === 2 && (c.otherUserId === m.userId || c.userId === m.userId));
      if (deptUser) handleSelectChat(deptUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations, selectedChat]);

  // ─── Search panel handler-ləri (state useSearchPanel hook-unda) ──────────────

  function handleOpenSearch() {
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
  }

  function handleCloseSearch() {
    search.resetSearch();
    if (!search.searchFromSidebar) sidebar.setShowSidebar(false);
  }

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
      // SignalR qrupundan ayrıl
      if (selectedChat.type === 0) leaveConversation(selectedChat.id);
      else if (selectedChat.type === 1) leaveChannel(selectedChat.id);
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

    // Əvvəlki chatın SignalR qrupundan ayrıl
    if (selectedChat) {
      if (selectedChat.type === 0) {
        leaveConversation(selectedChat.id);
      } else if (selectedChat.type === 1) {
        leaveChannel(selectedChat.id);
      }
    }

    // Yeni chatın draft-ını yüklə
    const savedDraft = draftsRef.current[chat.id] || "";
    setMessageText(savedDraft);

    // State sıfırla — yeni chat seçildi
    setChatLoading(true); // Mesajlar yüklənənə qədər loading overlay göstər
    setSelectedChat(chat);
    setMessages([]);
    setPinnedMessages([]);
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
    hasMoreRef.current = true; // Yenidən köhnə mesaj yükləmək mümkündür
    hasMoreDownRef.current = false; // Around mode yox
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

    try {
      const msgBase = getChatEndpoint(chat.id, chat.type, "/messages");
      if (!msgBase) return;
      const pinEndpoint = `${msgBase}/pinned`;

      // Favori mesajları paralel yüklə (fire-and-forget — əsas axına təsir etmir)
      sidebar.loadFavoriteMessages(chat);

      // Read later varsa around endpoint, yoxdursa normal endpoint
      const msgEndpoint = hasReadLater
        ? `${msgBase}/around/${chat.lastReadLaterMessageId}`
        : `${msgBase}?pageSize=${MESSAGE_PAGE_SIZE}`;

      // Promise.all — API çağrılarını paralel icra et
      const promises = [
        apiGet(msgEndpoint),
        apiGet(pinEndpoint).catch(() => []),
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

      const [msgData, pinData, , latestForSeparator] = await Promise.all(promises);

      // Pinlənmiş mesajları DESC sırala
      const sortedPins = (pinData || []).sort(
        (a, b) => new Date(b.pinnedAtUtc) - new Date(a.pinnedAtUtc),
      );
      setPinnedMessages(sortedPins);

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
      // setChatLoading(false) finally blokunda — hər halda çağırılır

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
        joinConversation(chat.id);

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
        joinChannel(chat.id);

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
      console.error("Failed to load messages:", err);
      setMessages([]);
    } finally {
      setChatLoading(false); // Hər halda (uğurlu, xəta, early return) loading-i gizlət
      setShowScrollDown(false); // Loading bitdikdə buton sıfırlansın — scroll event yenidən qiymətləndirəcək
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
          });
        }
        handleExitSelectMode(); // Select mode-dan çıx
      } else {
        // Tək mesaj forward — fileId varsa onu da göndər
        await apiPost(endpoint, {
          content: fwd.content || "",
          fileId: fwd.fileId || null,
          isForwarded: true,
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
        // Functional merge — SignalR status yenilikləri qorunur (DM status + Channel readBy)
        setMessages((prev) => {
          const prevMap = new Map();
          for (const m of prev) {
            prevMap.set(m.id, m);
          }
          return data.map((m) => {
            const p = prevMap.get(m.id);
            if (!p) return m;
            let merged = m;
            if (p.status !== undefined && p.status > m.status) {
              merged = { ...merged, status: p.status, isRead: p.status >= 3 };
            }
            if (p.readByCount !== undefined && p.readByCount > (m.readByCount || 0)) {
              merged = { ...merged, readByCount: p.readByCount, readBy: p.readBy };
            }
            return merged;
          });
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
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/${msg.id}/pin`,
        );
        if (!endpoint) return;

        // isPinned true → DELETE (unpin), false → POST (pin)
        if (msg.isPinned) {
          await apiDelete(endpoint);
        } else {
          await apiPost(endpoint);
        }

        // Pin siyahısını yenilə + mesajın isPinned flag-ini dəyiş
        loadPinnedMessages(selectedChat);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msg.id ? { ...m, isPinned: !msg.isPinned } : m,
          ),
        );
      } catch (err) {
        console.error("Failed to pin/unpin message:", err);
      }
    },
    [selectedChat],
  ); // Dependency: selectedChat dəyişdikdə funksiyanı yenilə

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

  // handlePinBarClick — PinnedBar-a klik edildikdə
  // 1) Həmin mesaja scroll et, 2) Növbəti pin-ə keç
  function handlePinBarClick(messageId) {
    handleScrollToMessage(messageId);
    // Modulo əməliyyatı — axırıncı pin-dən sonra birinciyə qayıt (circular)
    setCurrentPinIndex((prev) =>
      prev >= pinnedMessages.length - 1 ? 0 : prev + 1,
    );
  }

  // handleFilesSelected, handleRemoveFile, handleReorderFiles, handleClearFiles → useFileUpload hook-una çıxarılıb

  // handleSendFiles — faylları yüklə + mesaj göndər
  // text: FilePreviewPanel textarea-dan gələn əlavə mətn (boş ola bilər)
  async function handleSendFiles(text) {
    if (!selectedChat || fileUpload.selectedFiles.length === 0 || fileUpload.isUploading) return;

    fileUpload.setIsUploading(true);
    fileUpload.setUploadProgress(0);

    try {
      let chatId = selectedChat.id;
      let chatType = selectedChat.type;

      // DepartmentUser (type=2) → əvvəlcə conversation yarat
      if (chatType === 2) {
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
        joinConversation(chatId);
      }

      const endpoint = getChatEndpoint(chatId, chatType, "/messages");
      if (!endpoint) return;

      const totalFiles = fileUpload.selectedFiles.length;
      const uploadedFileIds = [];

      // 1. Hər faylı yüklə (progress tracking ilə)
      for (let i = 0; i < totalFiles; i++) {
        const formData = new FormData();
        formData.append("file", fileUpload.selectedFiles[i]);

        const result = await apiUpload("/api/files/upload", formData, (pct) => {
          // Overall progress: (tamamlanmış fayllar * 100 + cari faylın %-i) / ümumi fayl sayı
          const overall = Math.round(((i * 100) + pct) / totalFiles);
          fileUpload.setUploadProgress(overall);
        });

        uploadedFileIds.push(result.fileId);
      }
      fileUpload.setUploadProgress(100);

      // 2. Mesajları göndər
      // Mention-ları hazırla (hook funksiyası ilə)
      const mentionsToSend = mention.prepareMentionsForSend(text, chatType);

      // Mesaj body-ləri hazırla — hər fayl = 1 mesaj, ilk mesaj text daşıyır
      const messageBodies = uploadedFileIds.map((fileId, i) => ({
        content: i === 0 ? (text || "") : "",
        fileId,
        replyToMessageId: i === 0 && replyTo ? replyTo.id : null,
        ...(i === 0 && mentionsToSend.length > 0 ? { mentions: mentionsToSend } : {}),
      }));

      // DM + çoxlu fayl → batch endpoint (max 20)
      if (chatType === 0 && messageBodies.length > 1 && messageBodies.length <= MAX_BATCH_FILES) {
        await apiPost(`${endpoint}/batch`, { messages: messageBodies });
      } else {
        // Channel və ya tək fayl → ardıcıl göndər
        for (const body of messageBodies) {
          await apiPost(endpoint, body);
        }
      }

      // 3. Cleanup
      fileUpload.handleClearFiles();
      setReplyTo(null);
      setMessageText("");

      // Textarea + mirror sıfırla
      if (inputRef.current) inputRef.current.style.height = "auto";
      const mirror = document.querySelector(".message-input-mirror");
      if (mirror) mirror.style.height = "auto";

      // Mesajları yenidən yüklə
      const data = await apiGet(`${endpoint}?pageSize=${MESSAGE_PAGE_SIZE}`);
      hasMoreDownRef.current = false;
      setShouldScrollBottom(true);
      setMessages((prev) => {
        const prevMap = new Map();
        for (const m of prev) prevMap.set(m.id, m);
        return data.map((m) => {
          const p = prevMap.get(m.id);
          if (!p) return m;
          let merged = m;
          if (p.status !== undefined && p.status > m.status) {
            merged = { ...merged, status: p.status, isRead: p.status >= 3 };
          }
          if (p.readByCount !== undefined && p.readByCount > (m.readByCount || 0)) {
            merged = { ...merged, readByCount: p.readByCount, readBy: p.readBy };
          }
          return merged;
        });
      });
    } catch (err) {
      console.error("Failed to send files:", err);
      // Backend-dən gələn xəta mesajını göstər
      const errMsg = err?.response?.data?.errors
        ? Object.values(err.response.data.errors).flat().join(", ")
        : err?.response?.data?.error || err?.message || "Fayl göndərmə xətası";
      showToast(errMsg, "error");
      fileUpload.setIsUploading(false);
      fileUpload.setUploadProgress(null);
    }
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

    // Textarea + mirror hündürlüyünü sıfırla
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }
    const mirror = document.querySelector(".message-input-mirror");
    if (mirror) mirror.style.height = "auto";

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

    setReplyTo(null); // Reply-ı sıfırla

    try {
      let chatId = selectedChat.id;
      let chatType = selectedChat.type;

      // ── DepartmentUser (type=2): əvvəlcə conversation yarat ──
      // DepartmentUser hələ real conversation deyil — sadəcə eyni departamentdəki istifadəçidir.
      // İlk mesaj göndərildikdə backend conversation yaradır, biz sonra type-ı 0-a çeviririk.
      if (chatType === 2) {
        // POST /api/conversations — { otherUserId } göndər, conversationId qaytarır
        const result = await apiPost("/api/conversations", {
          otherUserId: selectedChat.id, // DepartmentUser id = userId
        });

        // Backend: { conversationId: Guid } qaytarır
        chatId = result.conversationId;
        chatType = 0; // Artıq real DM conversation-dır

        // selectedChat-ı yenilə — type 2 → type 0
        const updatedChat = {
          ...selectedChat,
          id: chatId,
          type: 0,
          otherUserId: selectedChat.id,
        };
        setSelectedChat(updatedChat);

        // Conversation list-dəki DepartmentUser-i real conversation-a çevir
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedChat.id && c.type === 2
              ? { ...c, id: chatId, type: 0, otherUserId: selectedChat.id }
              : c,
          ),
        );

        // Yeni conversation-ın SignalR qrupuna qoşul
        joinConversation(chatId);
      }

      const endpoint = getChatEndpoint(chatId, chatType, "/messages");
      if (!endpoint) return;

      // Mention-ları hazırla (hook funksiyası ilə)
      const mentionsToSend = mention.prepareMentionsForSend(text, chatType);

      // POST /api/conversations/{id}/messages — yeni mesaj göndər
      await apiPost(endpoint, {
        content: text,
        replyToMessageId: replyTo ? replyTo.id : null, // Reply varsa id-ni göndər
        ...(mentionsToSend.length > 0 ? { mentions: mentionsToSend } : {}),
      });

      // Hidden conversation-a mesaj göndərildikdə — siyahıda yoxdursa əlavə et
      setConversations((prev) => {
        const existsInList = prev.some((c) => c.id === chatId);
        if (!existsInList) {
          // selectedChat-dan conversation yaradıb siyahıya əlavə et
          const newConv = {
            id: chatId,
            name: selectedChat.name,
            type: chatType,
            avatarUrl: selectedChat.avatarUrl,
            otherUserId: selectedChat.otherUserId,
            otherUserPosition: selectedChat.otherUserPosition,
            lastMessage: text,
            lastMessageAtUtc: new Date().toISOString(),
            lastMessageSenderId: user.id,
            lastMessageStatus: "Sent",
            unreadCount: 0,
          };
          return [newConv, ...prev];
        }
        return prev;
      });

      // Mesajları yenidən yüklə (SignalR yoksa fallback)
      const data = await apiGet(`${endpoint}?pageSize=${MESSAGE_PAGE_SIZE}`);
      hasMoreDownRef.current = false;
      setShouldScrollBottom(true); // Yeni mesajdan sonra aşağıya scroll et
      // Functional merge — SignalR-dan gələn status yenilikləri (Read, Delivered)
      // API data-dan üstün tutulur. Əks halda race condition:
      // DM: "MessageRead" event status=3 edir, amma apiGet köhnə status=1 gətirir və üzərinə yazır.
      // Channel: "ChannelMessagesRead" event readByCount/readBy edir, apiGet köhnə data gətirir.
      setMessages((prev) => {
        const prevMap = new Map();
        for (const m of prev) {
          prevMap.set(m.id, m);
        }
        return data.map((m) => {
          const p = prevMap.get(m.id);
          if (!p) return m;
          let merged = m;
          // DM status qoru (daha yüksək status üstündür)
          if (p.status !== undefined && p.status > m.status) {
            merged = { ...merged, status: p.status, isRead: p.status >= 3 };
          }
          // Channel readByCount/readBy qoru (daha yüksək count üstündür)
          if (p.readByCount !== undefined && p.readByCount > (m.readByCount || 0)) {
            merged = { ...merged, readByCount: p.readByCount, readBy: p.readBy };
          }
          return merged;
        });
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  }

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
  function stopTypingSignal() {
    if (!isTypingRef.current) return; // Artıq yazılmır — heç nə etmə
    isTypingRef.current = false;
    // Gözləyən timeout-u sil — artıq lazım deyil
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    // "isTyping: false" siqnalı göndər
    if (!selectedChat || selectedChat.type === 2 || selectedChat.isNotes) return;
    const conn = getConnection();
    if (!conn) return;
    if (selectedChat.type === 0) {
      conn.invoke(
        "TypingInConversation",
        selectedChat.id,
        selectedChat.otherUserId,
        false,
      );
    } else if (selectedChat.type === 1) {
      conn.invoke("TypingInChannel", selectedChat.id, false);
    }
  }

  // sendTypingSignal — istifadəçi yazarkən SignalR hub-a "typing" siqnalı göndər
  // Debounce pattern: TYPING_DEBOUNCE_MS sonra "stopped typing" göndər
  function sendTypingSignal() {
    // DepartmentUser (type=2) və Notes üçün typing yoxdur
    if (!selectedChat || selectedChat.type === 2 || selectedChat.isNotes) return;
    const conn = getConnection();
    if (!conn) return;

    // İlk dəfə yazılır — "isTyping: true" siqnalı göndər
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      if (selectedChat.type === 0) {
        conn.invoke(
          "TypingInConversation",
          selectedChat.id,
          selectedChat.otherUserId,
          true, // isTyping = true
        );
      } else if (selectedChat.type === 1) {
        conn.invoke("TypingInChannel", selectedChat.id, true);
      }
    }

    // Əvvəlki timeout-u sil (debounce reset)
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // TYPING_DEBOUNCE_MS ms sonra "stopped typing" göndər
    typingTimeoutRef.current = setTimeout(() => {
      stopTypingSignal();
    }, TYPING_DEBOUNCE_MS);
  }

  // handleScrollToMessage — mesaja scroll et (reply reference / pin bar klik)
  // Mesaj DOM-da varsa birbaşa scroll et, yoxdursa around endpoint-dən yüklə
  const handleScrollToMessage = useCallback(
    async (messageId) => {
      const area = messagesAreaRef.current;
      if (!area || !selectedChat) return;

      // DOM-da bu mesaj artıq render olunubsa?
      let el = area.querySelector(`[data-bubble-id="${messageId}"]`);
      if (el) {
        // Var — birbaşa smooth scroll et + highlight
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
        el.classList.add("highlight-message");
        highlightTimerRef.current = setTimeout(() => {
          el.classList.remove("highlight-message");
          highlightTimerRef.current = null;
        }, HIGHLIGHT_DURATION_MS);
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
        hasMoreRef.current = true; // Yuxarıda daha mesaj var
        hasMoreDownRef.current = true; // Aşağıda da daha mesaj var (around mode)

        // pendingHighlightRef — setMessages-dən SONRA useLayoutEffect işlətmək üçün
        // Mesajlar render olunandan sonra highlight edəcəyik
        pendingHighlightRef.current = messageId;
        // Backend around endpoint DESC qaytarır — birbaşa set et
        setMessages(data);
      } catch (err) {
        console.error("Failed to load messages around target:", err);
      }
    },
    [selectedChat, hasMoreRef, hasMoreDownRef],
  );

  // handleKeyDown — textarea-da klaviatura hadisəsi
  // Enter → mesaj göndər (Shift+Enter → yeni sətir)
  function handleKeyDown(e) {
    // ── Mention panel keyboard navigation (hook-a delegasiya) ──
    if (mention.handleMentionKeyDown(e)) return;

    // Modifier/shortcut düymələr typing siqnalı göndərməsin
    // Ctrl+R, Ctrl+C, Alt+Tab vs. — bunlar yazı deyil, typing indicator göstərməməlidir
    if (e.ctrlKey || e.altKey || e.metaKey) {
      // Enter hər halda yoxla (bəzi OS-lərdə Ctrl+Enter istifadə olunur)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
      return;
    }
    // Tək modifier düymələr (Shift, CapsLock, Fn vs.) — yazı deyil
    if (e.key === "Shift" || e.key === "CapsLock") return;

    sendTypingSignal();
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // --- MEMOIZED DƏYƏRLƏR ---

  // newUnreadCount — scroll-to-bottom badge üçün oxunmamış mesaj sayı
  // Observer read etdiyi mesajlar isRead:true olur → count-dan çıxır
  // Yeni SignalR mesajları isRead:false qalır → count artır
  const newUnreadCount = useMemo(
    () => messages.filter((m) => !m.isRead && m.senderId !== user?.id).length,
    [messages, user?.id],
  );

  // grouped — mesajları tarix separator-ları ilə qruplaşdır
  // useMemo — messages dəyişmədikdə bu hesablamanı yenidən etmə
  // [...messages].reverse() — messages DESC-dir, ASC-ə çevir (köhnə → yeni)
  // .NET: IEnumerable.Where(...).GroupBy(...)
  const grouped = useMemo(
    () => groupMessagesByDate([...messages].reverse(), readLaterMessageId, newMessagesStartId),
    [messages, readLaterMessageId, newMessagesStartId],
  );

  // senderRuns — ardıcıl eyni-sender mesajlarını qruplara ayır
  // Separator-lar ayrı item olaraq qalır, mesajlar sender-group run-larına bükülür
  // Bu, CSS sticky avatar üçün lazımdır
  const senderRuns = useMemo(() => {
    const runs = [];
    let currentRun = null;

    for (let i = 0; i < grouped.length; i++) {
      const item = grouped[i];
      // Separator-lar (date, readLater, newMessages) — run-u bitir, separator əlavə et
      if (item.type !== "message") {
        if (currentRun) { runs.push(currentRun); currentRun = null; }
        runs.push(item);
        continue;
      }
      const msg = item.data;
      const senderId = msg.senderId;
      // Eyni sender davam edir → mövcud run-a əlavə et
      if (currentRun && currentRun.senderId === senderId) {
        currentRun.messages.push(msg);
      } else {
        // Fərqli sender və ya ilk mesaj → yeni run başla
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

  // hasOthersSelected → useMessageSelection hook-unda (destructured)
  // favoriteIds, linkMessages, fileMessages → useSidebarPanels hook-unda (sidebar.*)

  // imageMessages — yalnız şəkillər, xronoloji sıra (köhnə → yeni, thumbnail strip üçün)
  const imageMessages = useMemo(() => {
    return sidebar.fileMessages.filter(f => f.isImage).reverse();
  }, [sidebar.fileMessages]);

  // handleOpenImageViewer — MessageBubble-dan çağırılır, şəkil klikləndikdə
  const handleOpenImageViewer = useCallback((msgId) => {
    const idx = imageMessages.findIndex(img => img.id === msgId);
    if (idx === -1) return;
    setImageViewer({ currentIndex: idx });
  }, [imageMessages]);

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

  // handleReaction — mesaja emoji reaksiyası əlavə et / ləğv et
  const handleReaction = useCallback(
    async (msg, emoji) => {
      if (!selectedChat) return;
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/${msg.id}/reactions/toggle`,
        );
        if (!endpoint) return;
        // DM → PUT, Channel → POST (backend API fərqi)
        const result =
          selectedChat.type === 0
            ? await apiPut(endpoint, { reaction: emoji })
            : await apiPost(endpoint, { reaction: emoji });
        // Optimistic UI — API-dən gələn reactions-ı dərhal state-ə tət
        const reactions = result.reactions || result;
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, reactions } : m)),
        );
      } catch (err) {
        console.error("Failed to toggle reaction:", err);
      }
    },
    [selectedChat],
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

  // --- JSX RENDER ---
  return (
    <div className="main-layout">
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
          onFindChatsWithUser={(otherUserId) => {
            sidebar.setShowSidebar(true);
            sidebar.handleOpenChatsWithUser(otherUserId, "context");
          }}
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

              {/* loadingOlder — yuxarı scroll edəndə köhnə mesajlar yüklənirkən spinner */}
              {loadingOlder && <div className="loading-older" />}

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

              {/* messages-area — scroll container */}
              <div
                className={`messages-area${chatLoading ? " hidden-loading" : ""}`}
                ref={messagesAreaRef}
                onScroll={handleScroll} // useChatScroll-dan gəlir
              >
                {/* Floating date — scroll zamanı cari tarixi yuxarıda göstər */}
                <div className="floating-date" ref={floatingDateRef} />

                {/* senderRuns — separator-lar + sender qrupları */}
                {senderRuns.map((run, runIdx) => {
                  // Separator-lar (date, readLater, newMessages) — olduğu kimi render et
                  if (run.type === "date") {
                    return (
                      <div key={`date-${runIdx}`} className="date-separator">
                        <span>{run.label}</span>
                      </div>
                    );
                  }
                  if (run.type === "readLater") {
                    return (
                      <div key="read-later" className="read-later-separator">
                        <span>Read later</span>
                      </div>
                    );
                  }
                  if (run.type === "newMessages") {
                    return (
                      <div key="new-messages" className="new-messages-separator">
                        <span>New messages</span>
                      </div>
                    );
                  }

                  // Sender run — ardıcıl eyni-sender mesajları
                  const { messages: runMsgs, isOwn, senderFullName } = run;
                  const runKey = `${run.senderId}-${runMsgs[0].id}`;

                  // Own mesajlar — wrapper lazım deyil, birbaşa render et
                  if (isOwn) {
                    return runMsgs.map((msg, msgIdx) => {
                      const showAvatar = msgIdx === runMsgs.length - 1;
                      return (
                        <MessageBubble
                          key={msg.id}
                          msg={msg}
                          isOwn
                          showAvatar={showAvatar}
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
                        />
                      );
                    });
                  }

                  // Non-own mesajlar — sender-group wrapper + sticky avatar
                  return (
                    <div key={runKey} className="sender-group">
                      {/* Sticky avatar — scroll zamanı qrupun daxilində aşağıda yapışıq qalır */}
                      <div className="sender-group-avatar" style={{ background: getAvatarColor(senderFullName) }}>
                        {getInitials(senderFullName)}
                      </div>
                      <div className="sender-group-messages">
                        {runMsgs.map((msg, msgIdx) => {
                          const showAvatar = msgIdx === runMsgs.length - 1;
                          return (
                            <MessageBubble
                              key={msg.id}
                              msg={msg}
                              isOwn={false}
                              showAvatar={showAvatar}
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
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {/* ChatStatusBar — mesajlarla birlikdə scroll edir */}
                <ChatStatusBar
                  selectedChat={selectedChat}
                  messages={messages}
                  userId={user.id}
                  typingUsers={typingUsers}
                  lastReadTimestamp={lastReadTimestamp}
                  channelMembers={channelMembers}
                  onOpenReadersPanel={setReadersPanel}
                />
                {/* messagesEndRef — ən alt boş div, scrollIntoView üçün hədəf */}
                <div ref={messagesEndRef} style={{ minHeight: 1, flexShrink: 0 }} />
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
                  uploadProgress={fileUpload.uploadProgress}
                  isUploading={fileUpload.isUploading}
                />
              )}

              {/* Tək mesaj silmə təsdiqləməsi — action menu-dan Delete basıldıqda */}
              {pendingDeleteMsg && (
                <div className="delete-confirm-overlay" onClick={() => setPendingDeleteMsg(null)}>
                  <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="delete-confirm-header">
                      <span>Do you want to delete this message?</span>
                      <button className="delete-confirm-close" onClick={() => setPendingDeleteMsg(null)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className="delete-confirm-actions">
                      <button
                        className="delete-confirm-btn"
                        onClick={() => {
                          handleDeleteMessage(pendingDeleteMsg);
                          setPendingDeleteMsg(null);
                        }}
                      >
                        DELETE
                      </button>
                      <button className="delete-cancel-btn" onClick={() => setPendingDeleteMsg(null)}>
                        CANCEL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Channel-dan ayrılma təsdiqləməsi */}
              {pendingLeaveChannel && (
                <div className="delete-confirm-overlay" onClick={() => setPendingLeaveChannel(null)}>
                  <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="delete-confirm-header">
                      <span>Are you sure you want to leave this channel?</span>
                      <button className="delete-confirm-close" onClick={() => setPendingLeaveChannel(null)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className="delete-confirm-actions">
                      <button
                        className="delete-confirm-btn"
                        onClick={() => {
                          handleLeaveChannel(pendingLeaveChannel);
                          setPendingLeaveChannel(null);
                          sidebar.setShowSidebar(false);
                        }}
                      >
                        LEAVE
                      </button>
                      <button className="delete-cancel-btn" onClick={() => setPendingLeaveChannel(null)}>
                        CANCEL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Conversation/channel silmə təsdiqləməsi */}
              {pendingDeleteConv && (
                <div className="delete-confirm-overlay" onClick={() => setPendingDeleteConv(null)}>
                  <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="delete-confirm-header">
                      <span>Are you sure you want to delete this chat?</span>
                      <button className="delete-confirm-close" onClick={() => setPendingDeleteConv(null)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                    <div className="delete-confirm-actions">
                      <button
                        className="delete-confirm-btn"
                        onClick={() => {
                          handleDeleteConversation(pendingDeleteConv);
                          setPendingDeleteConv(null);
                          sidebar.setShowSidebar(false);
                        }}
                      >
                        DELETE
                      </button>
                      <button className="delete-cancel-btn" onClick={() => setPendingDeleteConv(null)}>
                        CANCEL
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* forwardMessage varsa ForwardPanel-i göstər (modal overlay) */}
              {forwardMessage && (
                <ForwardPanel
                  conversations={conversations}
                  onForward={handleForward}
                  onClose={() => setForwardMessage(null)}
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
                  onClick={() => { channel.setShowAddMember(false); channel.setAddMemberSearch(""); channel.setAddMemberSearchActive(false); channel.setAddMemberSelected(new Set()); }}
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
                      const u = channel.addMemberUsers.find((x) => x.id === uid) || conversations.find((c) => c.otherUserId === uid);
                      const name = u?.fullName || u?.name || "User";
                      return (
                        <span key={uid} className="ds-am-chip">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z" /></svg>
                          {name}
                          <button
                            className="ds-am-chip-remove"
                            onClick={() => channel.setAddMemberSelected((prev) => { const next = new Set(prev); next.delete(uid); return next; })}
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
                {(() => {
                  const query = channel.addMemberSearch.trim();
                  const existingIds = channelMembers[selectedChat?.id]
                    ? new Set(Object.keys(channelMembers[selectedChat.id]))
                    : new Set();

                  // Axtarış varsa backend nəticələri, yoxdursa recent DM-lər
                  let users;
                  if (query.length >= 2) {
                    users = channel.addMemberSearchResults
                      .filter((u) => !existingIds.has(u.id))
                      .map((u) => ({
                        id: u.id,
                        fullName: u.fullName || `${u.firstName} ${u.lastName}`,
                        avatarUrl: u.avatarUrl,
                        position: u.position || "User",
                      }));
                  } else {
                    users = channel.addMemberUsers;
                  }

                  if (users.length === 0) {
                    return <div className="ds-am-empty">{query.length >= 2 ? "No matching users" : "No recent chats"}</div>;
                  }

                  return users.map((u) => {
                    const isSelected = channel.addMemberSelected.has(u.id);
                    return (
                      <div
                        key={u.id}
                        className={`ds-am-user${isSelected ? " selected" : ""}`}
                        onClick={() => {
                          channel.setAddMemberSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(u.id)) next.delete(u.id);
                            else next.add(u.id);
                            return next;
                          });
                          // User seçildikdə search input reset olsun
                          channel.setAddMemberSearch("");
                          channel.setAddMemberSearchActive(false);
                          channel.setAddMemberSearchResults([]);
                        }}
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
                  });
                })()}
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
                  onClick={() => { channel.setShowAddMember(false); channel.setAddMemberSearch(""); channel.setAddMemberSearchActive(false); channel.setAddMemberSelected(new Set()); }}
                >
                  CANCEL
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Chat;
