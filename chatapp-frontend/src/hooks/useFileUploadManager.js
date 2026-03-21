// ─── useFileUploadManager.js — Global File Upload Manager ────────────────────
// Bu hook bütün aktiv fayl upload-larını idarə edir.
// Conversation dəyişdikdə belə upload-lar davam edir (cross-conversation persistence).
//
// Hər fayl ayrı task olaraq izlənir:
//   uploading → sending → completed (və ya failed/cancelled)
//
// MessageBubble upload overlay-i bu hook-dan gələn data ilə render olunur.

import { useRef, useState, useCallback } from "react";
import { apiUpload, apiPost } from "../services/api";
import { getChatEndpoint } from "../utils/chatUtils";

// ─── Constants ──────────────────────────────────────────────────────────────
const PROGRESS_THROTTLE_MS = 100; // Re-render throttle (max 10/s)

// ─── readImageDimensions — lokal şəkil ölçülərini oxu ──────────────────────
// Layout shift-in qarşısını almaq üçün: upload zamanı container eyni ölçüdə olur
function readImageDimensions(file) {
  return new Promise((resolve) => {
    if (!file.type?.startsWith("image/")) {
      resolve({ width: null, height: null });
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

// ─── useFileUploadManager ───────────────────────────────────────────────────
export default function useFileUploadManager(user, onFallbackReload, onMessageSent) {
  // useRef — async callback-larda stale closure problemi olmadan Map-ə çatmaq üçün
  const uploadsRef = useRef(new Map());
  const onFallbackReloadRef = useRef(onFallbackReload);
  onFallbackReloadRef.current = onFallbackReload; // stale closure qorunması
  const onMessageSentRef = useRef(onMessageSent);
  onMessageSentRef.current = onMessageSent; // stale closure qorunması
  // useState — re-render trigger üçün (uploadTasks dəyişdikdə UI yenilənir)
  const [uploadTasks, setUploadTasks] = useState([]);
  // Throttle üçün son update vaxtı
  const lastUpdateRef = useRef(0);
  const pendingUpdateRef = useRef(null);

  // ─── sync — Map-dən state array-a sinxronizasiya (re-render trigger) ──────
  const sync = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed < PROGRESS_THROTTLE_MS) {
      // Throttle — çox tez-tez update etmə
      if (!pendingUpdateRef.current) {
        pendingUpdateRef.current = setTimeout(() => {
          pendingUpdateRef.current = null;
          lastUpdateRef.current = Date.now();
          setUploadTasks([...uploadsRef.current.values()]);
        }, PROGRESS_THROTTLE_MS - elapsed);
      }
      return;
    }

    lastUpdateRef.current = now;
    setUploadTasks([...uploadsRef.current.values()]);
  }, []);

  // ─── syncImmediate — throttle olmadan dərhal sync (status dəyişikliklər üçün) ──
  const syncImmediate = useCallback(() => {
    if (pendingUpdateRef.current) {
      clearTimeout(pendingUpdateRef.current);
      pendingUpdateRef.current = null;
    }
    lastUpdateRef.current = Date.now();
    setUploadTasks([...uploadsRef.current.values()]);
  }, []);

  // ─── processUpload — tək faylın upload + mesaj göndərmə prosesi ───────────
  const processUpload = useCallback(async (task) => {
    const map = uploadsRef.current;
    const current = map.get(task.tempId);
    if (!current || current.status === "cancelled") return;

    try {
      // 1. Faylı yüklə
      const formData = new FormData();
      formData.append("file", task.file);

      const uploadResult = await apiUpload(
        "/api/files/upload",
        formData,
        ({ loaded, total }) => {
          const t = map.get(task.tempId);
          if (!t || t.status !== "uploading") return;
          t.uploadedBytes = loaded;
          t.totalBytes = total;
          sync();
        },
        task.abortController,
      );

      // Upload tamamlandı — status: sending
      const t = map.get(task.tempId);
      if (!t) return;
      t.status = "sending";
      t.fileId = uploadResult.fileId;
      syncImmediate();

      // 2. Mesajı göndər
      const endpoint = getChatEndpoint(task.chatId, task.chatType, "/messages");
      if (!endpoint) throw new Error("Invalid chat endpoint");

      await apiPost(endpoint, {
        content: task.text || "",
        fileId: uploadResult.fileId,
        replyToMessageId: task.replyToMessageId || null,
        ...(task.mentions?.length > 0 ? { mentions: task.mentions } : {}),
      });

      // 3. Mesaj göndərildi — "sent" statusuna keç
      // Upload mesajını SİLMƏ — SignalR echo gələnə qədər görünməyə davam etsin
      // SignalR echo gəldikdə useChatSignalR prev.filter(m => !m._optimistic) ilə
      // messages state-dən silir, amma upload mesajları messagesWithUploads-dadır.
      // Ona görə burada "sent" status-u qoyuruq — upload overlay silinir,
      // mesaj normal görünür. SignalR echo real mesajı gətirəndə checkForCompletion
      // (Chat.jsx-dən çağırılan) upload task-ı silir.
      const t2 = map.get(task.tempId);
      if (t2) {
        t2.status = "sent";
        t2.uploadedBytes = t2.totalBytes; // progress 100%
        syncImmediate();

        // ConversationList-də statusu "Sent" et — DM ilə eyni davranış
        onMessageSentRef.current?.(task.chatId, task.chatType);

        // Dərhal mesajları reload et — SignalR echo-ya bel bağlama
        // Timer-ləri saxla ki, task silinəndə cleanup olsun
        const timers = [];

        // 1 saniyə gözlə ki, server mesajı DB-ə yazıb bitirsin
        timers.push(setTimeout(() => {
          const remaining = map.get(task.tempId);
          if (remaining && remaining.status === "sent") {
            onFallbackReloadRef.current?.(task.chatId, task.chatType);
          }
        }, 1000));

        // Fallback: 8 saniyə sonra — hələ "sent" statusundadırsa yenidən reload et
        timers.push(setTimeout(() => {
          const remaining = map.get(task.tempId);
          if (remaining && remaining.status === "sent") {
            onFallbackReloadRef.current?.(task.chatId, task.chatType);
          }
        }, 8000));

        // Safety net: 15 saniyə sonra — hələ silinməyibsə təmizlə
        timers.push(setTimeout(() => {
          const remaining = map.get(task.tempId);
          if (remaining) {
            if (remaining.previewUrl) URL.revokeObjectURL(remaining.previewUrl);
            map.delete(task.tempId);
            syncImmediate();
          }
        }, 15000));

        // Timer-ləri task-a bağla — checkForCompletion/removeUpload-da cleanup üçün
        t2._timers = timers;
      }
    } catch (err) {
      if (err?.name === "AbortError") {
        // Cancel — task-ı sil
        const t = map.get(task.tempId);
        if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
        map.delete(task.tempId);
        syncImmediate();
        return;
      }
      // Failure — retry button göstər
      const t = map.get(task.tempId);
      if (t) {
        t.status = "failed";
        t.error = err?.message || "Upload uğursuz oldu";
        syncImmediate();
      }
    }
  }, [sync, syncImmediate]);

  // ─── startUpload — faylları upload etməyə başla ──────────────────────────
  // FilePreviewPanel-dən send basıldıqda çağırılır
  const startUpload = useCallback(async (files, chatId, chatType, text, replyTo, mentions) => {
    const map = uploadsRef.current;
    const tempIds = [];

    // Şəkil ölçülərini paralel oxu (layout shift-in qarşısını almaq üçün)
    const dimensionResults = await Promise.all(
      files.map((file) => readImageDimensions(file)),
    );

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${i}`;
      const isImage = file.type?.startsWith("image/");
      const dims = dimensionResults[i];

      const task = {
        tempId,
        chatId,
        chatType,
        file,
        previewUrl: isImage ? URL.createObjectURL(file) : null,
        fileName: file.name,
        fileSizeInBytes: file.size,
        fileContentType: file.type || "",
        fileWidth: dims.width,    // Lokal şəkil ölçüsü → layout shift yox
        fileHeight: dims.height,
        // Yalnız ilk fayl text və reply daşıyır
        text: i === 0 ? (text || "") : "",
        replyToMessageId: i === 0 ? (replyTo?.id || null) : null,
        replyToContent: i === 0 ? (replyTo?.content || null) : null,
        replyToSenderName: i === 0 ? (replyTo?.senderFullName || null) : null,
        mentions: i === 0 ? (mentions || []) : [],
        uploadedBytes: 0,
        totalBytes: file.size,
        status: "uploading",
        abortController: new AbortController(),
        error: null,
        fileId: null,
        createdAtUtc: new Date().toISOString(),
      };

      map.set(tempId, task);
      tempIds.push(tempId);
    }

    syncImmediate();

    // Hər faylın upload-unu ayrı-ayrı başlat (parallel)
    for (const tempId of tempIds) {
      const task = map.get(tempId);
      if (task) processUpload(task);
    }

    return tempIds;
  }, [processUpload, syncImmediate]);

  // ─── cancelUpload — upload-u ləğv et ────────────────────────────────────
  const cancelUpload = useCallback((tempId) => {
    const map = uploadsRef.current;
    const task = map.get(tempId);
    if (!task) return;
    task.status = "cancelled";
    task.abortController.abort();
    // AbortError handler Map-dən siləcək
  }, []);

  // ─── retryUpload — uğursuz upload-u yenidən başlat ───────────────────────
  const retryUpload = useCallback((tempId) => {
    const map = uploadsRef.current;
    const task = map.get(tempId);
    if (!task || task.status !== "failed") return;

    // Yeni AbortController yarat, status-u reset et
    task.abortController = new AbortController();
    task.status = "uploading";
    task.uploadedBytes = 0;
    task.error = null;
    task.fileId = null;
    syncImmediate();

    processUpload(task);
  }, [processUpload, syncImmediate]);

  // ─── getUploadsForChat — müəyyən chat-ın aktiv upload-ları ────────────────
  const getUploadsForChat = useCallback((chatId) => {
    if (!chatId) return [];
    return uploadTasks.filter(
      (t) => t.chatId === chatId && t.status !== "cancelled",
    );
  }, [uploadTasks]);

  // ─── checkForCompletion — real mesaj gəldikdə upload task-ı sil ──────────
  // SignalR echo gəlir → real mesaj messages-ə əlavə olunur → bu funksiya çağırılır
  // fileId ilə uyğun upload task-ı tapıb silir (flash-sız keçid)
  const checkForCompletion = useCallback((incomingFileId) => {
    if (!incomingFileId) return;
    const map = uploadsRef.current;
    for (const [tempId, task] of map) {
      if (task.fileId === incomingFileId && (task.status === "sent" || task.status === "sending")) {
        // Pending timer-ləri ləğv et — artıq lazım deyil
        if (task._timers) task._timers.forEach(clearTimeout);
        if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
        map.delete(tempId);
        syncImmediate();
        return;
      }
    }
  }, [syncImmediate]);

  // ─── removeUpload — task-ı sil ───────────────────────────────────────────
  const removeUpload = useCallback((tempId) => {
    const map = uploadsRef.current;
    const task = map.get(tempId);
    if (task) {
      if (task._timers) task._timers.forEach(clearTimeout);
      if (task.previewUrl) URL.revokeObjectURL(task.previewUrl);
    }
    map.delete(tempId);
    syncImmediate();
  }, [syncImmediate]);

  return {
    uploadTasks,
    startUpload,
    cancelUpload,
    retryUpload,
    getUploadsForChat,
    removeUpload,
    checkForCompletion,
  };
}
