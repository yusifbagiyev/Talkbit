// ─── useChatSignalR.js — Custom Hook: Real-Time Event Handlers ───────────────
// Custom Hook nədir?
//   - "use" ilə başlayan funksiya — React hook-larını (useEffect, useState) istifadə edə bilir
//   - Kodun təkrarlanmasının qarşısını alır — məntiqi komponentdən ayırır
//   - .NET-də: ayrıca service class kimi düşün — ChatHub event listener-ları
//
// Bu hook Chat.jsx-dən çağırılır. Bütün SignalR event handler-larını qurur
// və component unmount olduqda avtomatik olaraq təmizlənir.
//
// "Pure side-effect hook" — heç bir dəyər qaytarmır (returns nothing)

import { useEffect } from "react";
import { startConnection } from "../services/signalr";
import { getMessagePreview } from "../utils/chatUtils";

export default function useChatSignalR(
  userId,             // Cari istifadəçinin ID-si (öz typing signal-ını ignore etmək üçün)
  selectedChatRef,    // Seçilmiş chat-ın ref-i (stale closure problemi yoxdur)
  setMessages,        // Mesajlar array-ını yeniləmək üçün
  setConversations,   // Conversation list-i yeniləmək üçün (son mesaj)
  setShouldScrollBottom, // Yeni mesaj gəldikdə aşağı scroll et
  setOnlineUsers,     // Online olan userlərin Set-i
  setTypingUsers,     // Kim yazır — { [conversationId]: true/fullName }
  setPinnedMessages,  // Pinlənmiş mesajlar array-ı
  setCurrentPinIndex, // Pin bar-dakı aktiv index
  setLastReadTimestamp, // DM mesajın oxunma vaxtı — { [chatId]: Date }
  onCheckUploadCompletion, // Upload manager — real mesaj gəldikdə upload task-ı silmək üçün
  scrollerRef,            // Scroll container ref — reaction height compensation üçün
  showScrollDownRef,      // Scroll-to-bottom buton görünürmü — compensation yalnız aşağıdaysa
  messageCacheRef,        // Message cache ref — yeni mesaj gəldikdə cache-i invalidasiya etmək üçün
  onNewFileMessageRef,    // Sidebar — fayl mesajı gəldikdə Files & Media panelini yeniləmək üçün
  onChannelUpdatedRef,    // Channel adı/avatarı dəyişdikdə selectedChat-ı yeniləmək üçün (ref)
) {
  // useEffect — komponentin mount olduğunda 1 dəfə işləyir
  // [userId] — dependency array: yalnız userId dəyişəndə yenidən işləyir
  useEffect(() => {
    // conn: SignalR connection obyekti — cleanup funksiyasında istifadə üçün
    let conn = null;
    // StrictMode qoruması: mount→cleanup→remount zamanı köhnə callback-in handler
    // qeydə almasının qarşısını alır (async startConnection cleanup-dan sonra resolve olur)
    let aborted = false;

    // ─── handleNewMessage — DM və Channel üçün ortaq handler ─────────────────
    // chatType: 0 = DM, 1 = Channel
    // chatIdField: mesajdan chat ID-ni almaq üçün key ("conversationId" / "channelId")
    function handleNewMessage(message, chatType, chatIdField) {
      const chatId = message[chatIdField];

      // Upload task-ı sil — real mesaj gəldi, optimistic upload mesajını əvəz edir
      if (message.fileId && onCheckUploadCompletion) {
        onCheckUploadCompletion(message.fileId);
      }

      // Cache invalidasiya — yeni mesaj gəldi, cache köhnəldi
      if (messageCacheRef?.current) {
        messageCacheRef.current.delete(chatId);
      }

      // Əgər bu chat açıqdırsa — messages state-ə əlavə et
      // selectedChatRef.current istifadə olunur — setState içindən setState çağırmaq anti-pattern-dır
      const current = selectedChatRef?.current;
      if (current && current.type === chatType && current.id === chatId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          // Öz mesajımızın echo-su — optimistic mesajı tap və əvəz et
          // FIFO: ən köhnə temp- prefix-li mesajı tap (echo-lar göndərmə sırasına uyğun gəlir)
          // YALNIZ temp- ID-li mesajlar axtarılır — artıq əvəz olunmuş (real UUID) mesajlar tapılmaz
          let enrichedMsg = message;
          let matchedOptId = null;
          if (message.senderId === userId) {
            const pendingOptimistics = prev.filter((m) => typeof m.id === "string" && m.id.startsWith("temp-"));
            // DESC sıra: pendingOptimistics[0] = ən yeni, [length-1] = ən köhnə (FIFO)
            const optimistic = pendingOptimistics.length > 0 ? pendingOptimistics[pendingOptimistics.length - 1] : null;
            if (optimistic) {
              matchedOptId = optimistic.id;
              enrichedMsg = {
                ...message,
                createdAtUtc: optimistic.createdAtUtc, // Lokal vaxt saxla — layout shift olmasın
                _optimistic: true,  // Hələ pending saxla — layout shift olmasın
                replyToContent: message.replyToContent || optimistic.replyToContent || null,
                replyToSenderName: message.replyToSenderName || optimistic.replyToSenderName || null,
                mentions: message.mentions?.length > 0 ? message.mentions : (optimistic.mentions || []),
                _stableKey: optimistic._stableKey || optimistic.id,
              };
              // Scroll sabitləşdikdən sonra _optimistic sil + status yenilə
              const realId = message.id;
              setTimeout(() => {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === realId ? { ...m, _optimistic: false } : m,
                  ),
                );
              }, 200);
            }
          }
          if (matchedOptId) {
            return prev.map((m) => m.id === matchedOptId ? enrichedMsg : m);
          }
          // Yeni mesaj əlavə et — scroll Chat.jsx useLayoutEffect ilə idarə olunur
          // (ayrı setShouldScrollBottom çağırmaq frame gap yaradır → sıçrama)
          return [enrichedMsg, ...prev];
        });

        // Fayl mesajıdırsa — sidebar Files & Media panelini yenilə
        if (message.fileId && onNewFileMessageRef?.current) {
          onNewFileMessageRef.current(message);
        }
      }

      // Conversation list-i yenilə
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === chatId);

        // ── Yeni DM conversation (ilk mesaj) — listdə yoxdur → yarat ──
        if (!exists && chatType === 0) {
          // Öz mesajımızın echo-su — conversation-ı handleSendMessage yaradacaq
          if (message.senderId === userId) return prev;
          const newConv = {
            id: chatId,
            name: message.senderFullName,
            type: 0,
            avatarUrl: message.senderAvatarUrl,
            otherUserId: message.senderId,
            lastMessage: getMessagePreview(message),
            lastMessageAtUtc: message.createdAtUtc,
            lastMessageSenderId: message.senderId,
            lastMessageSenderFullName: message.senderFullName,
            lastMessageSenderAvatarUrl: message.senderAvatarUrl,
            lastMessageStatus: null,
            unreadCount: 1,
            _lastProcessedMsgId: message.id,
          };
          return [newConv, ...prev];
        }

        // ── Mövcud conversation/channel — yenilə ──
        const updated = prev.map((c) => {
          if (c.id === chatId) {
            const isDuplicate = c._lastProcessedMsgId === message.id;
            return {
              ...c,
              _lastProcessedMsgId: message.id,
              lastMessage: getMessagePreview(message),
              lastMessageAtUtc: message.createdAtUtc,
              lastMessageSenderId: message.senderId,
              lastMessageSenderFullName: message.senderFullName,
              lastMessageSenderAvatarUrl: message.senderAvatarUrl,
              // Öz mesajımızın echo-su: Sent yaz — MessageBubble da eyni anda echo alır
              lastMessageStatus: message.senderId === userId ? "Sent" : c.lastMessageStatus,
              unreadCount:
                message.senderId !== userId && !isDuplicate
                  ? c.unreadCount + 1
                  : c.unreadCount,
            };
          }
          return c;
        });
        // Yeni mesajlı chat-ı siyahının başına gətir
        const idx = updated.findIndex((c) => c.id === chatId);
        if (idx > 0) {
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
        }
        return updated;
      });
    }

    // DM və Channel handler-ları — ortaq handleNewMessage-ə delege edir
    function handleNewDirectMessage(message) {
      handleNewMessage(message, 0, "conversationId");
    }
    function handleNewChannelMessage(message) {
      handleNewMessage(message, 1, "channelId");
    }

    // ─── handleMessageRead ────────────────────────────────────────────────────
    // Digər istifadəçi mesajı oxuyanda — mesajın status-unu yenilə (✓✓ mavi)
    // status: 3 = Read (MessageStatus enum)
    function handleMessageRead(data) {
      // Mesajlar array-ında status-u yenilə (✓✓ mavi tick üçün)
      // readAtUtc: server-dən gələn dəqiq oxunma vaxtı
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            return { ...m, isRead: true, status: 3, readAtUtc: data.readAtUtc };
          }
          return m;
        }),
      );

      // DM status bar üçün oxunma vaxtını capture et
      // Server-dən gələn readAtUtc istifadə et (client-side new Date() əvəzinə)
      setLastReadTimestamp((prev) => ({
        ...prev,
        [data.conversationId]: new Date(data.readAtUtc),
      }));

      // Conversation list-dəki lastMessageStatus-u "Read"-ə yenilə
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === data.conversationId) {
            return { ...c, lastMessageStatus: "Read" };
          }
          return c;
        }),
      );
    }

    // ─── handleChannelMessagesRead ──────────────────────────────────────────────
    // Channel-da mesajlar oxunanda — readByCount yenilə
    // data: channelId, readByUserId, messageReadCounts (Dictionary<Guid, int>)
    function handleChannelMessagesRead(channelId, readByUserId, messageReadCounts) {
      // Mesajlardakı readByCount + readBy array yenilə
      setMessages((prev) =>
        prev.map((m) => {
          if (messageReadCounts && messageReadCounts[m.id] !== undefined) {
            const updatedReadBy = m.readBy ? [...m.readBy] : [];
            if (!updatedReadBy.includes(readByUserId)) {
              updatedReadBy.push(readByUserId);
            }
            return {
              ...m,
              readByCount: messageReadCounts[m.id],
              readBy: updatedReadBy,
              status: 3, // Read — tick icon mavi double tick göstərsin
            };
          }
          return m;
        }),
      );

      // Conversation list-dəki lastMessageStatus-u "Read"-ə yenilə
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === channelId && c.lastMessageSenderId === userId) {
            return { ...c, lastMessageStatus: "Read" };
          }
          return c;
        }),
      );
    }

    // ─── handleUserOnline ─────────────────────────────────────────────────────
    // İstifadəçi online olduqda — onlineUsers Set-ə əlavə et
    // Set nədir? Unikal dəyərlərin kolleksiyası — Array kimi amma duplicate yoxdur
    function handleUserOnline(onlineUserId) {
      setOnlineUsers((prev) => {
        const next = new Set(prev); // Köhnə Set-dən yeni Set yarat (immutability)
        next.add(onlineUserId);     // Online user-i əlavə et
        return next;
      });
    }

    // ─── handleUserOffline ────────────────────────────────────────────────────
    // İstifadəçi offline olduqda — onlineUsers Set-dən sil
    function handleUserOffline(offlineUserId) {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(offlineUserId); // Offline user-i sil
        return next;
      });
    }

    // ─── handleUserTypingInConversation ───────────────────────────────────────
    // DM conversation-da digər user yazır/yazmağı dayandırır
    // typingUsers: { [conversationId]: true } — həmin conversation-da yazır
    function handleUserTypingInConversation(conversationId, typingUserId, isTyping) {
      // Özümüzün typing signal-ını ignore et
      if (typingUserId === userId) return;
      setTypingUsers((prev) => {
        if (isTyping) {
          // Computed property: [conversationId] — dəyişən adından key yarat
          return { ...prev, [conversationId]: true };
        } else {
          const next = { ...prev };
          delete next[conversationId]; // Key-i sil — artıq yazmır
          return next;
        }
      });
    }

    // ─── handleUserTypingInChannel ────────────────────────────────────────────
    // Channel-da digər user yazır/yazmağı dayandırır
    // fullName — channel-da "Ali yazır..." göstərmək üçün
    function handleUserTypingInChannel(channelId, typingUserId, fullName, isTyping) {
      if (typingUserId === userId) return;
      setTypingUsers((prev) => {
        if (isTyping) {
          return { ...prev, [channelId]: fullName }; // Ad saxla — "Ali yazır..." üçün
        } else {
          const next = { ...prev };
          delete next[channelId];
          return next;
        }
      });
    }

    // ─── handleMessageDeleted ─────────────────────────────────────────────────
    // Başqa user (ya da özümüz başqa cihazdan) mesajı siləndə
    // hardDeleted=true  → heç kim oxumayıb, mesajı tamamilə sil (UI-dan yox olur)
    // hardDeleted=false → kimsə oxuyub, "This message was deleted." göstərilir
    function handleMessageDeleted(deletedMsg) {
      if (deletedMsg.hardDeleted) {
        // Hard delete — mesajı array-dən tamamilə çıxar
        setMessages((prev) => prev.filter((m) => m.id !== deletedMsg.id));

        // Conversation list-i yenilə — unreadCount azalt + əvvəlki mesajı göstər
        const chatId = deletedMsg.conversationId || deletedMsg.channelId;
        if (chatId) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== chatId) return c;
              const isIncoming = deletedMsg.senderId !== userId;
              const updates = {
                unreadCount: isIncoming ? Math.max(0, c.unreadCount - 1) : c.unreadCount,
              };
              // Silinən mesaj son mesaj idisə → əvvəlki mesajın məlumatını göstər
              if (c._lastProcessedMsgId === deletedMsg.id) {
                updates.lastMessage = deletedMsg.previousLastMessage || "";
                updates.lastMessageAtUtc = deletedMsg.previousLastMessageAtUtc || null;
                updates.lastMessageSenderId = deletedMsg.previousLastMessageSenderId || null;
                updates._lastProcessedMsgId = null;
              }
              return { ...c, ...updates };
            }),
          );
        }
      } else {
        // Soft delete — isDeleted: true et
        setMessages((prev) =>
          prev.map((m) => (m.id === deletedMsg.id ? { ...m, isDeleted: true } : m)),
        );

        // Conversation list — silinən mesaj son mesaj idisə preview-u yenilə
        const chatId = deletedMsg.conversationId || deletedMsg.channelId;
        if (chatId) {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id !== chatId) return c;
              // Son işlənmiş mesaj bu mesajdırsa → preview "This message was deleted."
              if (c._lastProcessedMsgId === deletedMsg.id) {
                return { ...c, lastMessage: "This message was deleted." };
              }
              return c;
            }),
          );
        }
      }
    }

    // ─── handleMessageEdited ──────────────────────────────────────────────────
    // Mesaj redaktə ediləndə — həm mesajın contentini, həm reply reference-ı yenilə
    function handleMessageEdited(editedMsg) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === editedMsg.id) {
            // Özünü yenilə
            return { ...m, content: editedMsg.content, isEdited: true, editedAtUtc: editedMsg.editedAtUtc };
          }
          // Bu mesajın reply-ı varsa (başqasının cavabıdır) — reply text-ini yenilə
          if (m.replyToMessageId === editedMsg.id) {
            return { ...m, replyToContent: editedMsg.content };
          }
          return m;
        }),
      );
    }

    // ─── handleReactionsUpdated ───────────────────────────────────────────────
    // Reaction əlavə/siliندə — o mesajın reactions array-ını yenilə
    // data: { messageId, reactions: [{ emoji, count, userFullNames }] }
    // Scroll compensation: reaction height dəyişdikdə scroll pozulmasın
    // Yalnız aşağıya yaxın olduqda (scroll-to-bottom butonu yoxdursa) compensation tətbiq olunur
    function handleReactionsUpdated(data) {
      const needsCompensation = !showScrollDownRef?.current;
      const scroller = needsCompensation ? scrollerRef?.current : null;
      const scrollHeightBefore = scroller?.scrollHeight;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m,
        ),
      );

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
    }

    // ─── handleMessagePinned ──────────────────────────────────────────────────
    // Mesaj pinlənəndə — pinnedMessages-ə əlavə et + mesajın isPinned-ini yenilə
    function handleMessagePinned(msgDto) {
      setPinnedMessages((prev) => {
        if (prev.some((m) => m.id === msgDto.id)) return prev; // Artıq var → skip
        // Əlavə et + DESC sırala (ən son pinlənmiş birinci görünsün)
        return [...prev, msgDto].sort(
          (a, b) => new Date(b.pinnedAtUtc) - new Date(a.pinnedAtUtc),
        );
      });
      // Messages state-də də isPinned-i yenilə (pin icon üçün)
      setMessages((prev) =>
        prev.map((m) => (m.id === msgDto.id ? { ...m, isPinned: true, pinnedAtUtc: msgDto.pinnedAtUtc } : m)),
      );
    }

    // ─── handleMessageUnpinned ────────────────────────────────────────────────
    // Mesaj pin-dən çıxarılanda — pinnedMessages-dən sil
    function handleMessageUnpinned(msgDto) {
      setPinnedMessages((prev) => {
        const next = prev.filter((m) => m.id !== msgDto.id); // Həmin mesajı çıxar
        // Pin index-i array uzunluğundan böyük olmasın
        setCurrentPinIndex((idx) => (idx >= next.length ? Math.max(0, next.length - 1) : idx));
        return next;
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgDto.id ? { ...m, isPinned: false, pinnedAtUtc: null } : m)),
      );
    }

    // ─── handleChannelUpdated ─────────────────────────────────────────────────
    // Channel adı və ya avatarı dəyişdikdə — conversation list + selectedChat yenilə
    // data: { channelId, name, avatarUrl }
    function handleChannelUpdated(data) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === data.channelId
            ? { ...c, name: data.name, avatarUrl: data.avatarUrl ?? c.avatarUrl }
            : c,
        ),
      );
      onChannelUpdatedRef?.current?.(data);
    }

    // ─── handleAddedToChannel ─────────────────────────────────────────────────
    // Server "AddedToChannel" event-i göndərir — user bir channel-a əlavə olunanda.
    // channelData: backend-dən gələn channel DTO (id, name, type, avatarUrl, memberCount, ...)
    // Conversation list-ə əlavə edir ki, user dərhal yeni channel-ı görsün.
    function handleAddedToChannel(channelData) {
      setConversations((prev) => {
        // Duplicate check — artıq listdə varsa əlavə etmə
        if (prev.some((c) => c.id === channelData.id)) return prev;
        // Backend DTO field adlarını conversation list formatına map et
        const newConversation = {
          id: channelData.id,
          name: channelData.name,
          type: 1, // Unified type: Channel (Backend ChannelType enum-dan fərqli!)
          avatarUrl: channelData.avatarUrl,
          createdBy: channelData.createdBy,
          memberCount: channelData.memberCount,
          lastMessage: channelData.lastMessageContent,
          lastMessageAtUtc: channelData.lastMessageAtUtc,
          lastMessageSenderId: channelData.lastMessageSenderId,
          lastMessageSenderFullName: null,
          lastMessageSenderAvatarUrl: channelData.lastMessageSenderAvatarUrl,
          lastMessageStatus: channelData.lastMessageStatus,
          unreadCount: channelData.unreadCount || 0,
          isPinned: channelData.isPinned || false,
          isMuted: channelData.isMuted || false,
          isMarkedReadLater: channelData.isMarkedReadLater || false,
          lastReadLaterMessageId: channelData.lastReadLaterMessageId || null,
        };
        return [newConversation, ...prev]; // Siyahının başına əlavə et
      });
    }

    // ─── SignalR Bağlantısını Qur + Handler-ları Register Et ─────────────────
    // startConnection() → Promise qaytarır → .then() ilə uğurlu bağlantıda handler-lar qur
    // conn.on("EventName", handlerFunction) — .NET-də: hub.On<T>("EventName", handler) kimi
    // Event adları — handler register/unregister üçün mərkəzləşdirilmiş siyahı
    const eventHandlers = [
      ["NewDirectMessage", handleNewDirectMessage],
      ["NewChannelMessage", handleNewChannelMessage],
      ["MessageRead", handleMessageRead],
      ["UserOnline", handleUserOnline],
      ["UserOffline", handleUserOffline],
      ["UserTypingInConversation", handleUserTypingInConversation],
      ["UserTypingInChannel", handleUserTypingInChannel],
      ["DirectMessagePinned", handleMessagePinned],
      ["DirectMessageUnpinned", handleMessageUnpinned],
      ["ChannelMessagePinned", handleMessagePinned],
      ["ChannelMessageUnpinned", handleMessageUnpinned],
      ["DirectMessageDeleted", handleMessageDeleted],
      ["ChannelMessageDeleted", handleMessageDeleted],
      ["DirectMessageEdited", handleMessageEdited],
      ["ChannelMessageEdited", handleMessageEdited],
      ["ChannelMessageReactionsUpdated", handleReactionsUpdated],
      ["DirectMessageReactionToggled", handleReactionsUpdated],
      ["ChannelMessagesRead", handleChannelMessagesRead],
      ["AddedToChannel", handleAddedToChannel],
      ["ChannelUpdated", handleChannelUpdated],
    ];

    startConnection()
      .then((c) => {
        if (aborted) return; // StrictMode: köhnə mount-un callback-i → skip
        conn = c; // cleanup üçün saxla
        // Əvvəlcə bütün köhnə handler-ları sil (StrictMode/HMR dublikat qoruması)
        // conn.off("EventName") — handler göstərilmədən çağırıldıqda bütün handler-ları silir
        for (const [event] of eventHandlers) {
          conn.off(event);
        }
        // Yeni handler-ları qeydiyyata al
        for (const [event, handler] of eventHandlers) {
          conn.on(event, handler);
        }
      })
      .catch((err) => console.error("SignalR connection failed:", err));

    // ─── Cleanup Function ─────────────────────────────────────────────────────
    // useEffect-in return etdiyi funksiya — komponent unmount olduqda çağırılır.
    // .NET-də: IDisposable.Dispose() kimi.
    // conn.off() — handler-ları sil. Əks halda memory leak + duplicate event-lər olar.
    return () => {
      aborted = true;
      if (conn) {
        for (const [event, handler] of eventHandlers) {
          conn.off(event, handler);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
}
