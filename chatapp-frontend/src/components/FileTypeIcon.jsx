import { memo } from "react";
// ─── FileTypeIcon — Fayl tipinə görə rəngli SVG icon ────────────────────────
// Generik blank sənəd iconu əvəzinə fayl extension-ına görə fərqli rəng + glyph.
// PDF = qırmızı + mətn sətirləri, Excel = yaşıl + cədvəl, Video = bənövşəyi + play və s.
//
// İstifadəsi:
//   <FileTypeIcon fileName="report.pdf" size={32} />
//   <FileTypeIcon fileName="data.xlsx" size={24} />

// ─── Extension → kateqoriya + rəng mapping ──────────────────────────────────
const FILE_TYPE_MAP = {
  // Documents — mətn sətirləri glyph-i
  pdf:  { category: "doc",     bg: "#e53e3e", fold: "#c53030" },
  doc:  { category: "doc",     bg: "#2b6cb0", fold: "#2c5282" },
  docx: { category: "doc",     bg: "#2b6cb0", fold: "#2c5282" },
  txt:  { category: "doc",     bg: "#718096", fold: "#4a5568" },
  // Spreadsheets — cədvəl/grid glyph-i
  xls:  { category: "sheet",   bg: "#25855a", fold: "#276749" },
  xlsx: { category: "sheet",   bg: "#25855a", fold: "#276749" },
  csv:  { category: "sheet",   bg: "#38a169", fold: "#2f855a" },
  // Presentations — diaqram glyph-i
  ppt:  { category: "ppt",     bg: "#c05621", fold: "#9c4221" },
  pptx: { category: "ppt",     bg: "#c05621", fold: "#9c4221" },
  // Audio — dalğa forması glyph-i
  mp3:  { category: "audio",   bg: "#d53f8c", fold: "#b83280" },
  wav:  { category: "audio",   bg: "#d53f8c", fold: "#b83280" },
  ogg:  { category: "audio",   bg: "#d53f8c", fold: "#b83280" },
  weba: { category: "audio",   bg: "#d53f8c", fold: "#b83280" },
  // Video — play üçbucağı glyph-i
  mp4:  { category: "video",   bg: "#805ad5", fold: "#6b46c1" },
  mpeg: { category: "video",   bg: "#805ad5", fold: "#6b46c1" },
  mov:  { category: "video",   bg: "#805ad5", fold: "#6b46c1" },
  avi:  { category: "video",   bg: "#805ad5", fold: "#6b46c1" },
  webm: { category: "video",   bg: "#805ad5", fold: "#6b46c1" },
  // Archives — yükləmə oxu glyph-i
  zip:  { category: "archive", bg: "#6b46c1", fold: "#553c9a" },
  rar:  { category: "archive", bg: "#6b46c1", fold: "#553c9a" },
  "7z": { category: "archive", bg: "#6b46c1", fold: "#553c9a" },
  tar:  { category: "archive", bg: "#6b46c1", fold: "#553c9a" },
  gz:   { category: "archive", bg: "#6b46c1", fold: "#553c9a" },
};

const DEFAULT_TYPE = { category: "doc", bg: "#a0aec0", fold: "#718096" };

// fileName-dən extension çıxarıb uyğun tip bilgisini qaytar
function getFileTypeInfo(fileName) {
  if (!fileName) return DEFAULT_TYPE;
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx === -1) return DEFAULT_TYPE;
  const ext = fileName.slice(dotIdx + 1).toLowerCase();
  return FILE_TYPE_MAP[ext] || DEFAULT_TYPE;
}

// ─── Kateqoriyaya görə ağ glyph ─────────────────────────────────────────────
// Sənəd üzərindəki fərqləndirici simvol — hər tip üçün fərqli
function Glyph({ category }) {
  switch (category) {
    case "doc":
      // Mətn sətirləri — PDF, Word, TXT
      return (
        <g stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9">
          <line x1="8" y1="17" x2="24" y2="17" />
          <line x1="8" y1="22" x2="24" y2="22" />
          <line x1="8" y1="27" x2="18" y2="27" />
        </g>
      );
    case "sheet":
      // Cədvəl / grid — Excel, CSV
      return (
        <g stroke="white" strokeWidth="1.5" fill="none" opacity="0.9">
          <rect x="7" y="15" width="18" height="14" rx="1.5" />
          <line x1="16" y1="15" x2="16" y2="29" />
          <line x1="7" y1="22" x2="25" y2="22" />
        </g>
      );
    case "ppt":
      // Diaqram çubuqları — PowerPoint
      return (
        <g fill="white" opacity="0.9">
          <rect x="8" y="23" width="4.5" height="6" rx="1" />
          <rect x="13.75" y="17" width="4.5" height="12" rx="1" />
          <rect x="19.5" y="20" width="4.5" height="9" rx="1" />
        </g>
      );
    case "audio":
      // Dalğa forması / equalizer — MP3, WAV, OGG
      return (
        <g stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity="0.9">
          <line x1="10" y1="20" x2="10" y2="26" />
          <line x1="14" y1="16" x2="14" y2="30" />
          <line x1="18" y1="18" x2="18" y2="28" />
          <line x1="22" y1="20" x2="22" y2="26" />
        </g>
      );
    case "video":
      // Play üçbucağı — MP4, AVI, MOV
      return <polygon points="12,16 12,30 24,23" fill="white" opacity="0.9" />;
    case "archive":
      // Yükləmə oxu + xətt — ZIP, RAR, 7Z
      return (
        <g stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.9">
          <line x1="16" y1="15" x2="16" y2="25" />
          <polyline points="12,22 16,27 20,22" />
          <line x1="10" y1="30" x2="22" y2="30" />
        </g>
      );
    default:
      // Generik — solğun mətn sətirləri
      return (
        <g stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6">
          <line x1="8" y1="17" x2="24" y2="17" />
          <line x1="8" y1="22" x2="24" y2="22" />
          <line x1="8" y1="27" x2="18" y2="27" />
        </g>
      );
  }
}

// ─── Ana komponent ───────────────────────────────────────────────────────────
// viewBox: 32x38 — bütün ölçülərdə proporsional render olunur
// size prop: SVG width (height avtomatik 32:38 nisbətinə görə hesablanır)
function FileTypeIcon({ fileName, size = 24 }) {
  const info = getFileTypeInfo(fileName);
  const height = Math.round(size * 1.1875); // 32:38 nisbəti

  return (
    <svg width={size} height={height} viewBox="0 0 32 38" fill="none">
      {/* Sənəd gövdəsi — tip rəngi ilə dolu */}
      <path
        d="M2 4a4 4 0 0 1 4-4h13l11 11v23a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V4z"
        fill={info.bg}
      />
      {/* Qatlama küncü — daha tünd ton */}
      <path
        d="M19 0l11 11h-7a4 4 0 0 1-4-4V0z"
        fill={info.fold}
      />
      {/* Ağ glyph — tipi fərqləndirən simvol */}
      <Glyph category={info.category} />
    </svg>
  );
}

export default memo(FileTypeIcon);
