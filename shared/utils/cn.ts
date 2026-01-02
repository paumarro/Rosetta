import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind CSS classes with conflict resolution via tailwind-merge */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
