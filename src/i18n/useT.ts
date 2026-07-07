import { useMemo } from "react";
import { useAppStore } from "../store/useAppStore";
import { t, type TranslationKey } from "./index";

export function useT(): typeof t {
  useAppStore((state) => state.locale);
  return useMemo(() => t, []);
}

export type { TranslationKey };
