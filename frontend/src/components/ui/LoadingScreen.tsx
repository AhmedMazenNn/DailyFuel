export function LoadingScreen() {
  const arabic = document.documentElement.lang === "ar";
  return (
    <main
      className="fuel-loading"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="fuel-loading-glow" aria-hidden />
      <div className="fuel-loading-content">
        <div className="fuel-loading-orbit" aria-hidden>
          <div className="fuel-loading-ring" />
          <div className="fuel-loading-mark">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            >
              <path d="M12 4a8 8 0 1 1-7.4 5" />
              <path d="M12 8v4l2.5 2" />
            </svg>
          </div>
        </div>
        <p className="fuel-loading-eyebrow">YOUR DAILY DOSE OF BALANCE</p>
        <h1>
          DailyFuel<span>.</span>
        </h1>
        <p className="fuel-loading-label">
          {arabic ? "نجهز مساحتك اليومية…" : "Getting your day ready…"}
        </p>
        <div className="fuel-loading-track" aria-hidden>
          <span />
        </div>
        <p className="fuel-loading-footnote">
          {arabic ? "وجبة واحدة في كل مرة" : "One meal at a time."}
        </p>
      </div>
    </main>
  );
}
