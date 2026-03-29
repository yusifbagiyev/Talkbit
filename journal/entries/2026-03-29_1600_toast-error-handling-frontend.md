# Frontend Task: Toast Error Handling + Missing Error Messages

**From**: Product Owner
**To**: Frontend Developer
**Date**: 2026-03-29
**Priority**: P1

---

## Problem

API xətaları bəzi yerlərdə toast ilə göstərilmir — yalnız `console.error` ilə loglanır. İstifadəçi xətanı görmür.

---

## Fix 1: Conversation Start — Toast əlavə et

**File:** `chatapp-frontend/src/pages/Chat.jsx`

### Location 1 (~line 3636-3638): Avatar menu-dan DM açma

```js
// Köhnə:
} catch (err) {
  console.error("Failed to open DM:", err);
}

// Yeni:
} catch (err) {
  showToast(err.message || "Failed to open conversation", "error");
}
```

### Location 2 (~line 996-1015): Search-dan user seçmə

```js
// Köhnə:
} catch (err) {
  console.error("Failed to create conversation:", err);
}

// Yeni:
} catch (err) {
  showToast(err.message || "Failed to create conversation", "error");
}
```

### Location 3 (~line 3997): Profile sidebar — artıq düzgündür ✅

---

## Fix 2: Message Send — Toast əlavə et

**File:** `chatapp-frontend/src/pages/Chat.jsx`

`handleSendMessage` funksiyasında (console-da error görünür amma toast yoxdur):

```
Failed to send message: Error: Cannot start a conversation with a user from a different company
```

Əgər mesaj göndərmə xətası toast ilə göstərilmirsə, əlavə et:

```js
} catch (err) {
  showToast(err.message || "Failed to send message", "error");
}
```

---

## Yoxlama Siyahısı

- [ ] Avatar menu DM — toast göstərilir
- [ ] Search user DM — toast göstərilir
- [ ] Message send error — toast göstərilir
- [ ] Profile sidebar DM — artıq düzgündür (yoxla)
