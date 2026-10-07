import { useEffect, useRef, useState } from "react";
import { PlusIcon, SearchIcon, PencilIcon, CheckIcon } from "lucide-react";
import { json, request } from "../utils/api";
import { useApp } from "../contexts/AppContext";
import type { SavedFood } from "../types/nutrition";

const blank = {
  name: "",
  brand: "",
  serving_amount_g: "40",
  calories_per_serving: "",
  protein_g_per_serving: "",
  fat_g_per_serving: "",
  carbs_g_per_serving: "",
  notes: "",
};
export function SavedFoods() {
  const { t, fmt } = useApp();
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [editingName, setEditingName] = useState("");
  const [saving, setSaving] = useState(false);
  const [foods, setFoods] = useState<SavedFood[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<typeof blank>(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const load = async () =>
    setFoods(
      await request<SavedFood[]>(
        `saved-foods/?search=${encodeURIComponent(search)}`,
      ),
    );
  useEffect(() => {
    void load().catch((e) => setError((e as Error).message));
  }, [search]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const body = {
        ...form,
        serving_amount_g: Number(form.serving_amount_g),
        calories_per_serving: Number(form.calories_per_serving),
        protein_g_per_serving: Number(form.protein_g_per_serving),
        fat_g_per_serving: Number(form.fat_g_per_serving),
        carbs_g_per_serving: form.carbs_g_per_serving
          ? Number(form.carbs_g_per_serving)
          : null,
      };
      if (editing) await json(`saved-foods/${editing}/`, "PATCH", body);
      else await json("saved-foods/", "POST", body);
      setForm(blank);
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const edit = (food: SavedFood) => {
    setEditing(food.id);
    setEditingName(food.name);
    setError("");
    formRef.current?.scrollIntoView({
      behavior:
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        document.documentElement.dataset.reduceMotion === "true"
          ? "instant"
          : "smooth",
      block: "start",
    });
    requestAnimationFrame(() =>
      nameRef.current?.focus({ preventScroll: true }),
    );
    setForm({
      name: food.name,
      brand: food.brand,
      serving_amount_g: String(food.serving_amount_g),
      calories_per_serving: String(food.calories_per_serving),
      protein_g_per_serving: String(food.protein_g_per_serving),
      fat_g_per_serving: String(food.fat_g_per_serving),
      carbs_g_per_serving:
        food.carbs_g_per_serving == null
          ? ""
          : String(food.carbs_g_per_serving),
      notes: food.notes,
    });
  };
  const archive = async (id: string) => {
    const food = foods.find((f) => f.id === id);
    if (!food || !window.confirm(t("savedFoodConfirm", { name: food.name })))
      return;
    setError("");
    try {
      await json(`saved-foods/${id}/`, "DELETE");
      if (editing === id) {
        setEditing(null);
        setForm(blank);
      }
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">
          DailyFuel
        </p>
        <h1 className="font-display text-3xl font-extrabold text-ink">
          {t("nav.foods")}
        </h1>
        <p className="mt-1 text-ink-soft">
          Enter nutrition for the serving amount you define.
        </p>
      </header>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <form
          ref={formRef}
          onSubmit={submit}
          aria-labelledby="food-form-title"
          className={`scroll-mt-6 rounded-3xl bg-white p-5 shadow-card ring-2 transition-colors ${editing ? "ring-brand-400" : "ring-line"}`}
        >
          {editing && (
            <div
              role="status"
              className="mb-4 rounded-2xl bg-brand-50 p-3 text-brand-700"
            >
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide">
                <PencilIcon className="h-4 w-4" aria-hidden />
                {t("foodEditingBadge")}
              </div>
              <p className="mt-1 font-semibold">{editingName}</p>
              <p className="mt-1 text-xs">{t("foodEditingHint")}</p>
            </div>
          )}
          <h2 id="food-form-title" className="text-lg font-bold">
            {editing
              ? t("foodEditingTitle", { name: editingName })
              : t("foodAddTitle")}
          </h2>
          <div className="mt-4 space-y-3">
            {(
              [
                ["name", "Food name"],
                ["brand", "Brand or note"],
                ["serving_amount_g", "Serving amount (g)"],
                ["calories_per_serving", "Calories per serving"],
                ["protein_g_per_serving", "Protein per serving (g)"],
                ["fat_g_per_serving", "Fat per serving (g)"],
                ["carbs_g_per_serving", "Carbohydrates per serving (g)"],
                ["notes", "Notes"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="block text-sm font-medium text-ink-soft"
              >
                {label}
                <input
                  ref={key === "name" ? nameRef : undefined}
                  disabled={saving}
                  required={
                    key === "name" ||
                    key.includes("serving_amount") ||
                    key.includes("calories") ||
                    key.includes("protein") ||
                    key.includes("fat")
                  }
                  type={
                    key === "name" || key === "notes" || key === "brand"
                      ? "text"
                      : "number"
                  }
                  min={key === "serving_amount_g" ? "0.01" : "0"}
                  step="0.01"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border border-line px-3 text-ink"
                />
              </label>
            ))}
          </div>
          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            disabled={saving}
            className="disabled:opacity-60 mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 font-bold text-white"
          >
            {saving ? (
              t("foodSaving")
            ) : editing ? (
              <>
                <CheckIcon className="h-4 w-4" aria-hidden />
                {t("savedFoodSave")}
              </>
            ) : (
              <>
                <PlusIcon className="h-4 w-4" />
                Add food
              </>
            )}
          </button>
          {editing && (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setEditing(null);
                setForm(blank);
                setError("");
              }}
              className="mt-3 w-full text-sm font-semibold text-ink-soft"
            >
              {t("savedFoodCancel")}
            </button>
          )}
        </form>
        <section>
          <label className="relative block">
            <SearchIcon className="absolute left-3 top-3 h-5 w-5 text-ink-faint" />
            <input
              aria-label="Search saved foods"
              placeholder="Search foods"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-white pl-10 pr-3"
            />
          </label>
          <div className="mt-3 space-y-3">
            {foods.map((food) => (
              <article
                key={food.id}
                className={`rounded-3xl bg-white p-4 shadow-card ring-2 transition-colors ${editing === food.id ? "ring-brand-400" : "ring-line"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-ink">{food.name}</h2>
                    {editing === food.id && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700">
                        <PencilIcon className="h-3 w-3" aria-hidden />
                        {t("foodEditingBadge")}
                      </span>
                    )}
                    {food.brand && (
                      <p className="text-sm text-ink-soft">{food.brand}</p>
                    )}
                    <p className="mt-2 text-sm">
                      <strong>{fmt(food.calories_per_serving)} kcal</strong> ·{" "}
                      {fmt(food.protein_g_per_serving, 1)} g protein ·{" "}
                      {fmt(food.fat_g_per_serving, 1)} g fat
                    </p>
                    <p className="text-xs text-ink-faint">
                      Per {fmt(food.serving_amount_g, 2)} g serving
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      disabled={saving}
                      aria-pressed={editing === food.id}
                      onClick={() => edit(food)}
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 ring-1 ring-line"
                    >
                      {t("savedFoodEdit")}
                    </button>
                    <button
                      disabled={saving}
                      onClick={() => void archive(food.id)}
                      aria-label={`Delete ${food.name}`}
                      className="rounded-xl p-2 text-ink-soft ring-1 ring-line"
                    >
                      {t("savedFoodDelete")}
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {!foods.length && (
              <p className="rounded-3xl bg-white p-6 text-center text-ink-soft ring-1 ring-line">
                No saved foods yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
