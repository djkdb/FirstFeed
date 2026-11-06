// 음성 받아쓰기 — 선택 기능(결정 2026-11-06). 이 컴퓨터의 faster-whisper(파이썬)를 설치한 사람만, 소리는 밖으로 보내지 않는다
import { execFile } from 'node:child_process';

const PY = `
import json, sys
from faster_whisper import WhisperModel
model = WhisperModel(sys.argv[2], device="auto", compute_type="int8")
segs, _ = model.transcribe(sys.argv[1], language="ko", vad_filter=True)
print(json.dumps([{"start": s.start, "end": s.end, "text": s.text.strip()} for s in segs], ensure_ascii=False))
`;

export interface Segment {
  start: number;
  end: number;
  text: string;
}

export const hasWhisper = (): Promise<boolean> => new Promise((res) => execFile('python3', ['-c', 'import faster_whisper'], (e) => res(!e)));

export function transcribe(fullPath: string, model: string): Promise<Segment[]> {
  return new Promise((res, rej) =>
    execFile('python3', ['-c', PY, fullPath, model], { maxBuffer: 32 * 1024 * 1024, timeout: 30 * 60 * 1000 }, (e, out, err) => {
      if (e) return rej(new Error(`받아쓰기에 실패했어요: ${String(err || e.message).split('\n').filter(Boolean).slice(-1)[0] ?? ''}`));
      try {
        res(JSON.parse(out) as Segment[]);
      } catch {
        rej(new Error('받아쓰기 결과를 읽지 못했어요.'));
      }
    }),
  );
}
