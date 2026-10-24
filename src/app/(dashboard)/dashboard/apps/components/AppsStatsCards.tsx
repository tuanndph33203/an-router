"use client";

interface AppsStatsCardsProps {
  totalApps: number;
  apiAppsCount: number;
  sqlAppsCount: number;
}

export function AppsStatsCards({ totalApps, apiAppsCount, sqlAppsCount }: AppsStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="p-4 rounded-xl border border-border bg-surface flex items-center gap-3.5">
        <div className="size-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 border border-amber-500/20">
          <span className="material-symbols-outlined text-2xl">apps</span>
        </div>
        <div>
          <p className="text-xs text-text-muted font-medium">Ứng dụng Dự án</p>
          <p className="text-xl font-bold text-text-main mt-0.5">
            {totalApps} <span className="text-xs font-normal text-text-muted">hệ thống</span>
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border bg-surface flex items-center gap-3.5">
        <div className="size-11 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20">
          <span className="material-symbols-outlined text-2xl">api</span>
        </div>
        <div>
          <p className="text-xs text-text-muted font-medium">Khả năng Thực thi</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm font-bold text-text-main">
              {apiAppsCount} <span className="text-xs font-normal text-text-muted">REST API</span>
            </span>
            <span className="text-xs text-text-muted">•</span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
              {sqlAppsCount} <span className="text-xs font-normal text-text-muted">SQL DB</span>
            </span>
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl border border-border bg-surface flex items-center gap-3.5">
        <div className="size-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 border border-emerald-500/20">
          <span className="material-symbols-outlined text-2xl">hub</span>
        </div>
        <div>
          <p className="text-xs text-text-muted font-medium">Cơ chế Khám phá API</p>
          <p className="text-sm font-semibold text-text-main mt-1">
            Định vị 2 bước & Tự tải OpenAPI
          </p>
        </div>
      </div>
    </div>
  );
}
