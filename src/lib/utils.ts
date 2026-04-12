import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function sanitizeText(input: string): string {
  if (!input) return "";
  
  return input
    // 1. Strip all HTML tags
    .replace(/<[^>]*>/g, "")
    // 2. Strip script-related content (case-insensitive)
    .replace(/javascript:|data:|vbscript:/gi, "")
    // 3. Trim leading and trailing whitespace
    .trim()
    // 4. Collapse multiple consecutive spaces/newlines into single ones
    .replace(/\s+/g, " ");
}
