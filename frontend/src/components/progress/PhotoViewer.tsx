import { useEffect, useRef, useState } from "react";
import { ExpandIcon, LoaderCircleIcon, Trash2Icon, XIcon } from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import type { ProgressPhoto } from "../../types/nutrition";

export function PhotoViewer({
  photo,
  week,
  title,
  confirmDelete = false,
  onClose,
}: {
  photo: ProgressPhoto;
  week: string;
  title: string;
  confirmDelete?: boolean;
  onClose: () => void;
}) {
  const { t, removePhoto } = useApp();
  const dialog = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(confirmDelete);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  useEffect(() => {
    const element = dialog.current!;
    const previous = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previous;
    };
  }, []);
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await removePhoto(week, photo.id);
      onClose();
    } catch (cause) {
      setError((cause as Error).message);
      setDeleting(false);
    }
  };
  return (
    <dialog
      ref={dialog}
      aria-labelledby="photo-viewer-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!deleting) onClose();
      }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-slate-950 p-0 text-white backdrop:bg-black/80"
    >
      <div className="flex h-full flex-col px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <header className="flex shrink-0 items-center justify-between gap-3 pb-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <ExpandIcon className="h-4 w-4" aria-hidden />
              {t("photoFullscreen")}
            </p>
            <h2
              id="photo-viewer-title"
              className="mt-1 break-words text-sm font-semibold"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            autoFocus
            disabled={deleting}
            onClick={onClose}
            aria-label={t("close")}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
          >
            <XIcon aria-hidden />
          </button>
        </header>
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {imageState === "loading" && (
            <p
              role="status"
              className="absolute flex items-center gap-2 text-sm text-slate-300"
            >
              <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden />
              {t("photoLoading")}
            </p>
          )}
          {imageState === "error" && (
            <p role="alert" className="text-sm text-rose-300">
              {t("photoLoadError")}
            </p>
          )}
          <img
            src={photo.url}
            alt={title}
            onLoad={() => setImageState("ready")}
            onError={() => setImageState("error")}
            className={`h-full w-full object-contain ${imageState === "error" ? "hidden" : ""}`}
          />
        </div>
        <footer className="shrink-0 pt-4">
          {photo.note && (
            <p className="mb-3 max-h-20 overflow-auto text-sm text-slate-300">
              {photo.note}
            </p>
          )}
          {confirming ? (
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm font-semibold">{t("photoDeleteConfirm")}</p>
              <p className="mt-1 text-xs text-slate-300">
                {t("photoDeleteHint")}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void remove()}
                  className="flex min-h-12 items-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-semibold disabled:opacity-60"
                >
                  {deleting ? (
                    <LoaderCircleIcon
                      className="h-4 w-4 animate-spin"
                      aria-hidden
                    />
                  ) : (
                    <Trash2Icon className="h-4 w-4" aria-hidden />
                  )}
                  {deleting ? t("photoDeleting") : t("photoDelete")}
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => {
                    setConfirming(false);
                    setError("");
                  }}
                  className="min-h-12 rounded-xl bg-white/10 px-4 text-sm font-semibold"
                >
                  {t("cancel")}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="mx-auto flex min-h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-semibold"
            >
              <Trash2Icon className="h-4 w-4" aria-hidden />
              {t("photoDelete")}
            </button>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-rose-300">
              {error}
            </p>
          )}
        </footer>
      </div>
    </dialog>
  );
}
