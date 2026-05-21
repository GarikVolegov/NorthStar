import { deleteJson, patchJson } from "@/lib/apiClient";
import { Camera, ImageUp, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

interface BannerUploadResponse {
  bannerUrl: string | null;
}

export function BannerUpload({ userId, currentUrl, onUploaded }: {
  userId: number;
  currentUrl?: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1_500_000) { setError("Max 1.5 MB"); return; }
    if (!file.type.startsWith("image/")) { setError("Solo immagini"); return; }

    setError(null);
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const json = await patchJson<BannerUploadResponse>(`${BASE}api/profile/${userId}/banner`, {
        bannerDataUrl: dataUrl,
      });
      onUploaded(json.bannerUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setUploading(true);
    try {
      await deleteJson(`${BASE}api/profile/${userId}/banner`);
      onUploaded(null);
    } catch {
      setError("Errore rimozione");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ImageUp className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Banner profilo</span>
      </div>

      {currentUrl && (
        <div className="relative rounded-xl overflow-hidden border border-border h-24 bg-muted">
          <img
            src={currentUrl}
            alt="Banner"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
          {currentUrl ? "Cambia banner" : "Aggiungi banner"}
        </button>

        {currentUrl && (
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive hover:text-destructive/80 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Rimuovi
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      </div>

      <p className="text-[10px] text-muted-foreground">Formato: JPEG, PNG, WebP o GIF. Max 1.5 MB.</p>
    </div>
  );
}
