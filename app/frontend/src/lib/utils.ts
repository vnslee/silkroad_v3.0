import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// shadcn 관례 — 조건부 클래스 병합(clsx) 후 Tailwind 충돌 해소(twMerge).
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
