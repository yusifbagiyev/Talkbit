// emojiConstants.js — Bütün emoji sabitlər bir yerdə (named export-lar)

// emojiToUrl — unicode emoji-ni Twemoji SVG URL-ə çevirir
// Twemoji: Twitter-in açıq mənbəli emoji şəkilləri — canlı, rəngli, cross-platform eyni görünür
// .NET ekvivalenti: static utility method — hər yerdən çağrıla bilər
// Nümunə: "👍" → "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg/1f44d.svg"
export function emojiToUrl(emoji) {
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
