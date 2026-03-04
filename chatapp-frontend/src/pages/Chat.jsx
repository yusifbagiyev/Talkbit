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
  getAvatarColor, // avatar rəngi (hash-based)
  getInitials, // addan 2 hərf (avatar mətni)
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
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState(""); // Add member search mətni
  const [addMemberSearchActive, setAddMemberSearchActive] = useState(false); // Search input açıq/bağlı
  const [addMemberSelected, setAddMemberSelected] = useState(new Set()); // Seçilmiş istifadəçi id-ləri
  const [addMemberInviting, setAddMemberInviting] = useState(false); // INVITE prosesi davam edir
  const [addMemberSearchResults, setAddMemberSearchResults] = useState([]); // Backend axtarış nəticələri
  const [addMemberShowHistory, setAddMemberShowHistory] = useState(true); // Show chat history checkbox
  const [showSidebar, setShowSidebar] = useState(false);
  const [showSidebarMenu, setShowSidebarMenu] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [favMenuId, setFavMenuId] = useState(null); // Favorite mesajın more menu-su açıq olan mesaj id-si
  const [favSearchOpen, setFavSearchOpen] = useState(false); // Favorites search input açıq/bağlı
  const [favSearchText, setFavSearchText] = useState(""); // Favorites axtarış mətni
  const [showAllLinks, setShowAllLinks] = useState(false); // All links paneli açıq/bağlı
  const [linksMenuId, setLinksMenuId] = useState(null); // Link mesajın more menu-su açıq olan mesaj id-si
  const [linksSearchOpen, setLinksSearchOpen] = useState(false); // Links search input açıq/bağlı
  const [linksSearchText, setLinksSearchText] = useState(""); // Links axtarış mətni
  const [showChatsWithUser, setShowChatsWithUser] = useState(false); // Chats with user paneli açıq/bağlı
  const [chatsWithUserData, setChatsWithUserData] = useState([]); // Ortaq kanallar siyahısı
  // "sidebar" → sidebar-dan açılıb (back butonu, conv dəyişsə bağlanır)
  // "context" → ConversationList-dən açılıb (X butonu, conv dəyişsə bağlanmır)
  const [chatsWithUserSource, setChatsWithUserSource] = useState(null);
  const [showFilesMedia, setShowFilesMedia] = useState(false); // Files & Media paneli açıq/bağlı
  const [filesMediaTab, setFilesMediaTab] = useState("media"); // Aktiv tab: "media" / "files"
  const [filesMenuId, setFilesMenuId] = useState(null); // Fayl more menu açıq olan id
  const [filesSearchOpen, setFilesSearchOpen] = useState(false); // Files search input açıq/bağlı
  const [filesSearchText, setFilesSearchText] = useState(""); // Files axtarış mətni
  const [showMembersPanel, setShowMembersPanel] = useState(false); // Members paneli açıq/bağlı
  const [memberMenuId, setMemberMenuId] = useState(null); // Üzv context menu açıq olan userId

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
  const sidebarMenuRef = useRef(null);
  const favMenuRef = useRef(null);
  const linksMenuRef = useRef(null);
  const filesMenuRef = useRef(null);
  const addMemberRef = useRef(null); // Add member panel click-outside ref
  const memberMenuRef = useRef(null); // Member context menu click-outside ref

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

  // handleOpenChatsWithUser — ortaq kanalları yüklə və paneli aç
  // source: "sidebar" (sidebar-dan) və ya "context" (ConversationList-dən)
  async function handleOpenChatsWithUser(otherUserId, source = "sidebar") {
    if (!otherUserId) return;
    setChatsWithUserSource(source);
    setShowChatsWithUser(true);
    try {
      const data = await apiGet(`/api/channels/shared/${otherUserId}`);
      setChatsWithUserData(data || []);
    } catch {
      setChatsWithUserData([]);
    }
  }

  // handleInviteMembers — seçilmiş istifadəçiləri channel-ə əlavə et
  async function handleInviteMembers() {
    if (addMemberSelected.size === 0 || !selectedChat) return;
    setAddMemberInviting(true);
    try {
      for (const userId of addMemberSelected) {
        await apiPost(`/api/channels/${selectedChat.id}/members`, {
          userId,
          showChatHistory: addMemberShowHistory,
        });
      }
      // Üzvləri yenidən yüklə
      const members = await apiGet(`/api/channels/${selectedChat.id}/members`);
      setChannelMembers((prev) => ({
        ...prev,
        [selectedChat.id]: members.reduce((map, m) => ({ ...map, [m.userId]: m }), {}),
      }));
      // Paneli bağla və state-ləri təmizlə
      setShowAddMember(false);
      setAddMemberSearch("");
      setAddMemberSearchActive(false);
      setAddMemberSelected(new Set());
      setAddMemberShowHistory(true);
    } catch (err) {
      console.error("Failed to invite members:", err);
    } finally {
      setAddMemberInviting(false);
    }
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
    setShowFavorites(false);
    setFavMenuId(null);
    setFavSearchOpen(false);
    setFavSearchText("");
    setShowAllLinks(false);
    setLinksMenuId(null);
    setLinksSearchOpen(false);
    setLinksSearchText("");
    // Chats with user — source-a görə bağlama qərarı:
    // "sidebar" → conversation dəyişdikdə bağlanır
    // "context" → conversation dəyişdikdə bağlanmır
    if (chatsWithUserSource === "sidebar") {
      setShowChatsWithUser(false);
      setChatsWithUserData([]);
      setChatsWithUserSource(null);
    }
    setShowFilesMedia(false);
    setFilesMediaTab("media");
    setFilesMenuId(null);
    setFilesSearchOpen(false);
    setFilesSearchText("");
    setShowMembersPanel(false);
    setMemberMenuId(null);
    setShowAddMember(false);
    setAddMemberSearch("");
    setAddMemberSearchActive(false);
    setAddMemberSelected(new Set());
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

  // Sidebar more menu — kənarına klikləndikdə bağla
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        sidebarMenuRef.current &&
        !sidebarMenuRef.current.contains(e.target)
      ) {
        setShowSidebarMenu(false);
      }
    }
    if (showSidebarMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showSidebarMenu]);

  // Favorite mesaj more menu — click-outside
  useEffect(() => {
    if (!favMenuId) return;
    function handleClickOutside(e) {
      if (favMenuRef.current && !favMenuRef.current.contains(e.target)) {
        setFavMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [favMenuId]);

  // Links more menu — click-outside
  useEffect(() => {
    if (!linksMenuId) return;
    function handleClickOutside(e) {
      if (linksMenuRef.current && !linksMenuRef.current.contains(e.target)) {
        setLinksMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [linksMenuId]);

  // Files more menu — click-outside
  useEffect(() => {
    if (!filesMenuId) return;
    function handleClickOutside(e) {
      if (filesMenuRef.current && !filesMenuRef.current.contains(e.target)) {
        setFilesMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [filesMenuId]);

  // Member context menu — click-outside
  useEffect(() => {
    if (!memberMenuId) return;
    function handleClickOutside(e) {
      if (memberMenuRef.current && !memberMenuRef.current.contains(e.target)) {
        setMemberMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [memberMenuId]);

  // Add member panel — click-outside bağlama
  useEffect(() => {
    if (!showAddMember) return;
    function handleClickOutside(e) {
      if (addMemberRef.current && !addMemberRef.current.contains(e.target)) {
        setShowAddMember(false);
        setAddMemberSearch("");
        setAddMemberSearchActive(false);
        setAddMemberSelected(new Set());
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddMember]);

  // Add member panel açılanda — channel members-i yenilə (leave/remove dəyişikliklərini göstər)
  useEffect(() => {
    if (!showAddMember || !selectedChat || selectedChat.type !== 1) return;
    (async () => {
      try {
        const members = await apiGet(`/api/channels/${selectedChat.id}/members`);
        setChannelMembers((prev) => ({
          ...prev,
          [selectedChat.id]: members.reduce((map, m) => ({ ...map, [m.userId]: m }), {}),
        }));
      } catch { /* ignore */ }
    })();
  }, [showAddMember]);

  // Add member panel — debounced backend user search
  useEffect(() => {
    const query = addMemberSearch.trim();
    if (query.length < 2) {
      setAddMemberSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const data = await apiGet(`/api/users/search?q=${encodeURIComponent(query)}`);
        setAddMemberSearchResults(data || []);
      } catch {
        setAddMemberSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [addMemberSearch]);

  // Sidebar açılanda channel members yüklə
  useEffect(() => {
    if (!showSidebar || !selectedChat || selectedChat.type !== 1) return;
    // Həmişə yenidən fetch et — closure stale state problemini aradan qaldırır
    (async () => {
      try {
        const members = await apiGet(`/api/channels/${selectedChat.id}/members`);
        setChannelMembers((prev) => ({
          ...prev,
          [selectedChat.id]: members.reduce((map, m) => {
            map[m.userId] = { fullName: m.fullName, avatarUrl: m.avatarUrl, role: m.role };
            return map;
          }, {}),
        }));
      } catch (err) {
        console.error("Failed to load channel members for sidebar:", err);
      }
    })();
  }, [showSidebar, selectedChat?.id]);

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

  // URL regex — mesaj content-indən linkləri çıxarmaq üçün
  // Hər mesajdan bütün URL-ləri tapır, hər URL üçün ayrı obyekt qaytarır
  const linkMessages = useMemo(() => {
    const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
    const results = [];
    for (const msg of messages) {
      if (!msg.content) continue;
      const urls = msg.content.match(urlRegex);
      if (!urls) continue;
      for (const url of urls) {
        let domain = "";
        try { domain = new URL(url).hostname; } catch { domain = url; }
        results.push({
          id: msg.id,
          url,
          domain,
          senderFullName: msg.senderFullName,
          senderAvatarUrl: msg.senderAvatarUrl,
          createdAtUtc: msg.createdAtUtc,
        });
      }
    }
    // Yeni → köhnə sıralaması (DESC)
    return results.sort((a, b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc));
  }, [messages]);

  // fileMessages — mesajlardan fayl olan mesajları çıxarır
  // Media (şəkil) və Files (digər fayllar) olaraq ayrılır
  const fileMessages = useMemo(() => {
    const results = [];
    for (const msg of messages) {
      if (!msg.fileId || msg.isDeleted) continue;
      const isImage = msg.fileContentType?.startsWith("image/");
      results.push({
        id: msg.id,
        fileId: msg.fileId,
        fileName: msg.fileName,
        fileContentType: msg.fileContentType,
        fileSizeInBytes: msg.fileSizeInBytes,
        fileUrl: msg.fileUrl,
        thumbnailUrl: msg.thumbnailUrl,
        isImage,
        senderFullName: msg.senderFullName,
        senderAvatarUrl: msg.senderAvatarUrl,
        createdAtUtc: msg.createdAtUtc,
      });
    }
    return results.sort((a, b) => new Date(b.createdAtUtc) - new Date(a.createdAtUtc));
  }, [messages]);

  // Add member paneli üçün — DM conversationlardan artıq üzv olmayanları göstər
  const addMemberUsers = useMemo(() => {
    if (!showAddMember || !selectedChat) return [];
    const existingIds = channelMembers[selectedChat.id]
      ? new Set(Object.keys(channelMembers[selectedChat.id]))
      : new Set();
    return conversations
      .filter((c) => c.type === 0 && !c.isNotes && c.otherUserId && !existingIds.has(c.otherUserId))
      .map((c) => ({
        id: c.otherUserId,
        fullName: c.name,
        avatarUrl: c.avatarUrl,
        position: c.otherUserPosition || "User",
      }));
  }, [showAddMember, selectedChat, conversations, channelMembers]);

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
          onFindChatsWithUser={(otherUserId) => {
            setShowSidebar(true);
            handleOpenChatsWithUser(otherUserId, "context");
          }}
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
              {/* ChatHeader — chat adı, online status, action düymələr */}
              <ChatHeader
                selectedChat={selectedChat}
                onlineUsers={onlineUsers}
                pinnedMessages={pinnedMessages}
                onTogglePinExpand={() => setPinBarExpanded((v) => !v)}
                onOpenAddMember={() => setShowAddMember(true)}
                onToggleSidebar={() => setShowSidebar((v) => !v)}
                sidebarOpen={showSidebar}
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

        {/* Detail Sidebar — Bitrix24 stilində sağ panel */}
        {showSidebar && selectedChat && (
          <div className="detail-sidebar">
            {/* Header — X close + About chat + ... more */}
            <div className="ds-header">
              <button className="ds-close" onClick={() => { setShowSidebar(false); setShowFavorites(false); setFavSearchOpen(false); setFavSearchText(""); setShowAllLinks(false); setLinksSearchOpen(false); setLinksSearchText(""); setShowChatsWithUser(false); setChatsWithUserData([]); setChatsWithUserSource(null); setShowFilesMedia(false); setFilesSearchOpen(false); setFilesSearchText(""); setShowMembersPanel(false); setMemberMenuId(null); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
              <span className="ds-header-title">About chat</span>
              <div className="ds-more-wrap" ref={sidebarMenuRef}>
                <button
                  className="ds-more-btn"
                  onClick={() => setShowSidebarMenu((v) => !v)}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="5" cy="12" r="2" />
                    <circle cx="12" cy="12" r="2" />
                    <circle cx="19" cy="12" r="2" />
                  </svg>
                </button>
                {showSidebarMenu && (
                  <div className="ds-dropdown">
                    <button className="ds-dropdown-item" onClick={() => { handleTogglePin(selectedChat); setShowSidebarMenu(false); }}>
                      {selectedChat.isPinned ? "Unpin" : "Pin"}
                    </button>

                    {selectedChat.isNotes ? (
                      <>
                        <button className="ds-dropdown-item" onClick={() => setShowSidebarMenu(false)}>View profile</button>
                        <button className="ds-dropdown-item" onClick={() => { handleHideConversation(selectedChat); setShowSidebarMenu(false); setShowSidebar(false); }}>Hide</button>
                      </>
                    ) : selectedChat.type === 0 ? (
                      <>
                        <button className="ds-dropdown-item" onClick={() => setShowSidebarMenu(false)}>View profile</button>
                        <button className="ds-dropdown-item" onClick={() => { setShowSidebarMenu(false); handleOpenChatsWithUser(selectedChat.otherUserId, "sidebar"); }}>Find chats with this user</button>
                        <button className="ds-dropdown-item" onClick={() => { handleHideConversation(selectedChat); setShowSidebarMenu(false); setShowSidebar(false); }}>Hide</button>
                        <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => setShowSidebarMenu(false)}>Delete</button>
                      </>
                    ) : (
                      <>
                        {channelMembers[selectedChat.id]?.[user.id]?.role >= 2 && (
                          <button className="ds-dropdown-item" onClick={() => { setShowAddMember(true); setShowSidebarMenu(false); }}>Add members</button>
                        )}
                        {channelMembers[selectedChat.id]?.[user.id]?.role >= 2 && (
                          <button className="ds-dropdown-item" onClick={() => setShowSidebarMenu(false)}>Edit</button>
                        )}
                        <button className="ds-dropdown-item" onClick={() => { handleHideConversation(selectedChat); setShowSidebarMenu(false); setShowSidebar(false); }}>Hide</button>
                        <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => { handleLeaveChannel(selectedChat); setShowSidebarMenu(false); setShowSidebar(false); }}>Leave</button>
                        <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => setShowSidebarMenu(false)}>Delete</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scrollable body */}
            <div className="ds-body">
              {/* Profil kartı — vertikal: avatar → ad → position → create group → sound */}
              <div className="ds-card">
                <div className="ds-profile">
                  {selectedChat.isNotes ? (
                    <div className="ds-avatar ds-avatar-notes">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                  ) : (
                    <div className="ds-avatar" style={{ background: getAvatarColor(selectedChat.name) }}>
                      {getInitials(selectedChat.name)}
                    </div>
                  )}
                  <div className="ds-name">{selectedChat.name}</div>
                  {/* Channel — üzv avatarları */}
                  {selectedChat.type === 1 ? (
                    channelMembers[selectedChat.id] ? (
                      <div className="ds-members-preview" role="button" tabIndex={0} onClick={() => setShowMembersPanel(true)}>
                        <div className="ds-members-avatars">
                          {Object.entries(channelMembers[selectedChat.id]).slice(0, 4).map(([uid, m]) => (
                            <div
                              key={uid}
                              className="ds-members-avatar"
                              style={{ background: getAvatarColor(m.fullName) }}
                              title={m.fullName}
                            >
                              {getInitials(m.fullName)}
                            </div>
                          ))}
                          {Object.keys(channelMembers[selectedChat.id]).length > 4 && (
                            <span className="ds-members-more">
                              +{Object.keys(channelMembers[selectedChat.id]).length - 4}
                            </span>
                          )}
                          <button className="ds-members-add-btn" onClick={(e) => { e.stopPropagation(); setShowAddMember(true); }}>+ Add</button>
                        </div>
                      </div>
                    ) : (
                      <div className="ds-role">{selectedChat.memberCount || 0} members</div>
                    )
                  ) : (
                    <div className="ds-role">
                      {selectedChat.isNotes
                        ? "Visible to you only"
                        : selectedChat.otherUserPosition || selectedChat.otherUserRole || "User"}
                    </div>
                  )}
                </div>

                {/* Sound toggle — Notes üçün görünmür */}
                {!selectedChat.isNotes && (
                  <div className="ds-toggle-row">
                      <svg className="ds-toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5">
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" fill="none" stroke="currentColor" strokeWidth="1.8" />
                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" fill="none" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                      <span className="ds-toggle-label">Sound</span>
                      <label className="ds-switch">
                        <input
                          type="checkbox"
                          checked={!selectedChat.isMuted}
                          onChange={() => handleToggleMute(selectedChat)}
                        />
                        <span className="ds-switch-track" />
                      </label>
                    </div>
                )}
              </div>

              {/* Info kartı */}
              <div className="ds-card">
                {/* Chat tipi — User / Group chat */}
                <div className="ds-info-row">
                  <svg className="ds-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <span className="ds-info-label">
                    {selectedChat.isNotes
                      ? "A scratchpad to keep important messages, files and links in one place."
                      : selectedChat.type === 1 ? "Group chat" : "User"}
                  </span>
                </div>

                {/* Favorite messages */}
                <div
                  className="ds-info-row ds-info-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowFavorites(true)}
                >
                  <svg className="ds-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  <span className="ds-info-link">Favorite messages</span>
                  <span className="ds-badge">{pinnedMessages.length}</span>
                </div>

                {/* All links */}
                <div
                  className="ds-info-row ds-info-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setShowAllLinks(true)}
                >
                  <svg className="ds-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <span className="ds-info-link">All links</span>
                  <span className="ds-badge">{linkMessages.length}</span>
                </div>

                {/* Chats with user — yalnız DM (type=0) üçün */}
                {selectedChat.type === 0 && !selectedChat.isNotes && (
                  <div
                    className="ds-info-row ds-info-clickable"
                    role="button"
                    tabIndex={0}
                    onClick={() => handleOpenChatsWithUser(selectedChat.otherUserId, "sidebar")}
                  >
                      <svg className="ds-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15 3H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v2l2.6-2H15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z" />
                        <path d="M19 9v4a2 2 0 0 1-2 2h-1.4L13 17v-2h-3v1a2 2 0 0 0 2 2h4.4L19 20v-2h1a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1z" />
                      </svg>
                      <span className="ds-info-link">Chats with user</span>
                      <svg className="ds-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                )}
              </div>

              {/* Files and media — klikləndikdə panel açılır */}
              <div className="ds-card ds-files-card" onClick={() => setShowFilesMedia(true)}>
                <div className="ds-files-header">
                  <span className="ds-files-title">Files and media</span>
                  <svg className="ds-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Favorite messages paneli — sidebar-ın üstünə gəlir */}
            {showFavorites && (
              <div className="ds-favorites-panel">
                <div className="ds-favorites-header">
                  <button className="ds-favorites-back" onClick={() => { setShowFavorites(false); setFavMenuId(null); setFavSearchOpen(false); setFavSearchText(""); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {/* Search açıqdırsa input göstər, deyilsə title göstər */}
                  {favSearchOpen ? (
                    <input
                      className="ds-favorites-search-input"
                      type="text"
                      placeholder="Search favorites..."
                      value={favSearchText}
                      onChange={(e) => setFavSearchText(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setFavSearchOpen(false);
                          setFavSearchText("");
                        }
                      }}
                    />
                  ) : (
                    <span className="ds-favorites-title">Favorite messages</span>
                  )}
                  {/* Search açıqdırsa X (bağla), deyilsə search iconu */}
                  {favSearchOpen ? (
                    <button
                      className="ds-favorites-search-btn active"
                      title="Close search"
                      onClick={() => { setFavSearchOpen(false); setFavSearchText(""); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="ds-favorites-search-btn"
                      title="Search"
                      onClick={() => setFavSearchOpen(true)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="ds-favorites-list">
                  {(() => {
                    // Axtarış mətninə görə filterlə
                    const query = favSearchText.trim().toLowerCase();
                    const filtered = query
                      ? pinnedMessages.filter((m) => m.content?.toLowerCase().includes(query))
                      : pinnedMessages;

                    if (filtered.length === 0) {
                      return (
                        <div className="ds-favorites-empty">
                          {query ? "No matching messages" : "No favorite messages"}
                        </div>
                      );
                    }

                    return filtered.map((msg, idx) => {
                      const msgDate = new Date(msg.createdAtUtc).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                      // filtered array-dəki əvvəlki mesajın tarixi ilə müqayisə et
                      const prevDate = idx > 0
                        ? new Date(filtered[idx - 1].createdAtUtc).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : null;
                      const showDate = idx === 0 || msgDate !== prevDate;

                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="ds-favorites-date"><span>{msgDate}</span></div>
                          )}
                          <div
                            className="ds-favorites-item"
                            onClick={() => {
                              handleScrollToMessage(msg.id);
                              setFavMenuId(null);
                            }}
                          >
                            <div
                              className="ds-favorites-avatar"
                              style={{ background: getAvatarColor(msg.senderFullName) }}
                            >
                              {msg.senderAvatarUrl ? (
                                <img src={msg.senderAvatarUrl} alt="" className="ds-favorites-avatar-img" />
                              ) : (
                                getInitials(msg.senderFullName)
                              )}
                            </div>
                            <div className="ds-favorites-body">
                              <span className="ds-favorites-sender">{msg.senderFullName}</span>
                              <span className="ds-favorites-text">
                                {/* Axtarış varsa — uyğun gələn hissəni sarı highlight et */}
                                {query && msg.content ? (() => {
                                  const lowerContent = msg.content.toLowerCase();
                                  const parts = [];
                                  let lastIdx = 0;
                                  let searchIdx = lowerContent.indexOf(query, lastIdx);
                                  while (searchIdx !== -1) {
                                    if (searchIdx > lastIdx) parts.push(msg.content.slice(lastIdx, searchIdx));
                                    parts.push(<mark key={searchIdx}>{msg.content.slice(searchIdx, searchIdx + query.length)}</mark>);
                                    lastIdx = searchIdx + query.length;
                                    searchIdx = lowerContent.indexOf(query, lastIdx);
                                  }
                                  if (lastIdx < msg.content.length) parts.push(msg.content.slice(lastIdx));
                                  return parts;
                                })() : msg.content}
                              </span>
                            </div>
                            {/* More menu — hover-də görünür */}
                            <div
                              className="ds-favorites-more-wrap"
                              ref={favMenuId === msg.id ? favMenuRef : null}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="ds-favorites-more-btn"
                                onClick={() => setFavMenuId(favMenuId === msg.id ? null : msg.id)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                              {favMenuId === msg.id && (
                                <div className="ds-dropdown">
                                  <button
                                    className="ds-dropdown-item"
                                    onClick={() => {
                                      handleScrollToMessage(msg.id);
                                      setFavMenuId(null);
                                    }}
                                  >
                                    View context
                                  </button>
                                  <button
                                    className="ds-dropdown-item ds-dropdown-danger"
                                    onClick={() => {
                                      handlePinMessage({ ...msg, isPinned: true });
                                      setFavMenuId(null);
                                    }}
                                  >
                                    Remove from Favorites
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* All links paneli — sidebar-ın üstünə gəlir */}
            {showAllLinks && (
              <div className="ds-favorites-panel">
                <div className="ds-favorites-header">
                  <button className="ds-favorites-back" onClick={() => { setShowAllLinks(false); setLinksMenuId(null); setLinksSearchOpen(false); setLinksSearchText(""); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {linksSearchOpen ? (
                    <input
                      className="ds-favorites-search-input"
                      type="text"
                      placeholder="Search links..."
                      value={linksSearchText}
                      onChange={(e) => setLinksSearchText(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setLinksSearchOpen(false);
                          setLinksSearchText("");
                        }
                      }}
                    />
                  ) : (
                    <span className="ds-favorites-title">All links</span>
                  )}
                  {/* Search açıqdırsa X (bağla), deyilsə search iconu */}
                  {linksSearchOpen ? (
                    <button
                      className="ds-favorites-search-btn active"
                      title="Close search"
                      onClick={() => { setLinksSearchOpen(false); setLinksSearchText(""); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="ds-favorites-search-btn"
                      title="Search"
                      onClick={() => setLinksSearchOpen(true)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="ds-favorites-list">
                  {(() => {
                    const query = linksSearchText.trim().toLowerCase();
                    const filtered = query
                      ? linkMessages.filter((l) => l.url.toLowerCase().includes(query) || l.domain.toLowerCase().includes(query))
                      : linkMessages;

                    if (filtered.length === 0) {
                      return (
                        <div className="ds-favorites-empty">
                          {query ? "No matching links" : "No links shared"}
                        </div>
                      );
                    }

                    return filtered.map((link, idx) => {
                      const msgDate = new Date(link.createdAtUtc).toLocaleDateString("en-US", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      });
                      const prevDate = idx > 0
                        ? new Date(filtered[idx - 1].createdAtUtc).toLocaleDateString("en-US", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })
                        : null;
                      const showDate = idx === 0 || msgDate !== prevDate;

                      return (
                        <div key={`${link.id}-${link.url}`}>
                          {showDate && (
                            <div className="ds-favorites-date"><span>{msgDate}</span></div>
                          )}
                          <div
                            className="ds-link-item"
                            onClick={() => handleScrollToMessage(link.id)}
                          >
                            {/* Link ikonu */}
                            <div className="ds-link-icon-wrap">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                              </svg>
                            </div>
                            {/* Link məlumatı */}
                            <div className="ds-link-body">
                              <span className="ds-link-domain">{link.domain}</span>
                              <a
                                className="ds-link-url"
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {query ? (() => {
                                  const lower = link.url.toLowerCase();
                                  const parts = [];
                                  let last = 0;
                                  let si = lower.indexOf(query, last);
                                  while (si !== -1) {
                                    if (si > last) parts.push(link.url.slice(last, si));
                                    parts.push(<mark key={si}>{link.url.slice(si, si + query.length)}</mark>);
                                    last = si + query.length;
                                    si = lower.indexOf(query, last);
                                  }
                                  if (last < link.url.length) parts.push(link.url.slice(last));
                                  return parts;
                                })() : link.url}
                              </a>
                              {/* Göndərən */}
                              <div className="ds-link-sender">
                                <div
                                  className="ds-link-sender-avatar"
                                  style={{ background: getAvatarColor(link.senderFullName) }}
                                >
                                  {link.senderAvatarUrl ? (
                                    <img src={link.senderAvatarUrl} alt="" className="ds-link-sender-avatar-img" />
                                  ) : (
                                    getInitials(link.senderFullName)
                                  )}
                                </div>
                                <span className="ds-link-sender-name">{link.senderFullName}</span>
                              </div>
                            </div>
                            {/* More menu */}
                            <div
                              className="ds-favorites-more-wrap"
                              ref={linksMenuId === `${link.id}-${link.url}` ? linksMenuRef : null}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="ds-favorites-more-btn"
                                onClick={() => setLinksMenuId(linksMenuId === `${link.id}-${link.url}` ? null : `${link.id}-${link.url}`)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                              {linksMenuId === `${link.id}-${link.url}` && (
                                <div className="ds-dropdown">
                                  <button
                                    className="ds-dropdown-item"
                                    onClick={() => {
                                      handleScrollToMessage(link.id);
                                      setLinksMenuId(null);
                                    }}
                                  >
                                    View context
                                  </button>
                                  <button
                                    className="ds-dropdown-item"
                                    onClick={() => {
                                      navigator.clipboard.writeText(link.url);
                                      setLinksMenuId(null);
                                    }}
                                  >
                                    Copy link
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Chats with user paneli — sidebar-ın üstünə gəlir */}
            {showChatsWithUser && (
              <div className="ds-favorites-panel">
                <div className="ds-favorites-header">
                  {/* source-a görə back (←) və ya close (X) butonu */}
                  {chatsWithUserSource === "context" ? (
                    <button
                      className="ds-favorites-back"
                      onClick={() => { setShowChatsWithUser(false); setChatsWithUserData([]); setChatsWithUserSource(null); setShowSidebar(false); }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="ds-favorites-back"
                      onClick={() => { setShowChatsWithUser(false); setChatsWithUserData([]); setChatsWithUserSource(null); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6" />
                      </svg>
                    </button>
                  )}
                  <span className="ds-favorites-title">Chats with user</span>
                </div>
                <div className="ds-favorites-list">
                  {chatsWithUserData.length === 0 ? (
                    <div className="ds-favorites-empty">No shared chats</div>
                  ) : (
                    chatsWithUserData.map((ch) => {
                      // Tarix formatı — bugün/dünən/tarix
                      let dateStr = "";
                      if (ch.lastMessageAtUtc) {
                        const d = new Date(ch.lastMessageAtUtc);
                        const now = new Date();
                        const isToday = d.toDateString() === now.toDateString();
                        const yesterday = new Date(now);
                        yesterday.setDate(yesterday.getDate() - 1);
                        const isYesterday = d.toDateString() === yesterday.toDateString();
                        if (isToday) {
                          dateStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                        } else if (isYesterday) {
                          dateStr = "yesterday";
                        } else if (d.getFullYear() === now.getFullYear()) {
                          dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        } else {
                          dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                        }
                      }

                      // Channel tipinə görə mətn (ChannelType: Public=1, Private=2)
                      const typeLabel = ch.type === 1 ? "Channel" : "Group chat";

                      return (
                        <div
                          key={ch.id}
                          className="ds-shared-chat-item"
                          onClick={() => {
                            // Kanalı conversations-da tap, varsa seç
                            const existing = conversations.find((c) => c.id === ch.id);
                            if (existing) {
                              handleSelectChat(existing);
                            } else {
                              // Siyahıda yoxdursa → yeni conversation olaraq əlavə et və seç
                              const newConv = {
                                id: ch.id,
                                name: ch.name,
                                avatarUrl: ch.avatarUrl,
                                type: 1,
                                unreadCount: 0,
                              };
                              handleSelectChat(newConv);
                            }
                          }}
                        >
                          {/* Avatar */}
                          <div
                            className="ds-shared-chat-avatar"
                            style={{ background: getAvatarColor(ch.name) }}
                          >
                            {ch.avatarUrl ? (
                              <img src={ch.avatarUrl} alt="" className="ds-shared-chat-avatar-img" />
                            ) : (
                              getInitials(ch.name)
                            )}
                          </div>
                          {/* Məlumat */}
                          <div className="ds-shared-chat-body">
                            <span className="ds-shared-chat-name">{ch.name}</span>
                            <span className="ds-shared-chat-type">{typeLabel}</span>
                          </div>
                          {/* Tarix */}
                          {dateStr && <span className="ds-shared-chat-date">{dateStr}</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Files and media paneli */}
            {showFilesMedia && (
              <div className="ds-favorites-panel">
                <div className="ds-favorites-header">
                  <button className="ds-favorites-back" onClick={() => { setShowFilesMedia(false); setFilesMenuId(null); setFilesSearchOpen(false); setFilesSearchText(""); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  {filesSearchOpen ? (
                    <input
                      className="ds-favorites-search-input"
                      type="text"
                      placeholder="Search files..."
                      value={filesSearchText}
                      onChange={(e) => setFilesSearchText(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => { if (e.key === "Escape") { setFilesSearchOpen(false); setFilesSearchText(""); } }}
                    />
                  ) : (
                    <span className="ds-favorites-title">Files and media</span>
                  )}
                  {filesSearchOpen ? (
                    <button className="ds-favorites-search-btn active" title="Close search" onClick={() => { setFilesSearchOpen(false); setFilesSearchText(""); }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : (
                    <button className="ds-favorites-search-btn" title="Search" onClick={() => setFilesSearchOpen(true)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </button>
                  )}
                </div>

                {/* Tab-lar: Media / Files */}
                <div className="ds-fm-tabs">
                  <button
                    className={`ds-fm-tab${filesMediaTab === "media" ? " active" : ""}`}
                    onClick={() => setFilesMediaTab("media")}
                  >
                    Media
                  </button>
                  <button
                    className={`ds-fm-tab${filesMediaTab === "files" ? " active" : ""}`}
                    onClick={() => setFilesMediaTab("files")}
                  >
                    Files
                  </button>
                </div>

                <div className="ds-favorites-list">
                  {(() => {
                    const query = filesSearchText.trim().toLowerCase();
                    // Tab-a görə filterlə
                    const tabFiltered = filesMediaTab === "media"
                      ? fileMessages.filter((f) => f.isImage)
                      : fileMessages.filter((f) => !f.isImage);
                    // Axtarışa görə filterlə
                    const filtered = query
                      ? tabFiltered.filter((f) => f.fileName?.toLowerCase().includes(query))
                      : tabFiltered;

                    if (filtered.length === 0) {
                      return (
                        <div className="ds-favorites-empty">
                          {query ? "No matching files" : filesMediaTab === "media" ? "No media yet" : "No files yet"}
                        </div>
                      );
                    }

                    if (filesMediaTab === "media") {
                      // Media tab — şəkilləri grid formatında göstər, date divider ilə
                      let lastDate = null;
                      const elements = [];
                      filtered.forEach((f, idx) => {
                        const msgDate = new Date(f.createdAtUtc).toLocaleDateString("en-US", {
                          weekday: "long", year: "numeric", month: "long", day: "numeric",
                        });
                        if (msgDate !== lastDate) {
                          if (elements.length > 0) elements.push(<div key={`grid-end-${idx}`} className="ds-fm-grid-break" />);
                          elements.push(<div key={`date-${idx}`} className="ds-favorites-date"><span>{msgDate}</span></div>);
                          lastDate = msgDate;
                        }
                        elements.push(
                          <div key={f.id} className="ds-fm-media-item">
                            <img
                              src={f.thumbnailUrl || f.fileUrl}
                              alt={f.fileName}
                              className="ds-fm-media-img"
                              onClick={() => handleScrollToMessage(f.id)}
                            />
                            {/* Göndərən avatar */}
                            <div
                              className="ds-fm-media-sender"
                              style={{ background: getAvatarColor(f.senderFullName) }}
                              title={f.senderFullName}
                            >
                              {f.senderAvatarUrl ? (
                                <img src={f.senderAvatarUrl} alt="" className="ds-fm-media-sender-img" />
                              ) : (
                                getInitials(f.senderFullName)
                              )}
                            </div>
                            {/* More butonu */}
                            <div
                              className="ds-fm-media-more-wrap"
                              ref={filesMenuId === f.id ? filesMenuRef : null}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                className="ds-fm-media-more-btn"
                                onClick={() => setFilesMenuId(filesMenuId === f.id ? null : f.id)}
                              >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                              {filesMenuId === f.id && (
                                <div className="ds-dropdown">
                                  <button className="ds-dropdown-item" onClick={() => { handleScrollToMessage(f.id); setFilesMenuId(null); }}>
                                    View context
                                  </button>
                                  <button className="ds-dropdown-item" onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = f.fileUrl;
                                    a.download = f.fileName || "file";
                                    a.click();
                                    setFilesMenuId(null);
                                  }}>
                                    Download file
                                  </button>
                                  <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => {
                                    handleDeleteMessage(f.id);
                                    setFilesMenuId(null);
                                  }}>
                                    Delete file
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      });
                      return <div className="ds-fm-media-grid">{elements}</div>;
                    }

                    // Files tab — siyahı formatında
                    return filtered.map((f, idx) => {
                      const msgDate = new Date(f.createdAtUtc).toLocaleDateString("en-US", {
                        weekday: "long", year: "numeric", month: "long", day: "numeric",
                      });
                      const prevDate = idx > 0
                        ? new Date(filtered[idx - 1].createdAtUtc).toLocaleDateString("en-US", {
                            weekday: "long", year: "numeric", month: "long", day: "numeric",
                          })
                        : null;
                      const showDate = idx === 0 || msgDate !== prevDate;
                      // Fayl ölçüsü formatı
                      const sizeStr = f.fileSizeInBytes
                        ? f.fileSizeInBytes < 1024 ? `${f.fileSizeInBytes} B`
                          : f.fileSizeInBytes < 1048576 ? `${(f.fileSizeInBytes / 1024).toFixed(1)} KB`
                          : `${(f.fileSizeInBytes / 1048576).toFixed(1)} MB`
                        : "";

                      return (
                        <div key={f.id}>
                          {showDate && <div className="ds-favorites-date"><span>{msgDate}</span></div>}
                          <div className="ds-fm-file-item" onClick={() => handleScrollToMessage(f.id)}>
                            {/* Fayl ikonu */}
                            <div className="ds-fm-file-icon">
                              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            </div>
                            <div className="ds-fm-file-body">
                              <span className="ds-fm-file-name">
                                {query ? (() => {
                                  const lower = (f.fileName || "").toLowerCase();
                                  const parts = [];
                                  let last = 0;
                                  let si = lower.indexOf(query, last);
                                  while (si !== -1) {
                                    if (si > last) parts.push(f.fileName.slice(last, si));
                                    parts.push(<mark key={si}>{f.fileName.slice(si, si + query.length)}</mark>);
                                    last = si + query.length;
                                    si = lower.indexOf(query, last);
                                  }
                                  if (last < f.fileName.length) parts.push(f.fileName.slice(last));
                                  return parts;
                                })() : f.fileName}
                              </span>
                              <span className="ds-fm-file-meta">{sizeStr} · {f.senderFullName}</span>
                            </div>
                            {/* More menu */}
                            <div
                              className="ds-favorites-more-wrap"
                              ref={filesMenuId === f.id ? filesMenuRef : null}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button className="ds-favorites-more-btn" onClick={() => setFilesMenuId(filesMenuId === f.id ? null : f.id)}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                  <circle cx="5" cy="12" r="2" />
                                  <circle cx="12" cy="12" r="2" />
                                  <circle cx="19" cy="12" r="2" />
                                </svg>
                              </button>
                              {filesMenuId === f.id && (
                                <div className="ds-dropdown">
                                  <button className="ds-dropdown-item" onClick={() => { handleScrollToMessage(f.id); setFilesMenuId(null); }}>View context</button>
                                  <button className="ds-dropdown-item" onClick={() => {
                                    const a = document.createElement("a");
                                    a.href = f.fileUrl;
                                    a.download = f.fileName || "file";
                                    a.click();
                                    setFilesMenuId(null);
                                  }}>Download file</button>
                                  <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => { handleDeleteMessage(f.id); setFilesMenuId(null); }}>Delete file</button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Members paneli — sidebar-ın üstünə gəlir (favorites kimi) */}
            {showMembersPanel && selectedChat?.type === 1 && channelMembers[selectedChat.id] && (
              <div className="ds-favorites-panel">
                <div className="ds-favorites-header">
                  <button className="ds-favorites-back" onClick={() => { setShowMembersPanel(false); setMemberMenuId(null); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="15 18 9 12 15 6" />
                    </svg>
                  </button>
                  <span className="ds-favorites-title">
                    Members: {Object.keys(channelMembers[selectedChat.id]).length}
                    <button className="ds-mp-add-btn" onClick={() => { setShowMembersPanel(false); setMemberMenuId(null); setShowAddMember(true); }}>
                      + Add
                    </button>
                  </span>
                </div>

                {/* Members siyahısı */}
                <div className="ds-mp-list">
                  {Object.entries(channelMembers[selectedChat.id]).map(([uid, m]) => {
                    const isMe = uid === user.id;
                    const isOwner = m.role === 3 || m.role === "Owner";
                    const isAdmin = m.role === 2 || m.role === "Admin";
                    const roleLabel = isOwner ? "Owner" : isAdmin ? "Admin" : "Member";
                    return (
                      <div key={uid} className="ds-mp-member" ref={memberMenuId === uid ? memberMenuRef : null}>
                        <div className="ds-mp-avatar-wrap">
                          <div className="ds-mp-avatar" style={{ background: getAvatarColor(m.fullName) }}>
                            {m.avatarUrl ? (
                              <img src={m.avatarUrl} alt="" className="ds-mp-avatar-img" />
                            ) : (
                              getInitials(m.fullName)
                            )}
                          </div>
                          {isOwner && (
                            <span className="ds-mp-owner-badge" title="Owner">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="#f5a623" stroke="#fff" strokeWidth="1.5">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            </span>
                          )}
                        </div>
                        <div className="ds-mp-info">
                          <span className="ds-mp-name">
                            {m.fullName}{isMe && <i>(it's you)</i>}
                          </span>
                          <span className="ds-mp-role">{roleLabel}</span>
                        </div>
                        <button className="ds-mp-more-btn" onClick={() => setMemberMenuId(memberMenuId === uid ? null : uid)}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="5" cy="12" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="19" cy="12" r="2" />
                          </svg>
                        </button>
                        {memberMenuId === uid && (
                          <div className="ds-dropdown ds-mp-dropdown">
                            {!isMe && (
                              <>
                                <button className="ds-dropdown-item" onClick={() => {
                                  // Mention — input-a @fullName əlavə et
                                  setMessageText((prev) => prev + `@${m.fullName} `);
                                  setShowMembersPanel(false);
                                  setMemberMenuId(null);
                                  setShowSidebar(false);
                                  setTimeout(() => inputRef.current?.focus(), 0);
                                }}>Mention</button>
                                <button className="ds-dropdown-item" onClick={() => {
                                  // Send private message — DM-ə keç
                                  const dmConv = conversations.find((c) => c.type === 0 && c.otherUserId === uid);
                                  if (dmConv) {
                                    setSelectedChat(dmConv);
                                  }
                                  setShowMembersPanel(false);
                                  setMemberMenuId(null);
                                  setShowSidebar(false);
                                }}>Send private message</button>
                              </>
                            )}
                            <button className="ds-dropdown-item" onClick={() => { setMemberMenuId(null); }}>View profile</button>
                            {isMe && (
                              <button className="ds-dropdown-item ds-dropdown-danger" onClick={() => {
                                handleLeaveChannel(selectedChat);
                                setShowMembersPanel(false);
                                setMemberMenuId(null);
                                setShowSidebar(false);
                              }}>Leave</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

        {/* Add chat members popup — floating dialog sidebar-ın üstündə */}
        {showAddMember && (
          <div className="ds-am-overlay">
            <div className="ds-am-popup" ref={addMemberRef}>
              {/* Header */}
              <div className="ds-am-header">
                <span className="ds-am-title">Add chat members</span>
                <button
                  className="ds-am-close"
                  onClick={() => { setShowAddMember(false); setAddMemberSearch(""); setAddMemberSearchActive(false); setAddMemberSelected(new Set()); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>

              {/* Search sahəsi — chips + input / +Add user butonu */}
              <div className="ds-am-search-area">
                {addMemberSearchActive || addMemberSelected.size > 0 ? (
                  <div className="ds-am-search-box">
                    {[...addMemberSelected].map((uid) => {
                      const u = addMemberUsers.find((x) => x.id === uid) || conversations.find((c) => c.otherUserId === uid);
                      const name = u?.fullName || u?.name || "User";
                      return (
                        <span key={uid} className="ds-am-chip">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z" /></svg>
                          {name}
                          <button
                            className="ds-am-chip-remove"
                            onClick={() => setAddMemberSelected((prev) => { const next = new Set(prev); next.delete(uid); return next; })}
                          >×</button>
                        </span>
                      );
                    })}
                    <input
                      className="ds-am-search-input"
                      type="text"
                      placeholder="Search..."
                      value={addMemberSearch}
                      onChange={(e) => setAddMemberSearch(e.target.value)}
                      autoFocus
                      onBlur={() => {
                        if (!addMemberSearch.trim() && addMemberSelected.size === 0) {
                          setAddMemberSearchActive(false);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <button className="ds-am-add-user-btn" onClick={() => setAddMemberSearchActive(true)}>
                    + Add user
                  </button>
                )}
              </div>

              {/* Show chat history — false olduqda yeni üzv yalnız qoşulduqdan sonrakı mesajları görür */}
              <label className="ds-am-checkbox-row">
                <input
                  type="checkbox"
                  checked={addMemberShowHistory}
                  onChange={(e) => setAddMemberShowHistory(e.target.checked)}
                  className="ds-am-checkbox"
                />
                <span>Show chat history</span>
              </label>

              {/* Recent chats */}
              <div className="ds-am-section-title">
                {addMemberSearch.trim().length >= 2 ? "Search results" : "Recent chats"}
              </div>

              <div className="ds-am-list">
                {(() => {
                  const query = addMemberSearch.trim();
                  const existingIds = channelMembers[selectedChat?.id]
                    ? new Set(Object.keys(channelMembers[selectedChat.id]))
                    : new Set();

                  // Axtarış varsa backend nəticələri, yoxdursa recent DM-lər
                  let users;
                  if (query.length >= 2) {
                    users = addMemberSearchResults
                      .filter((u) => !existingIds.has(u.id))
                      .map((u) => ({
                        id: u.id,
                        fullName: u.fullName || `${u.firstName} ${u.lastName}`,
                        avatarUrl: u.avatarUrl,
                        position: u.position || "User",
                      }));
                  } else {
                    users = addMemberUsers;
                  }

                  if (users.length === 0) {
                    return <div className="ds-am-empty">{query.length >= 2 ? "No matching users" : "No recent chats"}</div>;
                  }

                  return users.map((u) => {
                    const isSelected = addMemberSelected.has(u.id);
                    return (
                      <div
                        key={u.id}
                        className={`ds-am-user${isSelected ? " selected" : ""}`}
                        onClick={() => {
                          setAddMemberSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(u.id)) next.delete(u.id);
                            else next.add(u.id);
                            return next;
                          });
                          // User seçildikdə search input reset olsun
                          setAddMemberSearch("");
                          setAddMemberSearchActive(false);
                          setAddMemberSearchResults([]);
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
                  disabled={addMemberSelected.size === 0 || addMemberInviting}
                  onClick={handleInviteMembers}
                >
                  {addMemberInviting ? "INVITING..." : "INVITE"}
                </button>
                <button
                  className="ds-am-cancel-btn"
                  onClick={() => { setShowAddMember(false); setAddMemberSearch(""); setAddMemberSearchActive(false); setAddMemberSelected(new Set()); }}
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
