# Lessons Learned - ChatApp

## React Migration

- User is learning React from zero. Explain EVERY concept before using it.
- User types code manually to learn. Don't auto-generate large files.
- Teach one concept at a time. Don't rush.
- Always compare React concepts to .NET equivalents when possible.
- User works on 2 different PCs. Always update todo.md so progress syncs via GitHub.

## Project Rules

- Backend is complete and working. Don't modify backend code while there is need to change for increasing performance.
- Frontend was Blazor WASM, migrating to React due to UI freezing.
- **Bitrix24 style UI** is the target design. NOT WhatsApp. Full layout: sol navigation menu + messenger panel.
- **BÜTÜN frontend kodlarını user özü yazır**. Heç bir kodu özün yazma (Edit/Write ilə). İzah et, user yazsın, sonra yoxla. Bug fix daxil — HƏR ŞEYİ user yazır.

## Critical: Backend Configuration

- **Backend URL: `http://localhost:7000`** — NEVER assume a port. Always check `launchSettings.json` first.
- **CORS allowed origins:** `http://localhost:5300`, `http://localhost:5301`, `http://localhost:5173`
- **React Vite runs on default port 5173** (user added it to backend CORS).
- RULE: Before writing ANY URL/port in code, ALWAYS verify from `launchSettings.json` or config files. NEVER guess.

## Mistakes Log

| Date       | Mistake                                                                                                      | Fix                                                      | Rule                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-02-15 | Wrote `localhost:5000` for backend API                                                                       | Correct port is `7000` (from launchSettings.json)        | ALWAYS check launchSettings.json before writing any URL                                                                                                                                                                                                                                                                                                                                      |
| 2026-02-16 | Created files directly instead of letting user type manually                                                 | Deleted the file, re-explained code for user to type     | NEVER use Write/Edit to create/modify frontend code. ONLY explain — user types manually                                                                                                                                                                                                                                                                                                      |
| 2026-02-16 | Said "WhatsApp style" but user wants Bitrix24 style                                                          | Updated lessons and todo                                 | ALWAYS confirm design reference with user. Target is Bitrix24, NOT WhatsApp                                                                                                                                                                                                                                                                                                                  |
| 2026-02-16 | Made terrible CSS layout — sidebar overlapped content, used fake data                                        | Must rewrite CSS from scratch, use real backend API data | ALWAYS test CSS visually. NEVER use fake/hardcoded data — use real API from day 1. CSS must be pixel-perfect.                                                                                                                                                                                                                                                                                |
| 2026-02-17 | Used string comparison for enum types (`chat.type === "Conversation"`) but backend sends numbers (`0, 1, 2`) | Changed to number comparison (`chat.type === 0`)         | Backend uses C# enums without JsonStringEnumConverter. ALWAYS check if enum is serialized as string or number. C# default = number. Rule: `0 = Conversation, 1 = Channel, 2 = DepartmentUser`                                                                                                                                                                                                |
| 2026-02-17 | Wrote JSX code directly with Edit tool instead of explaining to user                                         | User reminded again                                      | CSS-dən başqa HEÇBIR frontend koduna Edit/Write ilə əl vurma. Əvvəlcə izah et, user özü yazsın. Sonra sən yoxla, test et. Bu ƏSAS QAYDADIR.                                                                                                                                                                                                                                                  |
| 2026-02-17 | Infinite scroll up bug — sonsuz request, tullanma, yanlış array sırası                                       | Blazor implementasiyasını araşdırıb həll tapıldı         | YENİ funksiya yazmazdan ƏVVƏL: 1) Blazor-da necə edildiyini araşdır 2) Pattern-i React-a uyğunlaşdır. useRef flag, hasMore flag, useLayoutEffect+flushSync scroll bərpası                                                                                                                                                                                                                    |
| 2026-02-17 | Yeni kod yazanda user-ə göstərmədən özü yazdı, bug fix zamanı isə izah edib vaxt itirdi                      | User qaydanı dəqiqləşdirdi                               | YENİ KOD → user-ə göstər, user yazsın. MÖVCUD KODDA BUG FIX / DƏYİŞİKLİK → birbaşa özün Edit ilə düzəlt.                                                                                                                                                                                                                                                                                     |
| 2026-02-19 | Scroll zamanı donma — hər hover-da bütün MessageBubble-lar re-render olurdu                                  | React.memo + useMemo + useCallback ilə həll              | **React Performans Pattern**: 1) List komponentləri `React.memo` ilə wrap et 2) Bahalı hesablamaları `useMemo` ilə memoize et 3) Child-a ötürülən callback-ları `useCallback` ilə stabilləşdir 4) Parent state dəyişikliyi (hover kimi) child-lara yayılmasın — local state istifadə et 5) `selectedChat` kimi object prop-lar memo-nu pozur — gələcəkdə primitive prop-lara keçmək lazımdır |
| 2026-02-20 | EF Core `record` constructor call in LINQ Select — Where clause could not be translated                       | `record` → `class` with `init` properties + object initializer | **EF Core LINQ Projection Rule**: HEÇVAXT `select new RecordType(param1, param2, ...)` constructor call istifadə etmə — EF Core bunu SQL-ə çevirə bilmir. HƏMİŞƏ `select new ClassName { Prop = val }` object initializer istifadə et. `record` əvəzinə `class` with `init` properties yaz. |
| 2026-02-23 | Arxitektura pattern-i pozma riski — düşüncə prosesində controller-ə repository inject etməyi düşündüm | MediatR/CQRS pattern-ə sadiq qaldım — Query+Handler yaratdım | **Arxitektura Qorunması**: Kodun mövcud pattern-ini HƏMİŞƏ qoru. Controller-ə YALNIZ `IMediator` inject olunmalıdır. Bütün business logic Handler-da olmalıdır. Yeni endpoint yaradarkən: 1) Mövcud endpoint-lərin pattern-inə bax 2) Query/Command + Handler yarat 3) Controller-dən yalnız `_mediator.Send()` çağır 4) Repository/UnitOfWork yalnız Handler-da istifadə et |
| 2026-02-23 | `JsonStringEnumConverter` Program.cs-ə qlobal əlavə edildikdə BÜTÜN enum-lar string oldu, frontend sındı | Qlobal converter silindi, yalnız `NodeType` enum-una `[JsonConverter(typeof(JsonStringEnumConverter))]` attribute əlavə edildi | **JsonStringEnumConverter Qaydası**: HEÇVAXT qlobal `AddJsonOptions`-da istifadə etmə — bütün enum-lara təsir edir. Əvəzinə yalnız lazımlı enum-a `[JsonConverter(typeof(JsonStringEnumConverter))]` attribute əlavə et. Bu təhlükəsizdir və yalnız o enum-u string edir. |
| 2026-02-23 | İlk həll olaraq frontend-ə normalizeConversationType() workaround yazdım — hər API response-da, hər SignalR handler-da çağırmaq lazım idi | Problemi kökündən həll etdim — qlobal converter-i silib, yalnız lazımlı enum-a attribute əlavə etdim | **Optimizasiya Prinsipi**: HƏMİŞƏ ilk həlldən sonra dayanıb "daha optimal variant varmı?" soruşmaq lazımdır. Workaround (hər yerdə normalize çağırmaq) əvəzinə kök səbəbi həll et (qlobal converter-i sil). Hər bir dəyişikliyin: 1) Performansa təsirini düşün 2) Minimal kod dəyişikliyi ilə həll tap 3) Gələcəkdə borc yaratmayacaq variant seç 4) Workaround yazmaq əvəzinə problemi kökündən həll et |
| 2026-02-24 | Frontend koddakı kommentə güvənib backend konfiqurasiyanı yoxlamadım — `api.js` "JWT 30 dəq" yazırdı amma `appsettings.json`-da 15 dəq idi. Nəticədə proactive refresh timer (25 dəq) access token-dan (15 dəq) GEC işləyirdi → 10 dəqiqəlik boşluq → 401 seli → infinite loop | Timer-i 25 → 12 dəqiqəyə endirdim, `sessionExpired` kill switch əlavə etdim | **Kommentə GÜVƏNMƏ, Mənbəni YOXLA**: Frontend-dəki comment/dəyər backend konfiqurasiyasına istinad edirsə, HƏMİŞƏ backend-dəki real dəyəri yoxla (`appsettings.json`, `launchSettings.json`). Koddakı comment köhnəlmiş ola bilər. Timing/interval/timeout kimi dəyərlərdə **uyğunsuzluq** kritik bug-lara səbəb olur. QAYDA: Backend konfiqurasiyasına bağlı olan hər frontend dəyərini yazmazdan əvvəl backend mənbəyini oxu. |

### Lesson: Always check imports when using functions in new JSX sections
- **Date**: 2026-03-03
- **Context**: Added detail sidebar to Chat.jsx using `getAvatarColor()` and `getInitials()` from chatUtils.js
- **Mistake**: Functions were imported in ChatHeader.jsx but NOT in Chat.jsx. Using them in sidebar JSX caused `ReferenceError: getAvatarColor is not defined` → React 18 unmounts entire tree → blank white page
- **Rule**: When adding new JSX that uses utility functions, ALWAYS verify they are imported in the current file, not just in child components
- **Debug tip**: Blank white page in React 18 = unhandled render error. Check browser console (F12) for the actual error message first

### Lesson: EF Core tracking + DDD Aggregate child entity əlavəsi
- **Date**: 2026-03-03
- **Context**: `Channel.AddMember()` ilə child entity (`ChannelMember`) əlavə etdik. `GetByIdWithMembersAsync` tracked entity qaytarır, `_members.Add()` + `UpdateTimestamp()` sonra `SaveChanges()` → `DbUpdateConcurrencyException`
- **Mistake**: DDD Aggregate pattern-ə kor-koranə əməl edib, EF Core infrastrukturunu analiz etmədən `AddMember` domain metodu yazdım. EF Core tracked parent entity-nin child collection-una əlavə edərkən tracking conflict yaradır.
- **Rule**: Domain entity-ə child əlavə/silmə metodu yazmadan ƏVVƏL layihənin EF Core infrastrukturunu yoxla: 1) Repository tracking davranışı (AsNoTracking?) 2) UpdateAsync nə edir 3) Concurrency token varmı 4) Test et. Əgər EF tracking conflict yaradırsa, **ValidateOnly + Repository.AddAsync** pattern istifadə et — domain yalnız qaydaları yoxlayır, persistence application layer-da olur.
- **Pattern**: `channel.ValidateAddMember()` (yalnız validation) + `_unitOfWork.ChannelMembers.AddAsync()` (persistence)

### Lesson: Yeni frontend kodu da birbaşa yaz
- **Date**: 2026-03-09
- **Context**: ImageViewer.jsx yeni komponent idi, user-ə izah edib yazdırmağa başladım
- **Mistake**: Mövcud kodları (MessageBubble, Chat.jsx, CSS) birbaşa özüm yazdım, amma yeni komponenti user-ə öyrətməyə çalışdım — user haqlı olaraq "bu vaxta kimi özün etdin, indi mənə öyrədirsən?" dedi
- **Rule**: Əgər task bug fix / feature implementasiyasıdırsa — həm mövcud kod dəyişikliyi, həm də yeni fayl yaratma birbaşa özün et. "User özü yazsın" qaydası YALNIZ React öyrətmə sessiyalarında (step-by-step migration) keçərlidir, normal development zamanı yox.

### Lesson: useState vs useMemo — setter funksiyası yoxlama
- **Date**: 2026-03-13
- **Context**: `handleSelectChat`-a `setNewUnreadCount(0)` əlavə etdim, amma `newUnreadCount` useState deyil, useMemo idi. `setNewUnreadCount` mövcud olmadığına görə `ReferenceError` atıldı.
- **Mistake**: State variable-ın necə yaradıldığını yoxlamadan setter funksiyası çağırdım. Xəta try-catch-finally blokunda XARIC idi, ona görə `setChatLoading(false)` heç vaxt çağırılmadı → loading sonsuz qaldı.
- **Rule**: Hər hansı `setXxx()` çağırmazdan əvvəl HƏMİŞƏ `useState` yoxsa `useMemo`/`useRef` olduğunu yoxla. useMemo-nun setter-i yoxdur — o hesablanan dəyərdir. Əgər sıfırlamaq lazımdırsa, dependency-lərini sıfırla (məsələn `setMessages([])` → useMemo avtomatik yenilənir).

### Lesson: try-catch-finally scope — əvvəlki kod unhandled qalır
- **Date**: 2026-03-13
- **Context**: `setChatLoading(true)` try blokunda XARIC idi (1496-cı sətir), `setChatLoading(false)` isə finally blokunda (1775-ci sətir). Aradakı `setNewUnreadCount(0)` ReferenceError atdıqda, finally bloku heç vaxt işləmədi.
- **Rule**: Əgər bir state/ref `true` set edilib sonra `finally`-də `false` olunursa, `true` set edildikdən sonrakı BÜTÜN kod try bloku daxilində olmalıdır. try-catch-finally-nin coverage-i `setChatLoading(true)` setindən dərhal SONRA başlamalıdır. Əks halda aradakı unhandled error loading-i sonsuza kimi bloklaya bilər.

### Lesson: Performans optimizasiyası zamanı diqqətli ol
- **Date**: 2026-03-14
- **Rule**: useCallback/useMemo/React.memo əlavə edərkən:
  1. İşləyən funksiyanı POZMA — əvvəl kodu oxu, davranışı anla
  2. Hər dəyişiklikdən sonra build yoxla + eslint xətalarını düzəlt
  3. useCallback dependency array-ı düzgün yaz — əskik dep = stale closure bug
  4. React.memo əlavə edərkən parent-dən gələn inline arrow-ları da useCallback-ə çevir, əks halda memo heç işləməz
  5. Hook dependency dəyişdirərkən (useMention kimi) əvvəlki davranışı test et

### Lesson: CSS dəyişiklik işləmirsə — inline style yoxla, kök səbəbi tap
- **Date**: 2026-03-14
- **Context**: Image+text bubble-da şəkil kənarlarında F0F6EE background göstərmək istədik. `object-fit: contain`, `max-width`, `display: flex` — heç biri işləmədi. 4-5 dəfə yanlış yanaşma sınandı.
- **Kök səbəb**: React-dan gələn inline `style={{ aspectRatio: "1080/1920", maxHeight: 400 }}` konteynerin **enini daraldırdı**. `aspect-ratio` + `max-height` = brauzer eni proporsional kiçildir (məs: maxH=400, ratio=9:16 → en=225px). Konteyner şəkil qədər olur → kənarda F0F6EE üçün yer qalmır.
- **Həll**: `aspect-ratio: auto !important` — inline style-ı override edir, konteyner tam eni tutur.
- **Rule**:
  1. CSS dəyişiklik **görünmürsə** → ilk addım: brauzerdə DevTools açıb elementin **computed styles** və **inline styles**-ına bax. React `style={}` prop-u CSS-dən güclüdür
  2. `aspect-ratio` + `max-height`/`max-width` birlikdə istifadə edildikdə brauzer DİGƏR ölçünü proporsional kiçildir — bu gözlənilməz davranışdır
  3. Inline style-ı CSS-dən override etmək üçün `!important` lazımdır
  4. User konkret rəng deyirsə (F0F6EE), DƏQIQ o rəngi istifadə et — özündən "daha yaxşı" variant uydurma (#c8e6c9 kimi)
  5. **Kor-koranə CSS property dəyişmə** — əvvəl problemi anla, SONRA bir dəyişiklik et. 4-5 fərqli yanaşma sınamaq əvəzinə, DevTools-da kök səbəbi tap

### Lesson: SignalR notification metodlarını yazarkən dublikat göndərmə və lazımsız log yoxla
- **Date**: 2026-03-15
- **Context**: DM metodlarında həm group-a, həm receiver-in connection-larına eyni event göndərilirdi → receiver 2 dəfə alırdı. Həmçinin bütün metodlarda `LogDebug` var idi — production-da görünmür, amma hər çağırışda parse yükü yaradır.
- **Mistake**: Kodu refactor/optimize edərkən bu problemləri görmədim, user soruşana qədər yadıma düşmədi.
- **Rule**:
  1. **Dublikat göndərmə yoxla**: Eyni event-i həm group-a, həm birbaşa connection-lara göndərmə. Biri kifayətdir — receiver-in ID-sini bilirsənsə birbaşa connection-larına göndər
  2. **Lazımsız log-ları sil**: `LogDebug` production-da görünmür, yüksək trafik servislərdə (SignalR, messaging) əlavə yükdür. Yalnız `Warning/Error` level saxla
  3. **Kod oxuyarkən "bu doğrudur?" soruşmağı unutma**: Refactor/optimize edərkən yalnız strukturu deyil, hər metodun davranışını da yoxla — dublikat, boş group-a göndərmə, lazımsız parametrlər kimi problemləri axtar
  4. **Dead code və istifadəsiz group-ları tap**: Refactor edərkən interface/implementation-da olan amma heç yerdən çağırılmayan metodları (`NotifyChannelMessageAsync` kimi), istifadəsiz SignalR group-ları (join/leave olunur amma notification göndərilmir), və qarışıq pattern-ləri (bəzi metodlar group-a, bəziləri direct-ə göndərir) proaktiv tapmalıyam. User soruşmağı gözləməməliyəm.

### Lesson: function → useCallback çevirərkən TDZ (Temporal Dead Zone) yoxla
- **Date**: 2026-03-14
- **Context**: `handlePinBarClick`-ı `function` → `const useCallback` çevirdim. Bu funksiya `handleScrollToMessage`-ı çağırırdı, amma `handleScrollToMessage` kodda AŞAĞIDA təyin olunmuşdu.
- **Mistake**: `function` hoisting olur (təyin olunmamışdan əvvəl istifadə oluna bilər), amma `const` hoisting OLMUR → `Cannot access before initialization` xətası.
- **Rule**: `function` → `const useCallback` çevirərkən HƏMİŞƏ dependency-lərin KOD SIRASInda ƏVVƏL təyin olunduğunu yoxla. Əgər dependency aşağıdadırsa, ya funksiyanı dependency-dən SONRAYA köçür, ya da ref pattern istifadə et.

### HƏLL EDİLMƏYƏN PROBLEM: EF Core backing field pattern + tracked entity
- **Date**: 2026-03-19
- **Context**: `ChannelMessage` entity-də backing field pattern istifadə olunur:
  ```csharp
  private readonly List<ChannelMessageReaction> _reactions = [];
  public IReadOnlyCollection<ChannelMessageReaction> Reactions => _reactions.AsReadOnly();

  public void ToggleReaction(...) {
      _reactions.Add(newReaction);  // or Remove
      UpdateTimestamp();
  }
  ```
- **Problem**:
  - `SendChannelMessage`-də YENİ message yaranır → `message.AddMention(mention)` → işləyir
  - `ToggleReaction`-da MÖVCUD message yüklənir → `message.ToggleReaction()` → `DbUpdateConcurrencyException`
  - Hər iki halda backing field pattern eynidir, hər ikisi parent entity-də child add edir
  - Fərq: biri Added state, biri tracked (yüklənmiş) entity
- **Sınaqlar**:
  1. `UpdateTimestamp()` çağırmaqla parent-i Modified state-ə keçirdik → işləmədi
  2. `Navigation(m => m.Reactions).UsePropertyAccessMode(PropertyAccessMode.Field)` konfiqurasiya əlavə etdik → işləmədi
  3. `ICollection` pattern-ə keçmək istədik amma user backing field pattern-də qalmaq istəyir
- **Nəticə**: MƏN BU PROBLEMİ HƏLL EDƏ BİLMİRƏM
  - Niyə SendMessage-də işləyib ToggleReaction-da işləmədiyini anlamıram
  - Backing field pattern + tracked entity + domain method birlikdə EF Core tracking problemi yaradır
  - Həll yolu: Repository pattern istifadə etmək (DirectMessage-də olduğu kimi child repository ilə add/remove)
  - İstifadəçi backing field pattern-i saxlamaq istəyir, amma domain method ilə işləmir

## CSS Architecture Rule (2026-03-19)

- **QAYDA**: Hər yeni komponent yaradılanda öz CSS faylı da yaradılmalıdır.
  - Fayl adı: `ComponentName.css` → `src/components/` qovluğunda
  - Import: komponentin içində `import "./ComponentName.css";`
  - Chat.css-ə stil əlavə etmə — yalnız `:root` variables, shared animations, və Chat.jsx-ə aid stillər orada qalır
- **Səbəb**: 7139 sətirlik monolitik Chat.css 16 komponent CSS faylına bölündü. Bakım, ad konflikti və ölü kod problemlərinin qarşısını alır.
- **Mövcud struktur**:
  - `Chat.css` → :root, animations, layout, chat-panel, messages-area (656 sətir)
  - Hər komponent öz CSS-i: Sidebar, ConversationList, ChatHeader, PinnedBar, MessageBubble, MessageActionMenu, ChatStatusBar, ReadersPanel, ChatInputArea, ForwardPanel, SelectToolbar, ChannelPanel, DetailSidebar, MentionPanel, FilePreviewPanel, ImageViewer

### Lesson: CSS scroll problemlərini aşkar et — kompleks yox, sadə həll tap
- **Date**: 2026-03-24
- **Context**: DetailSidebar `.ds-body`-nin scroll-u işləmirdi. Onlarla CSS cəhdi etdim (flex min-height, max-height, position:absolute, inline style) — heç biri işləmədi. Son həll: `.detail-sidebar`-ı scroll container et, header-i wrapper div ilə xaricə çıxar.
- **Mistake**: Eyni flex scroll fix-lərini (min-height:0, max-height calc, position absolute) dəfələrlə cəhd etdim. İşləmədikdə başqa yanaşmaya keçmək əvəzinə eyni yanaşmanı təkrarladım. CSS müasir olmayan scrollbar stili ucbatından test zamanı scrollbar görünmürdü.
- **Rule**: CSS problemi 2 cəhddə həll olunmursa, DƏRHAL fərqli yanaşmaya keç. Flex scroll işləmirsə → scroll container-i dəyiş (parent-i scroll et). Dəyişiklikləri tez test et — scrollbar invisible ola bilər, `overflow-y: scroll` ilə məcburi göstər. Lazımsız debugging kodu (inline style, !important) yazmadan əvvəl strukturu dəyiş.
- **Sadə həll pattern**: Nested scroll əvəzinə → parent container-i scroll et + header wrapper ilə ayır.
