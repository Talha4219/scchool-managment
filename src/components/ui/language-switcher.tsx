"use client";

import { Languages, Check } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import { LANGUAGES } from "@/lib/i18n/translations";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Compact globe-icon dropdown. Reused in both the dashboard header and the
 *  public login page — the two surfaces parents actually land on. */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useLanguage();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          title={t("common.language")}
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground transition-colors shrink-0 ${className}`}
        >
          <Languages className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 border-0 shadow-2xl rounded-2xl p-1">
        {LANGUAGES.map(l => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code)}
            className="flex items-center justify-between rounded-xl text-xs font-medium cursor-pointer"
          >
            <span>{l.nativeLabel}</span>
            {lang === l.code && <Check className="h-3 w-3 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
