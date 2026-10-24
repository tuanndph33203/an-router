"use client";

import { Button } from "@/shared/components";

interface AppsHeaderProps {
  onRefresh: () => void;
  onAddNew: () => void;
}

export function AppsHeader({ onRefresh, onAddNew }: AppsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl border border-border bg-surface">
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-xs">
          <span className="material-symbols-outlined text-2xl">apps</span>
        </div>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-text-main">Ứng dụng Kết nối</h1>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Service Directory
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Quản lý danh bạ kỹ thuật các dự án vệ tinh, địa chỉ OpenAPI Swagger và cơ chế tự động
            kết nối của OmniRoute.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          onClick={onRefresh}
          className="gap-2 text-xs border-border bg-surface hover:bg-surface/80"
        >
          <span className="material-symbols-outlined text-base">refresh</span>
          Làm mới
        </Button>

        <Button
          onClick={onAddNew}
          className="gap-2 text-xs bg-gradient-to-r from-rose-500 to-indigo-600 hover:from-rose-600 hover:to-indigo-700 text-white font-medium shadow-md shadow-indigo-500/20 border-0"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Thêm Ứng Dụng Mới
        </Button>
      </div>
    </div>
  );
}
