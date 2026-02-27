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

// Global auth state — user, logout
import { AuthContext } from "../context/AuthContext";

// API servis — HTTP metodları (GET, POST, PUT, DELETE)
import { apiGet, apiPost, apiPut, apiDelete } from "../services/api";

// UI komponentlər — hər biri ayrı bir visual blok
import Sidebar from "../components/Sidebar"; // sol nav bar
import ConversationList from "../components/ConversationList"; // söhbət siyahısı
import MessageBubble from "../components/MessageBubble"; // tək mesaj balonu
import ForwardPanel from "../components/ForwardPanel"; // mesaj yönləndir panel
import ChatHeader from "../components/ChatHeader"; // chat başlığı (ad, status)
import ChatInputArea from "../components/ChatInputArea"; // mesaj yazma sahəsi
import ChatStatusBar from "../components/ChatStatusBar"; // viewed/typing status bar
import ReadersPanel from "../components/ReadersPanel"; // oxuyanlar panel
import SelectToolbar from "../components/SelectToolbar"; // çox mesaj seç toolbar
import CreateChannelPanel from "../components/CreateChannelPanel"; // channel yaratma paneli
import PinnedBar, { PinnedExpanded } from "../components/PinnedBar"; // pinlənmiş mesajlar

// Util-lər və sabitlər
import {
  groupMessagesByDate, // mesajları tarixə görə qruplaşdır
  getChatEndpoint, // chat tipinə görə doğru API endpoint-i qaytar
  MESSAGE_PAGE_SIZE, // bir dəfədə neçə mesaj yükləmək
  CONVERSATION_PAGE_SIZE, // söhbət siyahısı səhifə ölçüsü
  HIGHLIGHT_DURATION_MS, // mesaj vurğulama müddəti (millisaniyə)
  TYPING_DEBOUNCE_MS, // typing siqnalı debounce müddəti
  BATCH_DELETE_THRESHOLD, // batch delete üçün minimum mesaj sayı
} from "../utils/chatUtils";

import "./Chat.css";

// Chat komponenti — əsas chat səhifəsi
// .NET ekvivalenti: @page "/" ilə ChatPage.razor
function Chat() {
  // --- AUTH ---
  // useContext ilə AuthContext-dən user və logout al
  const { user, logout } = useContext(AuthContext);

  // --- STATE DEĞİŞƏNLƏRİ ---

  // Söhbət siyahısı — sol paneldəki bütün chatlar
  const [conversations, setConversations] = useState([]);

  // Seçilmiş chat — sağ paneldə açıq olan söhbət
  // null olduqda "Select a chat" boş ekranı görünür
  const [selectedChat, setSelectedChat] = useState(null);

  // Channel yaratma paneli — true olduqda chat-panel-da CreateChannelPanel görsənir
  const [showCreateChannel, setShowCreateChannel] = useState(false);

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

  // selectMode — çox mesaj seçmə rejimi (true = SelectToolbar görünür)
  const [selectMode, setSelectMode] = useState(false);

  // selectedMessages — seçilmiş mesajların id-ləri (Set<messageId>)
  const [selectedMessages, setSelectedMessages] = useState(new Set());

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

  // deleteConfirmOpen — "Delete messages?" modal-ı açıq/bağlı (SelectToolbar — çox mesaj)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  // pendingDeleteMsg — action menu-dan tək mesaj silmə təsdiqləməsi
  const [pendingDeleteMsg, setPendingDeleteMsg] = useState(null);

  // inputRef — textarea element-i (focus vermək üçün)
  const inputRef = useRef(null);

  // lastReadTimestamp — DM: mesajın oxunma vaxtı (SignalR event-dən capture edilir)
  const [lastReadTimestamp, setLastReadTimestamp] = useState({});

  // channelMembers — channel üzvlərinin lookup map-i
  // { [channelId]: { [userId]: { fullName, avatarUrl } } }
  const [channelMembers, setChannelMembers] = useState({});

  // readersPanel — reader list panel state (null = bağlı)
  const [readersPanel, setReadersPanel] = useState(null);

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
  } = useChatScroll(messagesAreaRef, messages, selectedChat, setMessages, allReadPatchRef, floatingDateRef);

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
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      setShouldScrollBottom(false);
      return;
    }
    // Auto-scroll: istifadəçi artıq aşağıdadırsa və content dəyişibsə
    // (məs. viewed bar görsəndikdə) avtomatik aşağı düş
    const area = messagesAreaRef.current;
    if (area) {
      const distanceFromBottom =
        area.scrollHeight - area.scrollTop - area.clientHeight;
      if (distanceFromBottom < 80) {
        messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      }
    }
  }, [messages, shouldScrollBottom, pinnedMessages, channelMembers]);

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
  }, [messages]);

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
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages]);

  // IntersectionObserver — görünüş sahəsinə girən oxunmamış mesajları "read" et
  // observerRef — observer instance-ını saxla (yalnız selectedChat dəyişdikdə yenidən yarat)
  // processedMsgIdsRef — artıq "read" edilmiş mesajları izlə (dublikat API call qarşısını al)
  const observerRef = useRef(null);
  const processedMsgIdsRef = useRef(new Set());

  // ─── Batch mark-as-read — mesajları buferdə yığ, debounce ilə göndər ───
  // 25 individual request əvəzinə 2-3 batch (hər biri ~8-10 paralel request)
  const readBatchRef = useRef(new Set());       // gözləyən mesaj id-ləri
  const readBatchTimerRef = useRef(null);        // debounce timer (300ms)
  const readBatchChatRef = useRef(null);         // { chatId, chatType }

  // flushReadBatch — buferdəki mesajları paralel göndər və sıfırla
  // Çağırılır: (1) debounce bitəndə, (2) conversation dəyişdikdə, (3) unmount-da
  function flushReadBatch() {
    const ids = readBatchRef.current;
    const chatInfo = readBatchChatRef.current;
    if (ids.size === 0 || !chatInfo) return;

    const batch = [...ids];
    readBatchRef.current = new Set();
    if (readBatchTimerRef.current) {
      clearTimeout(readBatchTimerRef.current);
      readBatchTimerRef.current = null;
    }

    // Bütün mesajları paralel göndər (Promise.all)
    const { chatId, chatType } = chatInfo;
    Promise.all(
      batch.map((msgId) =>
        chatType === "0"
          ? apiPost(`/api/conversations/${chatId}/messages/${msgId}/read`)
          : apiPost(`/api/channels/${chatId}/messages/${msgId}/mark-as-read`),
      ),
    ).catch((err) => console.error("Failed to batch mark as read:", err));
  }

  // Effect 1: Observer yaratma/silmə — YALNIZ selectedChat dəyişdikdə
  useEffect(() => {
    const area = messagesAreaRef.current;
    if (!area || !selectedChat) return;

    // Yeni chat — köhnə processed set-i sıfırla
    processedMsgIdsRef.current = new Set();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const msgId = entry.target.dataset.msgId;
            const convId = entry.target.dataset.convId;
            const convType = entry.target.dataset.convType;

            // Dublikat yoxla — eyni mesaj üçün bir dəfə kifayətdir
            if (processedMsgIdsRef.current.has(msgId)) {
              observer.unobserve(entry.target);
              return;
            }
            processedMsgIdsRef.current.add(msgId);

            // Bufferə əlavə et — debounce ilə batch göndəriləcək
            readBatchRef.current.add(msgId);
            readBatchChatRef.current = { chatId: convId, chatType: convType };
            if (readBatchTimerRef.current) clearTimeout(readBatchTimerRef.current);
            readBatchTimerRef.current = setTimeout(flushReadBatch, 300);

            // Conversation list-dəki unreadCount-u azalt
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === convId && c.unreadCount > 0) {
                  return { ...c, unreadCount: c.unreadCount - 1 };
                }
                return c;
              }),
            );

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
    };
  }, [selectedChat]);

  // Effect 2: Yeni unread elementləri observe et — messages dəyişdikdə
  // Observer yenidən YARADILMIR, yalnız yeni elementlər əlavə olunur
  useEffect(() => {
    const observer = observerRef.current;
    const area = messagesAreaRef.current;
    if (!observer || !area) return;

    const unreadElements = area.querySelectorAll("[data-unread='true']");
    unreadElements.forEach((el) => {
      // Artıq processed olan mesajları izləmə
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
      setConversations((prev) =>
        prev.map((c) => c.id === conv.id ? { ...c, isPinned: result.isPinned } : c),
      );
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

  // handleHideConversation — conversation-ı siyahıdan gizlə
  async function handleHideConversation(conv) {
    try {
      const endpoint = conv.type === 1
        ? `/api/channels/${conv.id}/hide`
        : `/api/conversations/${conv.id}/messages/hide`;
      await apiPost(endpoint);
    } catch (err) {
      console.error("Failed to hide conversation:", err);
    }
    // API uğurlu və ya uğursuz olsa belə UI-dan sil
    // (backend-də artıq hide olub, UI sync olmalıdır)
    setConversations((prev) => prev.filter((c) => c.id !== conv.id));
    // Functional updater — closure problemini həll edir
    setSelectedChat((current) => {
      if (current && current.id === conv.id) {
        setMessages([]);
        return null;
      }
      return current;
    });
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
    setShowCreateChannel(true);
  }

  // handleCancelCreateChannel — panel bağlanır
  function handleCancelCreateChannel() {
    setShowCreateChannel(false);
  }

  // handleChannelCreated — channel uğurla yaradıldıqda çağırılır
  // channelData: backend-dən qaytarılan channel DTO
  async function handleChannelCreated(channelData) {
    // 1. Paneli bağla
    setShowCreateChannel(false);

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
      isArchived: channelData.isArchived,
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

  // handleSelectChat — istifadəçi sol siyahıdan bir chata klikləyəndə çağırılır
  // chat.type: 0 = DM Conversation, 1 = Channel, 2 = DepartmentUser
  async function handleSelectChat(chat) {
    // Eyni conversation-a yenidən klik → yalnız aşağıya scroll et, yenidən yükləmə
    if (selectedChat && selectedChat.id === chat.id) {
      setShouldScrollBottom(true);
      return;
    }

    // CreateChannel paneli açıqdırsa bağla
    setShowCreateChannel(false);

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
    setSelectedChat(chat);
    setMessages([]);
    setPinnedMessages([]);
    // unreadCount dərhal sıfırlanmır — IntersectionObserver mesajlar göründükcə 1-1 azaldır
    setPinBarExpanded(false);
    setCurrentPinIndex(0);
    setSelectMode(false);
    setSelectedMessages(new Set());
    setReplyTo(null);
    setEditMessage(null);
    setForwardMessage(null);
    setEmojiOpen(false);
    setDeleteConfirmOpen(false);
    setReadersPanel(null);
    setReadLaterMessageId(null); // Əvvəlki chatın read later mark-ını sıfırla
    setNewMessagesStartId(null); // Əvvəlki chatın new messages separator-ını sıfırla
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
            const members = await apiGet(`/api/channels/${chat.id}/members`);
            setChannelMembers((prev) => ({
              ...prev,
              [chat.id]: members.reduce((map, m) => {
                map[m.userId] = { fullName: m.fullName, avatarUrl: m.avatarUrl };
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
    }
  }

  // handleForward — ForwardPanel-dan chat seçilib, mesajı ora göndər
  async function handleForward(targetChat) {
    if (!forwardMessage) return;

    const fwd = forwardMessage;
    // Optimistic close — API cavabını gözləmədən paneli bağla (sürətli UI)
    setForwardMessage(null);

    try {
      // Yeni user (conversation yoxdur) → əvvəlcə conversation yarat
      let chatId = targetChat.id;
      let chatType = targetChat.type;
      if (targetChat.isNewUser) {
        const result = await apiPost("/api/conversations", {
          otherUserId: targetChat.userId,
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
          await apiPost(endpoint, { content: m.content, isForwarded: true });
        }
        handleExitSelectMode(); // Select mode-dan çıx
      } else {
        // Tək mesaj forward
        await apiPost(endpoint, { content: fwd.content, isForwarded: true });
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

  // handleFavoriteMessage — mesajı favorilərə əlavə et / çıxar
  const handleFavoriteMessage = useCallback(
    async (msg) => {
      if (!selectedChat) return;
      try {
        const endpoint = getChatEndpoint(
          selectedChat.id,
          selectedChat.type,
          `/messages/${msg.id}/favorite`,
        );
        if (!endpoint) return;
        await apiPost(endpoint);
      } catch (err) {
        console.error("Failed to toggle favorite:", err);
      }
    },
    [selectedChat],
  );

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

  // --- SELECT MODE HANDLER-LƏRI ---

  // handleEnterSelectMode — ilk mesajı seçdikdə select mode başlasın
  // useCallback([]) — heç bir dependency yoxdur, funksiya heç vaxt dəyişmir
  const handleEnterSelectMode = useCallback((msgId) => {
    setSelectMode(true);
    setSelectedMessages(new Set([msgId])); // İlk seçilmiş mesaj
  }, []);

  // handleToggleSelect — mesajı seç / seçimi ləğv et
  const handleToggleSelect = useCallback((msgId) => {
    setSelectedMessages((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) {
        next.delete(msgId);
      } else {
        next.add(msgId);
      }
      return next;
    });
  }, []);

  // handleExitSelectMode — select mode-dan çıx, seçimləri sıfırla
  const handleExitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedMessages(new Set());
  }, []);

  // handleForwardSelected — seçilmiş mesajları forward et
  const handleForwardSelected = useCallback(() => {
    if (selectedMessages.size === 0) return;
    // isMultiSelect:true + ids — ForwardPanel-ə çoxlu mesaj forwardı bildir
    setForwardMessage({ isMultiSelect: true, ids: [...selectedMessages] });
  }, [selectedMessages]);

  // handleDeleteMessage — tək mesajı sil (action menu-dan çağırılır)
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
        await apiDelete(endpoint);
        // Soft delete — mesajı array-dən çıxarmırıq, isDeleted: true edirik
        // UI-da "This message was deleted." göstəriləcək
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? { ...m, isDeleted: true } : m)),
        );
      } catch (err) {
        console.error("Failed to delete message:", err);
      }
    },
    [selectedChat],
  );

  // handleDeleteSelected — seçilmiş bütün mesajları sil (SelectToolbar-dan)
  const handleDeleteSelected = useCallback(async () => {
    if (!selectedChat || selectedMessages.size === 0) return;
    try {
      const ids = [...selectedMessages]; // Set → Array
      const base = getChatEndpoint(
        selectedChat.id,
        selectedChat.type,
        "/messages",
      );
      if (!base) return;

      // Çox mesaj varsa batch delete, azdırsa paralel individual delete
      // BATCH_DELETE_THRESHOLD — konfiqurasiya edilə bilən limit
      if (ids.length > BATCH_DELETE_THRESHOLD) {
        await apiPost(`${base}/batch-delete`, { messageIds: ids });
      } else {
        // Promise.all — bütün silmə request-lərini paralel göndər
        await Promise.all(ids.map((id) => apiDelete(`${base}/${id}`)));
      }

      // Soft delete — hamısını isDeleted: true et
      setMessages((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, isDeleted: true } : m)),
      );
      handleExitSelectMode();
    } catch (err) {
      console.error("Failed to delete selected messages:", err);
    }
  }, [selectedChat, selectedMessages, handleExitSelectMode]);

  // handlePinBarClick — PinnedBar-a klik edildikdə
  // 1) Həmin mesaja scroll et, 2) Növbəti pin-ə keç
  function handlePinBarClick(messageId) {
    handleScrollToMessage(messageId);
    // Modulo əməliyyatı — axırıncı pin-dən sonra birinciyə qayıt (circular)
    setCurrentPinIndex((prev) =>
      prev >= pinnedMessages.length - 1 ? 0 : prev + 1,
    );
  }

  // handleSendMessage — mesaj göndər (Enter / Send button)
  async function handleSendMessage() {
    // Boş mesaj göndərmə
    if (!messageText.trim() || !selectedChat) return;

    const text = messageText.trim();
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

    // Textarea hündürlüyünü yenidən başlanğıc ölçüyə gətir
    const textarea = document.querySelector(".message-input");
    if (textarea) textarea.style.height = "auto";

    // --- EDIT MODE ---
    if (editMessage) {
      const editingMsg = editMessage;
      setEditMessage(null); // Edit mode-dan çıx
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

      // POST /api/conversations/{id}/messages — yeni mesaj göndər
      await apiPost(endpoint, {
        content: text,
        replyToMessageId: replyTo ? replyTo.id : null, // Reply varsa id-ni göndər
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

  // Emoji panelinin kənarına klikləndikdə bağla
  // emojiOpen=true olduqda event listener-i qeydiyyata al,
  // emojiOpen=false olduqda yenidən sil (cleanup funksiyası)
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        emojiPanelRef.current &&
        !emojiPanelRef.current.contains(e.target) && // Klik panelin içərisindədirsə bağlama
        !e.target.closest(".emoji-btn") // Emoji button-una klik → toggle edir
      ) {
        setEmojiOpen(false);
      }
    }
    if (emojiOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [emojiOpen]);

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
    [selectedChat],
  );

  // handleKeyDown — textarea-da klaviatura hadisəsi
  // Enter → mesaj göndər (Shift+Enter → yeni sətir)
  function handleKeyDown(e) {
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

  // grouped — mesajları tarix separator-ları ilə qruplaşdır
  // useMemo — messages dəyişmədikdə bu hesablamanı yenidən etmə
  // [...messages].reverse() — messages DESC-dir, ASC-ə çevir (köhnə → yeni)
  // .NET: IEnumerable.Where(...).GroupBy(...)
  const grouped = useMemo(
    () => groupMessagesByDate([...messages].reverse(), readLaterMessageId, newMessagesStartId),
    [messages, readLaterMessageId, newMessagesStartId],
  );

  // hasOthersSelected — seçilmiş mesajların arasında başqasının mesajı varmı?
  // true olduqda Delete button deaktiv olur
  const hasOthersSelected = useMemo(() => {
    if (selectedMessages.size === 0) return false;
    return [...selectedMessages].some((id) => {
      const m = messages.find((msg) => msg.id === id);
      return m && m.senderId !== user.id; // Başqasının mesajıdırsa true
    });
  }, [selectedMessages, messages, user.id]);

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
    setTimeout(() => inputRef.current?.focus(), 0);
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
          onHide={handleHideConversation}
          onLeaveChannel={handleLeaveChannel}
        />

        {/* chat-panel — sağ panel, mesajlar */}
        <div className="chat-panel">
          {/* showCreateChannel → panel, selectedChat → chat, əks halda empty */}
          {showCreateChannel ? (
            <CreateChannelPanel
              onCancel={handleCancelCreateChannel}
              onChannelCreated={handleChannelCreated}
              currentUser={user}
            />
          ) : selectedChat ? (
            <>
              {/* ChatHeader — chat adı, online status */}
              <ChatHeader
                selectedChat={selectedChat}
                onlineUsers={onlineUsers}
                pinnedMessages={pinnedMessages}
                onTogglePinExpand={() => setPinBarExpanded((v) => !v)}
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

              {/* messages-area — scroll container */}
              <div
                className="messages-area"
                ref={messagesAreaRef}
                onScroll={handleScroll} // useChatScroll-dan gəlir
              >
                {/* Floating date — scroll zamanı cari tarixi yuxarıda göstər */}
                <div className="floating-date" ref={floatingDateRef} />

                {/* grouped — [{type:"date", label:"..."}, {type:"message", data:{...}}, ...] */}
                {grouped.map((item, index) => {
                  if (item.type === "date") {
                    // Tarix separator — "Today", "Yesterday", "18 Feb 2026"
                    return (
                      <div key={`date-${index}`} className="date-separator">
                        <span>{item.label}</span>
                      </div>
                    );
                  }
                  if (item.type === "readLater") {
                    // Read later separator — işarələnmiş mesajdan əvvəl göstərilir
                    return (
                      <div key="read-later" className="read-later-separator">
                        <span>Read later</span>
                      </div>
                    );
                  }
                  if (item.type === "newMessages") {
                    // New messages separator — ilk oxunmamış mesajdan əvvəl göstərilir
                    return (
                      <div key="new-messages" className="new-messages-separator">
                        <span>New messages</span>
                      </div>
                    );
                  }
                  const msg = item.data;
                  // isOwn — bu mesaj cari istifadəçinindirsə true
                  const isOwn = msg.senderId === user.id;

                  // showAvatar — avatar yalnız "son" mesajda görünür
                  // Növbəti item fərqli senderdirsə və ya date separator-dursa → true
                  const nextItem = grouped[index + 1];
                  const showAvatar =
                    !nextItem ||
                    nextItem.type === "date" ||
                    nextItem.type === "readLater" ||
                    nextItem.type === "newMessages" ||
                    nextItem.data.senderId !== msg.senderId;

                  return (
                    <MessageBubble
                      key={msg.id} // React-ın list key-i
                      msg={msg}
                      isOwn={isOwn}
                      showAvatar={showAvatar}
                      chatType={selectedChat.type}
                      selectMode={selectMode}
                      isSelected={selectedMessages.has(msg.id)}
                      onReply={handleReply}
                      onForward={handleForwardMsg}
                      onPin={handlePinMessage}
                      onFavorite={handleFavoriteMessage}
                      onMarkLater={handleMarkLater}
                      readLaterMessageId={readLaterMessageId}
                      onSelect={handleEnterSelectMode}
                      onToggleSelect={handleToggleSelect}
                      onScrollToMessage={handleScrollToMessage}
                      onDelete={setPendingDeleteMsg}
                      onEdit={handleEditMsg}
                      onReaction={handleReaction}
                      onLoadReactionDetails={handleLoadReactionDetails}
                    />
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
      </div>
    </div>
  );
}

export default Chat;
