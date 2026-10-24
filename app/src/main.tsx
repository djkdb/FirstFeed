import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
// 앱 화면 글꼴 — 소개 페이지와 같은 IBM Plex Sans KR(OFL, 앱에 같이 넣은 파일이라 바깥 연결 없이 — FR-AC-1). 결정 2026-10-24 · 디자인 통일
import '@fontsource/ibm-plex-sans-kr/400.css';
import '@fontsource/ibm-plex-sans-kr/600.css';
import '@fontsource/ibm-plex-sans-kr/700.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html 에 #root 요소가 없습니다. app/index.html 을 확인하세요.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
