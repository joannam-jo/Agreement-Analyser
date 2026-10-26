"use client";

import { useCallback, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { Upload, FileText, FileType2, Image as ImageIcon, AlignLeft, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

const FORMATS = [
  { label: { en: "PDF", hi: "PDF" }, ext: "digital or scanned", Icon: FileText },
  { label: { en: "Word", hi: "वर्ड" }, ext: ".docx / .doc", Icon: FileType2 },
  { label: { en: "Photo / scan", hi: "फोटो / स्कैन" }, ext: "JPG, PNG, WEBP, TIFF", Icon: ImageIcon },
  { label: { en: "Text", hi: "टेक्स्ट" }, ext: ".txt", Icon: AlignLeft },
];

const TEXT = {
  en: {
    title: "Upload financial agreement",
    drop: "Drop your agreement here",
    hint: "Drag a file here or click to choose. Up to 20 MB. Files are encrypted and only visible to you.",
  },
  hi: {
    title: "वित्तीय समझौता अपलोड करें",
    drop: "अपना समझौता यहाँ छोड़ें",
    hint: "फ़ाइल यहाँ खींचें या चुनने के लिए क्लिक करें। अधिकतम 20 MB। फ़ाइलें एन्क्रिप्ट रहती हैं और केवल आपको दिखती हैं।",
  },
};
import { toast } from "sonner";
import type { DocumentLanguage, ExplanationLanguage } from "@faa/shared";
import { uploadAgreement } from "@/lib/api";
import { cn } from "@/lib/utils";

const MAX_BYTES = 20 * 1024 * 1024;

export function FileDropzone({
  onComplete,
  documentLanguage,
  explanationLanguage,
}: {
  onComplete: (agreementId: string) => void;
  documentLanguage: DocumentLanguage;
  explanationLanguage: ExplanationLanguage;
}) {
  const [loading, setLoading] = useState(false);
  const { lang } = useLanguage();
  const tx = TEXT[lang];

  const onDrop = useCallback(
    async (files: File[], rejected: FileRejection[]) => {
      if (rejected.length) {
        const reason = rejected[0]?.errors[0]?.message || "Unsupported file type";
        toast.error(reason);
        return;
      }
      const file = files[0];
      if (!file) return;
      setLoading(true);
      try {
        const result = await uploadAgreement(file, { documentLanguage, explanationLanguage });
        toast.success("Uploaded - analysis started");
        onComplete(result.agreementId);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [onComplete, documentLanguage, explanationLanguage]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "image/tiff": [".tif", ".tiff"],
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/msword": [".doc"],
    },
    multiple: false,
    maxSize: MAX_BYTES,
    maxFiles: 1,
    disabled: loading,
  });
  return (
    <div
      {...getRootProps()}
      className={cn(
        "cursor-pointer rounded-3xl border-2 border-dashed bg-pastel-sky/40 p-12 text-center transition hover:bg-pastel-sky/70",
        isDragActive ? "border-pop-sky bg-pastel-sky" : "border-pop-sky/30",
        loading && "pointer-events-none opacity-70"
      )}
    >
      <input {...getInputProps()} />
      {loading ? (
        <Loader2 className="mx-auto h-12 w-12 animate-spin text-brand-insight" />
      ) : (
        <Upload className="mx-auto h-12 w-12 text-brand-insight" />
      )}
      <h3 className="mt-4 text-lg font-semibold text-ink">{isDragActive ? tx.drop : tx.title}</h3>
      <p className="mt-2 text-sm text-brand-cool">{tx.hint}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs">
        {FORMATS.map(({ label, ext, Icon }) => (
          <span key={ext} className="flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 text-ink/80">
            <Icon className="h-3.5 w-3.5 text-brand-insight" />
            {label[lang]} <span className="text-brand-cool">{ext}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
