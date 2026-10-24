"use client";

import { Card, Button } from "@/shared/components";

export interface AppItem {
  name: string;
  microsoftClientKey: string;
  appId?: string;
  capabilities: Array<"api" | "sql" | "workflow">;
  rulePath?: string;
  ruleFiles?: string[];
  baseApiUrl: string;
  swaggerEndpointUrl?: string;
  schemaEndpointUrl?: string;
  sqlExecuteEndpoint?: string;
  welcomeMessage?: string;
  quickSuggestions?: string[];
  domainPlaybook?: string;
}

interface AppsTableProps {
  apps: AppItem[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenConfig: (app: AppItem) => void;
}

export function AppsTable({
  apps,
  loading,
  searchQuery,
  onSearchChange,
  onOpenConfig,
}: AppsTableProps) {
  const filteredApps = apps.filter((app) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      app.name.toLowerCase().includes(q) ||
      (app.microsoftClientKey && app.microsoftClientKey.toLowerCase().includes(q)) ||
      app.baseApiUrl.toLowerCase().includes(q) ||
      (app.swaggerEndpointUrl && app.swaggerEndpointUrl.toLowerCase().includes(q))
    );
  });

  return (
    <Card className="w-full overflow-hidden">
      {/* Thanh công cụ tìm kiếm và lọc */}
      <div className="p-4 border-b border-border bg-surface/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative w-full">
            <span className="material-symbols-outlined text-text-muted text-lg absolute left-3 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm theo tên dự án, Microsoft Client Key hoặc URL backend..."
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-border bg-surface text-text-main focus:outline-hidden focus:border-indigo-500"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span>
            Hiển thị <strong>{filteredApps.length}</strong> / <strong>{apps.length}</strong> ứng
            dụng
          </span>
        </div>
      </div>

      {/* Tiêu đề Bảng */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-surface/70 border-b border-border text-xs font-semibold text-text-muted">
        <div className="col-span-4">DỰ ÁN / TÊN ỨNG DỤNG</div>
        <div className="col-span-3">MICROSOFT CLIENT KEY</div>
        <div className="col-span-3">MÁY CHỦ BACKEND & OPENAPI</div>
        <div className="col-span-2 text-right">THAO TÁC</div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-text-muted text-sm flex flex-col items-center justify-center gap-3">
          <span className="material-symbols-outlined animate-spin text-2xl text-indigo-500">
            progress_activity
          </span>
          <span>Đang nạp danh mục ứng dụng từ SQLite...</span>
        </div>
      ) : filteredApps.length === 0 ? (
        <div className="p-16 text-center flex flex-col items-center justify-center gap-2">
          <span className="material-symbols-outlined text-4xl text-text-muted">search_off</span>
          <p className="text-sm font-semibold text-text-main">Không tìm thấy ứng dụng nào</p>
          <p className="text-xs text-text-muted">
            Thử thay đổi từ khóa tìm kiếm hoặc bấm "Thêm Ứng Dụng Mới".
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredApps.map((app) => {
            const hasApi = app.capabilities?.includes("api");
            const hasSql = app.capabilities?.includes("sql");

            return (
              <div
                key={app.microsoftClientKey}
                className="px-6 py-4 flex flex-col md:grid md:grid-cols-12 gap-4 items-start md:items-center hover:bg-surface/50 transition-colors"
              >
                {/* Cột 1: Tên Dự án & Icon & Quyền năng */}
                <div className="col-span-4 flex items-center gap-3.5">
                  <div className="size-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
                    <span className="material-symbols-outlined text-xl">apps</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-sm text-text-main truncate"
                        title={app.name}
                      >
                        {app.name}
                      </span>
                      <div className="flex items-center gap-1">
                        {hasApi && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            API
                          </span>
                        )}
                        {hasSql && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            SQL
                          </span>
                        )}
                      </div>
                    </div>
                    {app.welcomeMessage && (
                      <p
                        className="text-[11px] text-text-muted truncate max-w-xs mt-0.5"
                        title={app.welcomeMessage}
                      >
                        {app.welcomeMessage}
                      </p>
                    )}
                  </div>
                </div>

                {/* Cột 2: Microsoft Client Key */}
                <div className="col-span-3 flex flex-col gap-1 min-w-0">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 w-fit max-w-full truncate"
                    title={app.microsoftClientKey}
                  >
                    <span className="size-1.5 rounded-full bg-purple-500 shrink-0"></span>
                    <span className="truncate">{app.microsoftClientKey}</span>
                  </span>
                  <span className="text-[11px] text-text-muted">Định danh ứng dụng</span>
                </div>

                {/* Cột 3: Máy chủ & Swagger */}
                <div className="col-span-3 flex flex-col gap-1 text-xs min-w-0">
                  <div
                    className="flex items-center gap-1 font-mono text-text-main truncate"
                    title={app.baseApiUrl}
                  >
                    <span className="material-symbols-outlined text-xs text-text-muted">dns</span>
                    <span className="truncate">{app.baseApiUrl}</span>
                  </div>
                  {app.swaggerEndpointUrl ? (
                    <a
                      href={app.swaggerEndpointUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-mono text-[11px] text-indigo-500 hover:underline truncate max-w-full"
                      title={app.swaggerEndpointUrl}
                    >
                      <span className="material-symbols-outlined text-xs">open_in_new</span>
                      <span className="truncate">{app.swaggerEndpointUrl}</span>
                    </a>
                  ) : (
                    <span className="text-[11px] text-text-muted italic">
                      Chưa cấu hình Swagger
                    </span>
                  )}
                </div>

                {/* Cột 4: Nút Thao tác mở Popup */}
                <div className="col-span-2 flex items-center justify-end gap-2 w-full md:w-auto">
                  <Button
                    onClick={() => onOpenConfig(app)}
                    className="gap-1.5 text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 shadow-2xs font-medium"
                  >
                    <span className="material-symbols-outlined text-base">tune</span>
                    Cấu hình
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
