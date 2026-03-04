// emojiConstants.js — Bütün emoji sabitlər bir yerdə (named export-lar)

// CUSTOM_EMOJI_URLS — bəzi emojilər üçün xüsusi SVG istifadə olunur (Twemoji əvəzinə)
// Məsələn: 👍 → Facebook-style mavi dairə + ağ thumbs up
const CUSTOM_EMOJI_URLS = {
  "👍": "/emojis/like-blue.svg",
};

// emojiToUrl — unicode emoji-ni SVG URL-ə çevirir
// Əvvəlcə CUSTOM_EMOJI_URLS yoxlanılır, yoxdursa Twemoji CDN istifadə olunur
// .NET ekvivalenti: static utility method — hər yerdən çağrıla bilər
export function emojiToUrl(emoji) {
  if (CUSTOM_EMOJI_URLS[emoji]) return CUSTOM_EMOJI_URLS[emoji];
  const codePoints = [...emoji]
    .map((cp) => cp.codePointAt(0).toString(16))
    .filter((cp) => cp !== "fe0f") // variation selector-u sil — Twemoji fayllarında yoxdur
    .join("-");
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/${codePoints}.svg`;
}

// QUICK_REACTION_EMOJIS — mesaj üzərindəki sürətli reaksiya siyahısı
// MessageBubble-da default 5 emoji göstərilir
export const QUICK_REACTION_EMOJIS = ["👍", "😂", "❤️", "😟", "🔥"];

// EXPANDED_EXTRA_EMOJIS — expand olduqda quick sıranın altında görünən əlavə emojilər
// Quick sıra ilə eyni olmamalıdır (QUICK_REACTION_EMOJIS artıq göstərilir)
export const EXPANDED_EXTRA_EMOJIS = [
  "😮", "🤝", "💯", "😴", "❌",
  "✅", "🤓", "👀", "😊", "😏",
  "🤭", "😡", "👿", "😢", "😎",
  "😘", "🤢", "😍", "🤣", "💩",
  "💪", "👏", "🙏", "👎", "😀",
];

// TEXT_INPUT_EMOJIS — ChatInputArea-dakı emoji panel siyahısı
export const TEXT_INPUT_EMOJIS = [
  "😀", "😃", "😄", "😁", "😆", "😅",
  "🤣", "😂", "🙂", "🙃", "😉", "😊",
  "😇", "🥰", "😍", "🤩", "😘", "😗",
  "😚", "😙", "🥲", "😋", "😛", "😜",
  "🤪", "😝", "🤑", "🤗", "🤭", "🤫",
  "🤔", "🫡", "🤐", "🤨", "😐", "😑",
  "😶", "🫥", "😏", "😒", "🙄", "😬",
  "🤥", "😌", "😔", "😪", "🤤", "😴",
  "😷", "🤒", "🤕", "🤢", "🤮", "🥵",
  "❤️", "🔥", "👍", "👎", "👏", "🙏",
  "💪", "✅", "❌", "⭐", "💯", "🎉",
];
