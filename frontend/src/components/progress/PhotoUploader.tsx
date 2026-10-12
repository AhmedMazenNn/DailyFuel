import { useState } from "react";
import { CameraIcon, ImagePlusIcon, LoaderCircleIcon } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { card } from "../../utils/styles";

export function PhotoUploader() {
  const { selectedWeek, weekly, addPhoto, t } = useApp();
  const { session } = useAuth();
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const photos = weekly[selectedWeek]?.photos ?? [];
  const full = photos.length >= 2;
  const upload = async (file: File) => {
    setError("");
    if (uploading || full) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setError(t("errPhotoType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("errPhotoSize"));
      return;
    }
    setUploading(true);
    try {
      await addPhoto(selectedWeek, file, {
        label: "",
        note: "",
        capturedOn: selectedWeek,
      });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setUploading(false);
    }
  };
  return (
    <section className={`${card} p-5`}>
      <div className="flex items-center gap-3">
        <CameraIcon className="h-5 w-5 text-brand-600" aria-hidden />
        <h2 className="font-display text-lg font-bold">{t("weeklyPhotos")}</h2>
      </div>
      <p className="mt-2 text-sm text-ink-soft" aria-live="polite">
        {session?.user?.isAdmin ? `${photos.length}/2 · ${t("photosOptional")}` : t("photosComingSoon")}
      </p>
      {!session?.user?.isAdmin ? (
        <p className="mt-2 text-sm text-ink-soft">{t("photosComingSoonHint")}</p>
      ) : full && (
        <p className="mt-2 text-sm text-ink-soft">
          {t("photosFull")} {t("photoFullHint")}
        </p>
      )}
      {session?.user?.isAdmin && <label
        className={`mt-4 flex items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-6 text-brand-700 focus-within:ring-2 focus-within:ring-brand-400 ${full || uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        {uploading ? (
          <LoaderCircleIcon className="animate-spin" aria-hidden />
        ) : (
          <ImagePlusIcon aria-hidden />
        )}
        <span role={uploading ? "status" : undefined}>
          {uploading ? t("photoUploadBusy") : t("addPhotos")}
        </span>
        <input
          aria-label={t("addPhotos")}
          disabled={full || uploading}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) void upload(file);
          }}
        />
      </label>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
