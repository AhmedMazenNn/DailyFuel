import { useEffect, useState } from "react";
import { useApp } from "../contexts/AppContext";
import { PageHeader } from "../components/ui/PageHeader";
import { PhotoGallery } from "../components/progress/PhotoGallery";
import { PhotoUploader } from "../components/progress/PhotoUploader";
import { PrivacyNote } from "../components/progress/PrivacyNote";
import { WeightCard } from "../components/progress/WeightCard";
import { WeightChart } from "../components/progress/WeightChart";

export function Progress() {
  const { t, loadWeeks, loadWeek, selectedWeek, weeksNext } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [moreLoading, setMoreLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.all([loadWeeks(), loadWeek(selectedWeek)])
      .catch((cause) => {
        if (active) setError((cause as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadWeeks, loadWeek, selectedWeek]);
  const loadMore = async () => {
    if (!weeksNext || moreLoading) return;
    setMoreLoading(true);
    setError("");
    try {
      await loadWeeks(weeksNext);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setMoreLoading(false);
    }
  };
  return (
    <>
      <PageHeader title={t("progressTitle")} intro={t("progressIntro")} />
      <div className="mb-5">
        <PrivacyNote />
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-xl bg-white p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2" role="status">
          <span className="sr-only">{t("loading")}</span>
          <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-line" />
          <div className="h-72 animate-pulse rounded-3xl bg-white/70 ring-1 ring-line" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 lg:items-start lg:gap-6">
          <div className="space-y-4">
            <WeightCard />
            <WeightChart />
          </div>
          <div className="space-y-4">
            <PhotoUploader />
          </div>
          <div className="min-w-0 lg:col-span-2">
            <PhotoGallery />
            {weeksNext && (
              <button
                type="button"
                disabled={moreLoading}
                onClick={() => void loadMore()}
                className="min-h-12 w-full rounded-2xl bg-white px-4 text-sm font-semibold text-brand-700 ring-1 ring-line disabled:opacity-60"
              >
                {moreLoading ? t("loading") : t("photoOlderWeeks")}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
