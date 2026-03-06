// emojiConstants.js — Bütün emoji sabitlər bir yerdə (named export-lar)

// CUSTOM_EMOJI_URLS — bəzi emojilər üçün xüsusi SVG istifadə olunur (Apple CDN əvəzinə)
// Məsələn: 👍 → Facebook-style mavi dairə + ağ thumbs up
const CUSTOM_EMOJI_URLS = {
  "👍": "/emojis/like-blue.svg",
};

// emojiToUrl — unicode emoji-ni Apple CDN şəkil URL-ə çevirir
// Əvvəlcə CUSTOM_EMOJI_URLS yoxlanılır, yoxdursa Apple emoji CDN istifadə olunur
export function emojiToUrl(emoji) {
  if (CUSTOM_EMOJI_URLS[emoji]) return CUSTOM_EMOJI_URLS[emoji];
  const codePoints = [...emoji]
    .map((cp) => cp.codePointAt(0).toString(16))
    .join("-");
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${codePoints}.png`;
}

// Emoji regex — bütün emoji növlərini tapır:
// 1. Bayraq emojiləri: \p{Regional_Indicator}{2} — 🇦🇿, 🇺🇸 vs.
// 2. ZWJ ardıcıllıqları: 👨‍👩‍👧‍👦 (ailə), 👩‍💻 (qadın developer) vs.
// 3. Skin tone modifier: 👍🏽, 🤝🏿 vs.
// 4. Variation selector: ❤️ (FE0F ilə) vs.
// 5. Keycap: #️⃣, *️⃣, 0️⃣-9️⃣
// 6. Sadə emojilər: 😀, 🔥, ⭐ vs.
const EMOJI_REGEX = /\p{Regional_Indicator}{2}|(?:[\p{Emoji_Presentation}\p{Extended_Pictographic}](?:\p{Emoji_Modifier}|\uFE0F\u20E3?)?(?:\u200D[\p{Emoji_Presentation}\p{Extended_Pictographic}](?:\p{Emoji_Modifier}|\uFE0F)?)*)/gu;

// renderTextWithEmojis — mətn içindəki Unicode emojiləri Apple CDN şəkillərinə çevirir
// Qaytarır: string (emoji yoxdursa) və ya array (text + img elementləri)
export function renderTextWithEmojis(text) {
  if (!text) return text;
  const parts = [];
  let lastIndex = 0;
  let match;

  EMOJI_REGEX.lastIndex = 0;
  while ((match = EMOJI_REGEX.exec(text)) !== null) {
    // Emoji-dən əvvəlki text
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // Emoji-ni img elementinə çevir
    const emoji = match[0];
    parts.push({ emoji, url: emojiToUrl(emoji) });
    lastIndex = match.index + match[0].length;
  }

  // Qalan text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  // Emoji yoxdursa orijinal text-i qaytar
  if (parts.length === 0) return text;
  if (parts.length === 1 && typeof parts[0] === "string") return text;

  return parts;
}

// QUICK_REACTION_EMOJIS — mesaj üzərindəki sürətli reaksiya siyahısı (ilk sıra)
export const QUICK_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

// EXPANDED_EXTRA_EMOJIS — expand olduqda görünən əlavə emojilər
// Quick (6) + expanded (36) = 42 emoji, 6 sütun × 7 sıra, 5 sıra görünür + scroll
export const EXPANDED_EXTRA_EMOJIS = [
  "👎", "🙏", "👏", "💯", "🎉", "💪",
  "😡", "🤔", "👀", "😍", "😊", "🤣",
  "😎", "😘", "🥲", "😏", "🤭", "😇",
  "🤩", "🥳", "😤", "🤝", "😈", "🤯",
  "✅", "❌", "⭐", "💩", "🫡", "🫶",
  "🤓", "😌", "🥰", "😬", "🙄", "🥺",
];
