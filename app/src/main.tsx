import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('index.html 에 #root 요소가 없습니다. app/index.html 을 확인하세요.');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
