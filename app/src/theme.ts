// 밝은 · 어두운 판 고르기(사용자 결정 2026-11-17). 「시스템」이면 컴퓨터 설정을 따르고(prefers-color-scheme),
// 밝게 · 어둡게를 고르면 <html data-theme> 로 고정한다. 저장은 이 브라우저에만(쓰는 사람 한 명의 편의 설정이라 서버 설정이 아니다)
import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const KEY = 'ff.theme';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
}

export function useTheme(): [ThemeChoice, (c: ThemeChoice) => void] {
  const [choice, setChoice] = useState<ThemeChoice>(read);
  useEffect(() => {
    apply(choice);
    try {
      if (choice === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, choice);
    } catch {
      // 저장소를 못 쓰는 창(비공개 창 등)이면 이번 화면에만 적용
    }
  }, [choice]);
  return [choice, setChoice];
}
