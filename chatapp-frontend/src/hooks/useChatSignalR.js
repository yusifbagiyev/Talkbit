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

export default function useChatSignalR(
  userId,             // Cari istifadəçinin ID-si (öz typing signal-ını ignore etmək üçün)
  setSelectedChat,    // Seçilmiş chat-ı yeniləmək üçün Chat.jsx state setter
  setMessages,        // Mesajlar array-ını yeniləmək üçün
  setConversations,   // Conversation list-i yeniləmək üçün (son mesaj)
  setShouldScrollBottom, // Yeni mesaj gəldikdə aşağı scroll et
  setOnlineUsers,     // Online olan userlərin Set-i
  setTypingUsers,     // Kim yazır — { [conversationId]: true/fullName }
  setPinnedMessages,  // Pinlənmiş mesajlar array-ı
  setCurrentPinIndex, // Pin bar-dakı aktiv index
  setLastReadTimestamp, // DM mesajın oxunma vaxtı — { [chatId]: Date }
) {
  // useEffect — komponentin mount olduğunda 1 dəfə işləyir
  // [userId] — dependency array: yalnız userId dəyişəndə yenidən işləyir
  useEffect(() => {
    // conn: SignalR connection obyekti — cleanup funksiyasında istifadə üçün
    let conn = null;

    // ─── handleNewDirectMessage ────────────────────────────────────────────────
    // Server "NewDirectMessage" event-i göndərəndə çağırılır (yeni DM mesaj)
    // 2 işi var:
    //   1. Əgər bu conversation açıqdırsa — messages state-ə əlavə et
    //   2. Conversation list-dəki son mesajı yenilə
    function handleNewDirectMessage(message) {
      // isOpenChat — bu conversation hal-hazırda açıqdırmı?
      let isOpenChat = false;

      setSelectedChat((current) => {
        if (
          current &&
          current.type === 0 &&
          current.id === message.conversationId
        ) {
          isOpenChat = true;
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            setShouldScrollBottom(true);
            return [message, ...prev];
          });
        }
        return current;
      });

      // Conversation list-dəki son mesajı yenilə (və ya yeni conversation əlavə et)
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === message.conversationId);

        // ── Yeni conversation (ilk mesaj) — listdə yoxdur → yarat və başa əlavə et ──
        if (!exists) {
          // Öz mesajımızın echo-su — conversation-ı handleSendMessage yaradacaq,
          // burada yaratma (yanlış ad və unread count olar)
          if (message.senderId === userId) return prev;

          const newConv = {
            id: message.conversationId,
            name: message.senderFullName,
            type: 0, // DM
            avatarUrl: message.senderAvatarUrl,
            otherUserId: message.senderId,
            lastMessage: message.content,
            lastMessageAtUtc: message.createdAtUtc,
            lastMessageSenderId: message.senderId,
            lastMessageSenderFullName: message.senderFullName,
            lastMessageSenderAvatarUrl: message.senderAvatarUrl,
            lastMessageStatus: null,
            unreadCount: isOpenChat ? 0 : 1,
            _lastProcessedMsgId: message.id,
          };
          return [newConv, ...prev];
        }

        // ── Mövcud conversation — yenilə ──
        const updated = prev.map((c) => {
          if (c.id === message.conversationId) {
            // Duplicate check — hybrid broadcast eyni mesajı 2 dəfə göndərə bilər
            const isDuplicate = c._lastProcessedMsgId === message.id;
            return {
              ...c,
              _lastProcessedMsgId: message.id,
              lastMessage: message.content,
              lastMessageAtUtc: message.createdAtUtc,
              lastMessageSenderId: message.senderId,
              lastMessageSenderFullName: message.senderFullName,
              lastMessageSenderAvatarUrl: message.senderAvatarUrl,
              lastMessageStatus: message.senderId === userId ? "Sent" : c.lastMessageStatus,
              // Başqasının mesajı + chat açıq deyilsə + duplicate deyilsə → unread artır
              unreadCount:
                message.senderId !== userId && !isOpenChat && !isDuplicate
                  ? c.unreadCount + 1
                  : c.unreadCount,
            };
          }
          return c;
        });
        // Yeni mesajlı conversation-ı siyahının başına gətir
        const idx = updated.findIndex((c) => c.id === message.conversationId);
        if (idx > 0) {
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
        }
        return updated;
      });
    }

    // ─── handleNewChannelMessage ───────────────────────────────────────────────
    // handleNewDirectMessage-ın Channel versiyası (type === 1)
    function handleNewChannelMessage(message) {
      let isOpenChat = false;

      setSelectedChat((current) => {
        if (current && current.type === 1 && current.id === message.channelId) {
          isOpenChat = true;
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            setShouldScrollBottom(true);
            return [message, ...prev];
          });
        }
        return current;
      });

      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id === message.channelId) {
            // Duplicate check — hybrid broadcast eyni mesajı 2 dəfə göndərə bilər
            const isDuplicate = c._lastProcessedMsgId === message.id;
            return {
              ...c,
              _lastProcessedMsgId: message.id,
              lastMessage: message.content,
              lastMessageAtUtc: message.createdAtUtc,
              lastMessageSenderId: message.senderId,
              lastMessageSenderFullName: message.senderFullName,
              lastMessageSenderAvatarUrl: message.senderAvatarUrl,
              lastMessageStatus: message.senderId === userId ? "Sent" : c.lastMessageStatus,
              unreadCount:
                message.senderId !== userId && !isOpenChat && !isDuplicate
                  ? c.unreadCount + 1
                  : c.unreadCount,
            };
          }
          return c;
        });
        // Yeni mesajlı channel-ı siyahının başına gətir
        const idx = updated.findIndex((c) => c.id === message.channelId);
        if (idx > 0) {
          const [item] = updated.splice(idx, 1);
          updated.unshift(item);
        }
        return updated;
      });
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
    // "Soft delete" — mesajı silirik deyil, isDeleted: true edirik
    // UI-da: "This message was deleted." göstərilir
    function handleMessageDeleted(deletedMsg) {
      setMessages((prev) =>
        prev.map((m) => (m.id === deletedMsg.id ? { ...m, isDeleted: true } : m)),
      );
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
    function handleReactionsUpdated(data) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m,
        ),
      );
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
    startConnection()
      .then((c) => {
        conn = c; // cleanup üçün saxla
        // Hər event adı — server-dəki ChatHub-da public method/invoke adıdır
        conn.on("NewDirectMessage", handleNewDirectMessage);
        conn.on("NewChannelMessage", handleNewChannelMessage);
        conn.on("MessageRead", handleMessageRead);
        conn.on("UserOnline", handleUserOnline);
        conn.on("UserOffline", handleUserOffline);
        conn.on("UserTypingInConversation", handleUserTypingInConversation);
        conn.on("UserTypingInChannel", handleUserTypingInChannel);
        conn.on("DirectMessagePinned", handleMessagePinned);
        conn.on("DirectMessageUnpinned", handleMessageUnpinned);
        conn.on("ChannelMessagePinned", handleMessagePinned);
        conn.on("ChannelMessageUnpinned", handleMessageUnpinned);
        conn.on("DirectMessageDeleted", handleMessageDeleted);
        conn.on("ChannelMessageDeleted", handleMessageDeleted);
        conn.on("DirectMessageEdited", handleMessageEdited);
        conn.on("ChannelMessageEdited", handleMessageEdited);
        conn.on("ChannelMessageReactionsUpdated", handleReactionsUpdated);
        conn.on("DirectMessageReactionToggled", handleReactionsUpdated);
        conn.on("ChannelMessagesRead", handleChannelMessagesRead);
        conn.on("AddedToChannel", handleAddedToChannel);
      })
      .catch((err) => console.error("SignalR connection failed:", err));

    // ─── Cleanup Function ─────────────────────────────────────────────────────
    // useEffect-in return etdiyi funksiya — komponent unmount olduqda çağırılır.
    // .NET-də: IDisposable.Dispose() kimi.
    // conn.off() — handler-ları sil. Əks halda memory leak + duplicate event-lər olar.
    return () => {
      if (conn) {
        conn.off("NewDirectMessage", handleNewDirectMessage);
        conn.off("NewChannelMessage", handleNewChannelMessage);
        conn.off("MessageRead", handleMessageRead);
        conn.off("UserOnline", handleUserOnline);
        conn.off("UserOffline", handleUserOffline);
        conn.off("UserTypingInConversation", handleUserTypingInConversation);
        conn.off("UserTypingInChannel", handleUserTypingInChannel);
        conn.off("DirectMessagePinned", handleMessagePinned);
        conn.off("DirectMessageUnpinned", handleMessageUnpinned);
        conn.off("ChannelMessagePinned", handleMessagePinned);
        conn.off("ChannelMessageUnpinned", handleMessageUnpinned);
        conn.off("DirectMessageDeleted", handleMessageDeleted);
        conn.off("ChannelMessageDeleted", handleMessageDeleted);
        conn.off("DirectMessageEdited", handleMessageEdited);
        conn.off("ChannelMessageEdited", handleMessageEdited);
        conn.off("ChannelMessageReactionsUpdated", handleReactionsUpdated);
        conn.off("DirectMessageReactionToggled", handleReactionsUpdated);
        conn.off("ChannelMessagesRead", handleChannelMessagesRead);
        conn.off("AddedToChannel", handleAddedToChannel);
      }
    };
  }, [userId]); // [userId] — yalnız userId dəyişsə yenidən qur (re-login kimi)
}
