// 릴스 계획 실험 a (2026-10-30, docs/service/릴스-계획.md): Fish Audio 무료 모델(s2.1-pro-free)에 한국어 한 문장을 한 번 보내 본다.
//   node --env-file=.env scripts/probe-fish-tts.ts [출력 폴더]
// - 키는 .env 의 FISH_AUDIO_API_KEY(개발용 — 작업 규칙). 키 값은 어디에도 찍지 않는다
// - 요청 모양은 공식 문서(docs.fish.audio TTS 참조, 2026-10-30 확인): POST https://api.fish.audio/v1/tts, Authorization: Bearer,
//   헤더 model: s2.1-pro-free, JSON 본문 { text, format, latency }. reference_id 없음 = 기본 목소리(문서: "the default voice")
// - 응답은 chunked 로 온다고만 적혀 있어(본문 형식 · 길이 정보는 문서에 없음) 받은 대로 기록: 상태 · content-type · 첫 바이트까지 · 전체 시간 · 바이트 수,
//   오디오 길이는 ffprobe 로 잰다(응답에 시간 정보가 없어서 — 문장별 길이도 이렇게 얻을 계획)
// - 문장은 AI 생성 예시(데모 페르소나) — 개인정보 없음. 무료 판 요청은 모델 개선에 쓰일 수 있다(공식 블로그) — 그래서 이런 문장만 보낸다
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const key = process.env.FISH_AUDIO_API_KEY;
if (!key) {
  console.error('FISH_AUDIO_API_KEY 가 없습니다. 레포 맨 위 .env 에 한 줄로 넣은 뒤 `node --env-file=.env scripts/probe-fish-tts.ts` 로 다시 실행하세요.');
  process.exit(1);
}
const out = process.argv[2] ?? 'tests/results/fish-tts-probe';
fs.mkdirSync(out, { recursive: true });
const TEXT = '에러 메시지는 무엇이 틀렸는지, 어느 줄인지까지 알려 주는 글이에요.';
const body = { text: TEXT, format: 'mp3', latency: 'normal' };

const t0 = performance.now();
const res = await fetch('https://api.fish.audio/v1/tts', {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', model: 's2.1-pro-free' },
  body: JSON.stringify(body),
});
const headersMs = performance.now() - t0;
const headers = Object.fromEntries([...res.headers].filter(([k]) => !/cookie|authorization/i.test(k)));
let firstByteMs: number | null = null;
const chunks: Uint8Array[] = [];
if (res.body) {
  const reader = res.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (firstByteMs === null) firstByteMs = performance.now() - t0;
    chunks.push(value);
  }
}
const totalMs = performance.now() - t0;
const buf = Buffer.concat(chunks);
const result: Record<string, unknown> = {
  at: new Date().toISOString(),
  model: 's2.1-pro-free',
  request: { ...body, textChars: [...TEXT].length },
  status: res.status,
  headers,
  headersMs: Math.round(headersMs),
  firstByteMs: firstByteMs === null ? null : Math.round(firstByteMs),
  totalMs: Math.round(totalMs),
  bytes: buf.length,
};
if (res.ok) {
  const file = path.join(out, 'probe.mp3');
  fs.writeFileSync(file, buf);
  result.ffprobe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels:format=duration,bit_rate', '-of', 'json', file]).toString());
} else {
  // 오류 본문은 그대로(키는 들어 있지 않다 — 응답 본문). 길면 앞 1000자
  result.errorBody = buf.toString('utf8').slice(0, 1000);
}
fs.writeFileSync(path.join(out, 'probe.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify(result, null, 1));
