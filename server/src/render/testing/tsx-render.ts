// render.browser.test.ts 가 tsx 로 실행하는 확인용 스크립트 — 개발 서버(tsx)와 같은 변환에서도 측정 함수가 브라우저에서 도는지
import { closeBrowser } from '../browser.ts';
import { fontFaceCss } from '../fonts-css.ts';
import { renderCard } from '../render.ts';

const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaceCss(['pretendard'])}body{font-family:'Pretendard';margin:0}</style></head>
<body><div data-card style="width:400px;height:300px"><p data-slot="t" data-max-lines="1">tsx 에서 그리기</p></div></body></html>`;
const r = await renderCard(null, { html, width: 400, height: 300 });
console.log(JSON.stringify({ ok: r.ok, problems: r.problems }));
await closeBrowser();
