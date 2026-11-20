import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
// 앱 화면 글꼴 — 소개 페이지와 같은 Pretendard(OFL, 앱 의존성 pretendard 1.3.9 의 파일을 같이 묶어 바깥 연결 없이 — FR-AC-1).
// 글자 범위별로 나뉜 파일이라 화면에 나온 글자의 조각만 읽는다. 사용자 결정 2026-11-17(앱 글꼴을 소개 페이지와 통일)
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html 에 #root 요소가 없습니다. app/index.html 을 확인하세요.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
