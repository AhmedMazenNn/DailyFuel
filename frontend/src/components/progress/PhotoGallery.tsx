import { useEffect, useMemo, useState } from "react";
import {
  Columns2Icon,
  ImageIcon,
  LayoutGridIcon,
  LockIcon,
  Trash2Icon,
  ExpandIcon,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import { formatDate } from "../../utils/date";
import { card } from "../../utils/styles";
import { SegmentedControl } from "../ui/SegmentedControl";

import { PhotoViewer } from "./PhotoViewer";
import type { ProgressPhoto } from "../../types/nutrition";

type View = "gallery" | "compare";

export function PhotoGallery() {
  const { weekly, t, fmt, lang, fmtWeight, weeksNext, loadWeeks } = useApp();
  const [selected, setSelected] = useState<{
    photo: ProgressPhoto;
    week: string;
    title: string;
    confirmDelete?: boolean;
  } | null>(null);
  const [view, setView] = useState<View>("gallery");
  const weeks = useMemo(
    () =>
      Object.values(weekly)
        .filter((w) => w.photos.length > 0)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    [weekly],
  );
  const [aPhoto, setAPhoto] = useState<string | null>(null);
  const [bPhoto, setBPhoto] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const photos = weeks.flatMap((week) =>
    week.photos.map((photo, index) => ({ photo, week: week.weekStart, index })),
  );
  const a =
    photos.find((entry) => entry.photo.id === aPhoto) ??
    photos.find((entry) => entry.week === weeks[weeks.length - 1]?.weekStart);
  const b =
    photos.find((entry) => entry.photo.id === bPhoto) ??
    photos.find((entry) => entry.photo.id !== a?.photo.id) ??
    photos[0];
  useEffect(() => {
    if (view !== "compare" || !weeksNext || historyError) {
      setHistoryLoading(false);
      return;
    }
    let active = true;
    setHistoryLoading(true);
    void loadWeeks(weeksNext)
      .catch((cause) => {
        if (active) setHistoryError((cause as Error).message);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [view, weeksNext, loadWeeks, historyError]);
  const weekLabel = (iso: string) =>
    t("weekOf", {
      date: formatDate(iso, lang, {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    });

  const weightLabel = (week: string) => {
    const weight = weekly[week]?.weightKg;
    return weight == null ? t("noEntry") : fmtWeight(weight);
  };
  const photoTitle = (photo: ProgressPhoto, week: string, index: number) =>
    `${photo.label || t("photoN", { n: fmt(index + 1) })} · ${weekLabel(week)} · ${weightLabel(week)}`;
  const tile = (
    photo: ProgressPhoto,
    week: string,
    index: number,
    fullSize = false,
  ) => {
    const title = photoTitle(photo, week, index);
    return (
      <div className="relative h-full w-full">
        <button
          type="button"
          onClick={() => setSelected({ photo, week, title })}
          aria-label={t("photoOpen", { name: title })}
          className="group relative h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-brand-400"
        >
          <img
            src={fullSize ? photo.url : photo.thumbnailUrl || photo.url}
            alt={title}
            className={`h-full w-full ${fullSize ? "object-contain" : "object-cover"}`}
            loading="lazy"
          />
          <span className="absolute bottom-2 start-2 rounded-full bg-black/60 p-2 text-white">
            <ExpandIcon className="h-4 w-4" aria-hidden />
          </span>
        </button>
        <button
          type="button"
          onClick={() =>
            setSelected({ photo, week, title, confirmDelete: true })
          }
          aria-label={t("removePhoto", { n: fmt(index + 1) })}
          className="absolute end-1 top-1 grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          <Trash2Icon className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  };

  const picker = (
    side: "a" | "b",
    chosen: typeof a,
    setPhoto: (id: string) => void,
  ) => (
    <section
      aria-label={t(side === "a" ? "compareFirst" : "compareSecond")}
      className="min-w-0 rounded-2xl bg-canvas p-3 ring-1 ring-line"
    >
      <h3 className="font-semibold text-ink">
        {t(side === "a" ? "compareFirst" : "compareSecond")}
      </h3>
      <p className="mt-1 text-xs text-ink-soft">{t("comparePickHint")}</p>
      <div className="mt-3 max-h-80 space-y-4 overflow-y-auto p-1">
        {weeks.map((week) => (
          <div key={week.weekStart}>
            <h4 className="mb-2 text-xs font-semibold text-ink-soft">
              {weekLabel(week.weekStart)} · {weightLabel(week.weekStart)}
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {week.photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  aria-label={photoTitle(photo, week.weekStart, index)}
                  aria-pressed={chosen?.photo.id === photo.id}
                  onClick={() => setPhoto(photo.id)}
                  className={`min-w-0 overflow-hidden rounded-xl bg-white text-start ring-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${chosen?.photo.id === photo.id ? "ring-brand-500" : "ring-transparent hover:ring-brand-200"}`}
                >
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt=""
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover"
                  />
                  <span className="block break-words px-2 py-1.5 text-[11px] font-semibold text-ink">
                    {photo.label || t("photoN", { n: fmt(index + 1) })}
                  </span>
                  {chosen?.photo.id === photo.id && (
                    <span className="block bg-brand-50 px-2 py-1 text-[10px] font-bold text-brand-700">
                      {t("compareSelected")}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <section aria-labelledby="gallery-heading" className={`${card} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="gallery-heading"
          className="flex items-center gap-2 font-display text-lg font-bold text-ink"
        >
          {t("gallery")}
          <LockIcon
            className="h-4 w-4 text-ink-faint"
            aria-label={t("privacyTitle")}
          />
        </h2>
        {weeks.length > 0 && (
          <div className="w-full sm:w-64">
            <SegmentedControl
              label={t("gallery")}
              value={view}
              onChange={setView}
              options={[
                {
                  value: "gallery",
                  label: t("galleryView"),
                  icon: <LayoutGridIcon className="h-4 w-4" aria-hidden />,
                },
                {
                  value: "compare",
                  label: t("compareView"),
                  icon: <Columns2Icon className="h-4 w-4" aria-hidden />,
                },
              ]}
            />
          </div>
        )}
      </div>

      {weeks.length === 0 ? (
        <div className="mt-4 flex flex-col items-center rounded-2xl bg-canvas px-6 py-10 text-center">
          <ImageIcon className="h-6 w-6 text-brand-500" aria-hidden />
          <p className="mt-2 max-w-sm text-sm text-ink-soft">{t("noPhotos")}</p>
        </div>
      ) : view === "gallery" ? (
        <ul className="mt-4 space-y-5">
          {weeks.map((w) => (
            <li key={w.weekStart}>
              <h3 className="text-sm font-semibold text-ink-soft">
                {weekLabel(w.weekStart)} · {weightLabel(w.weekStart)}
              </h3>
              <ul className="mt-2 grid grid-cols-4 gap-2">
                {w.photos.map((p, i) => (
                  <li key={p.id} className="min-w-0">
                    <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-canvas ring-1 ring-line">
                      {tile(p, w.weekStart, i)}
                    </div>
                    <p className="mt-2 break-words text-xs font-semibold text-ink">
                      {p.label || t("photoN", { n: fmt(i + 1) })} ·{" "}
                      {weightLabel(w.weekStart)}
                    </p>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-ink-soft">{t("compareAnyPhotos")}</p>
          <div
            className="grid grid-cols-2 gap-3"
            role="group"
            aria-label={t("comparePair")}
          >
            {[a, b].map(
              (entry, index) =>
                entry && (
                  <figure key={index} className="min-w-0">
                    <p className="mb-2 text-xs font-bold text-brand-700">
                      {t(index === 0 ? "compareFirst" : "compareSecond")}
                    </p>
                    <div className="h-64 overflow-hidden rounded-2xl bg-canvas ring-1 ring-line sm:h-96">
                      {tile(entry.photo, entry.week, entry.index, true)}
                    </div>
                    <figcaption className="mt-2 break-words text-xs font-semibold text-ink sm:text-sm">
                      {photoTitle(entry.photo, entry.week, entry.index)}
                    </figcaption>
                  </figure>
                ),
            )}
          </div>
          {historyLoading && (
            <p role="status" className="text-sm text-ink-soft">
              {t("compareLoadingWeeks")}
            </p>
          )}
          {historyError && (
            <div role="alert" className="text-sm text-red-700">
              {historyError}
              <button
                type="button"
                onClick={() => setHistoryError("")}
                className="ms-2 min-h-11 font-semibold text-brand-700"
              >
                {t("compareRetry")}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {picker("a", a, setAPhoto)}
            {picker("b", b, setBPhoto)}
          </div>
        </div>
      )}
      {selected && (
        <PhotoViewer
          key={selected.photo.id}
          {...selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
