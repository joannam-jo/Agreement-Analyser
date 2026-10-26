export type DetectedFileType = "pdf" | "png" | "jpeg" | "webp" | "tiff" | "text" | "docx" | "doc";

const ZIP_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const OLE_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

/**
 * Identify an upload from its magic bytes. The browser-supplied MIME type and file name are
 * attacker-controlled, so they are never trusted on their own.
 */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  if (buffer.length < 4) return null;

  // PDFs may have a few junk bytes before the header; the spec allows it within the first 1 KB.
  if (buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) return "pdf";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "webp";
  }
  const tiffLE = buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00;
  const tiffBE = buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a;
  if (tiffLE || tiffBE) return "tiff";
  // .docx is a ZIP archive; file names are stored uncompressed, so the Word part is visible in the bytes.
  // Any other ZIP (or a renamed archive) is rejected.
  if (buffer.subarray(0, 4).equals(ZIP_SIGNATURE)) {
    return buffer.includes(Buffer.from("word/document.xml")) ? "docx" : null;
  }
  // Legacy .doc (and other Office 97-2003 files) use the OLE compound file format.
  if (buffer.subarray(0, 8).equals(OLE_SIGNATURE)) return "doc";
  if (isPlainText(buffer)) return "text";
  return null;
}

function isPlainText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, 64 * 1024);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(sample.length === buffer.length ? sample : trimPartialUtf8(sample));
    return true;
  } catch {
    return false;
  }
}

/** Avoid rejecting valid UTF-8 whose last multi-byte character was cut by the sample window. */
function trimPartialUtf8(sample: Buffer): Buffer {
  let end = sample.length;
  for (let i = 1; i <= 3 && end - i >= 0; i++) {
    const byte = sample[end - i];
    if ((byte & 0xc0) === 0xc0) return sample.subarray(0, end - i);
    if ((byte & 0x80) === 0) break;
  }
  return sample;
}
