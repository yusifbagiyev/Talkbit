import { memo } from "react";
// ─── FileTypeIcon — Müasir flat fayl tip ikonu ──────────────────────────────
// Extension label + rəngli badge stili. Hər extension özəl rəng alır.
//
// İstifadəsi:
//   <FileTypeIcon fileName="report.pdf" size={32} />
//   <FileTypeIcon fileName="data.xlsx" size={24} />

// ─── Extension → rəng + label mapping ────────────────────────────────────────
const FILE_TYPE_MAP = {
  // PDF
  pdf:  { label: "PDF",  color: "#E53E3E", bg: "#FFF5F5" },
  // Word
  doc:  { label: "DOC",  color: "#2B6CB0", bg: "#EBF8FF" },
  docx: { label: "DOC",  color: "#2B6CB0", bg: "#EBF8FF" },
  // Text
  txt:  { label: "TXT",  color: "#718096", bg: "#F7FAFC" },
  rtf:  { label: "RTF",  color: "#718096", bg: "#F7FAFC" },
  // Excel
  xls:  { label: "XLS",  color: "#25855A", bg: "#F0FFF4" },
  xlsx: { label: "XLS",  color: "#25855A", bg: "#F0FFF4" },
  csv:  { label: "CSV",  color: "#38A169", bg: "#F0FFF4" },
  // PowerPoint
  ppt:  { label: "PPT",  color: "#C05621", bg: "#FFFAF0" },
  pptx: { label: "PPT",  color: "#C05621", bg: "#FFFAF0" },
  // Şəkil
  png:  { label: "PNG",  color: "#0BC5EA", bg: "#E6FFFA" },
  jpg:  { label: "JPG",  color: "#0BC5EA", bg: "#E6FFFA" },
  jpeg: { label: "JPG",  color: "#0BC5EA", bg: "#E6FFFA" },
  gif:  { label: "GIF",  color: "#0BC5EA", bg: "#E6FFFA" },
  svg:  { label: "SVG",  color: "#ED8936", bg: "#FFFAF0" },
  webp: { label: "WEBP", color: "#0BC5EA", bg: "#E6FFFA" },
  // Audio
  mp3:  { label: "MP3",  color: "#D53F8C", bg: "#FFF5F7" },
  wav:  { label: "WAV",  color: "#D53F8C", bg: "#FFF5F7" },
  ogg:  { label: "OGG",  color: "#D53F8C", bg: "#FFF5F7" },
  weba: { label: "WEBA", color: "#D53F8C", bg: "#FFF5F7" },
  flac: { label: "FLAC", color: "#D53F8C", bg: "#FFF5F7" },
  // Video
  mp4:  { label: "MP4",  color: "#805AD5", bg: "#FAF5FF" },
  mpeg: { label: "MPEG", color: "#805AD5", bg: "#FAF5FF" },
  mov:  { label: "MOV",  color: "#805AD5", bg: "#FAF5FF" },
  avi:  { label: "AVI",  color: "#805AD5", bg: "#FAF5FF" },
  webm: { label: "WEBM", color: "#805AD5", bg: "#FAF5FF" },
  mkv:  { label: "MKV",  color: "#805AD5", bg: "#FAF5FF" },
  // Arxiv
  zip:  { label: "ZIP",  color: "#D69E2E", bg: "#FFFFF0" },
  rar:  { label: "RAR",  color: "#D69E2E", bg: "#FFFFF0" },
  "7z": { label: "7Z",   color: "#D69E2E", bg: "#FFFFF0" },
  tar:  { label: "TAR",  color: "#D69E2E", bg: "#FFFFF0" },
  gz:   { label: "GZ",   color: "#D69E2E", bg: "#FFFFF0" },
  // Kod
  js:   { label: "JS",   color: "#ECC94B", bg: "#FFFFF0" },
  ts:   { label: "TS",   color: "#3182CE", bg: "#EBF8FF" },
  html: { label: "HTML", color: "#E53E3E", bg: "#FFF5F5" },
  css:  { label: "CSS",  color: "#3182CE", bg: "#EBF8FF" },
  json: { label: "JSON", color: "#718096", bg: "#F7FAFC" },
  xml:  { label: "XML",  color: "#718096", bg: "#F7FAFC" },
};

const DEFAULT_TYPE = { label: "FILE", color: "#A0AEC0", bg: "#F7FAFC" };

// fileName-dən extension çıxar
function getFileTypeInfo(fileName) {
  if (!fileName) return DEFAULT_TYPE;
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx === -1) return DEFAULT_TYPE;
  const ext = fileName.slice(dotIdx + 1).toLowerCase();
  return FILE_TYPE_MAP[ext] || DEFAULT_TYPE;
}

// ─── Ana komponent — müasir flat icon ────────────────────────────────────────
function FileTypeIcon({ fileName, size = 24 }) {
  const info = getFileTypeInfo(fileName);
  const h = Math.round(size * 1.1875);
  // Label font ölçüsü — size-a proporsional
  const fontSize = Math.max(6, Math.round(size * 0.3));
  const labelY = h * 0.62;

  return (
    <svg width={size} height={h} viewBox={`0 0 ${size} ${h}`} fill="none">
      {/* Arxa fon — yuvarlaq düzbucaq */}
      <rect width={size} height={h} rx={size * 0.15} fill={info.bg} />
      {/* Sol kənar — rəng aksentı */}
      <rect width={size * 0.09} height={h} rx={size * 0.045} fill={info.color} />
      {/* Extension label — mərkəzdə */}
      <text
        x={size * 0.55}
        y={labelY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={info.color}
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {info.label}
      </text>
    </svg>
  );
}

export default memo(FileTypeIcon);
