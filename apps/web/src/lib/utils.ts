/**
 * utils.ts — shared utility functions
 *
 * cn(): class name merger (clsx + tailwind-merge).
 * Required by all components that use conditional Tailwind classes.
 * This is the ONLY approved way to merge Tailwind classes (FRONTEND_RULES.md §5.2).
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
