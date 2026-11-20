// 소리 파형 — 이 브라우저에서 파일을 풀어 봉우리만 남긴다(서버로 보내지 않음). 한 번 푼 것은 기억
const cache = new Map<string, Promise<Float32Array | null>>();
/** 1초에 몇 개의 봉우리를 남길지 */
export const PEAKS_PER_SEC = 60;

export function peaks(url: string): Promise<Float32Array | null> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const ctx = new OfflineAudioContext(1, 1, 44100);
        const audio = await ctx.decodeAudioData(buf);
        const ch = audio.getChannelData(0);
        const step = Math.max(1, Math.floor(audio.sampleRate / PEAKS_PER_SEC));
        const out = new Float32Array(Math.ceil(ch.length / step));
        for (let i = 0; i < out.length; i++) {
          let m = 0;
          for (let k = i * step; k < Math.min(ch.length, (i + 1) * step); k++) m = Math.max(m, Math.abs(ch[k]!));
          out[i] = m;
        }
        return out;
      } catch {
        return null; // 소리가 없는 영상 · 풀 수 없는 형식
      }
    })();
    cache.set(url, p);
  }
  return p;
}
