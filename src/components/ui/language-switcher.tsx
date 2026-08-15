"use client";

import { useState, useEffect } from "react";
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

  // Radix's DropdownMenu ids are only guaranteed to match between the SSR
  // pass and the client's first render when the surrounding tree shape is
  // identical on both — mounting the Radix wrapper only after hydration
  // (rendering the plain trigger button in its place until then) means
  // there's nothing for React to diff-mismatch. Same fix as the header's
  // other dropdowns in (dashboard)/layout.tsx.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  const trigger = (
    <button
      title={t("common.language")}
      className={`flex h-10 w-10 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground transition-colors shrink-0 ${className}`}
    >
      <Languages className="h-4 w-4" />
    </button>
  );

  if (!ready) return trigger;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
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
