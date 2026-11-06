// 릴스 서버 호출 — 일반 호출은 app/src/api.ts(Hono RPC)로, 파일 올리기(바이트 그대로)만 fetch
import { api } from '../api.ts';
import type { Asset, ReelDoc } from '../../../server/src/reels/model.ts';

async function j<T>(r: Response): Promise<T> {
  const b = (await r.json().catch(() => ({}))) as T & { error?: string; hint?: string | null };
  if (!r.ok) throw new Error([b.error ?? `서버 오류(${r.status}).`, b.hint].filter(Boolean).join(' '));
  return b;
}

export const reelApi = {
  state: () => api.api.reels.$get().then((r) => j<Awaited<ReturnType<typeof r.json>>>(r)),
  create: (name: string) => api.api.reels.$post({ json: { name } }).then((r) => j<{ id: number; name: string; doc: ReelDoc; updatedAt: string }>(r as unknown as Response)),
  get: (id: number) => api.api.reels[':id'].$get({ param: { id: String(id) } }).then((r) => j<{ id: number; name: string; doc: ReelDoc; updatedAt: string }>(r as unknown as Response)),
  save: (id: number, doc: ReelDoc) => api.api.reels[':id'].$put({ param: { id: String(id) }, json: { doc: doc as never } }).then((r) => j<{ updatedAt: string }>(r as unknown as Response)),
  remove: (id: number) => api.api.reels[':id'].$delete({ param: { id: String(id) } }).then((r) => j<{ ok: boolean }>(r as unknown as Response)),
  upload: (id: number, file: File) =>
    fetch(`/api/reels/${id}/media`, { method: 'POST', headers: { 'content-type': 'application/octet-stream', 'x-filename': encodeURIComponent(file.name) }, body: file }).then((r) => j<Asset>(r)),
  removeMedia: (id: number, file: string) => api.api.reels[':id'].media[':file'].$delete({ param: { id: String(id), file } }).then((r) => j<{ ok: boolean; doc: ReelDoc }>(r as unknown as Response)),
  render: (id: number, quality: '720' | '1080' | '4k') => api.api.reels[':id'].render.$post({ param: { id: String(id) }, json: { quality } }).then((r) => j<{ jobId: string }>(r as unknown as Response)),
  job: (jobId: string) =>
    api.api.reels.jobs[':jobId'].$get({ param: { jobId } }).then((r) => j<{ phase: string; progress: number; file: string | null; error: string | null; hint: string | null; lufs: number | null; seconds: number | null }>(r as unknown as Response)),
  cancel: (jobId: string) => api.api.reels.jobs[':jobId'].cancel.$post({ param: { jobId } }),
  transcribe: (id: number, file: string) =>
    api.api.reels[':id'].transcribe.$post({ param: { id: String(id) }, json: { file } }).then((r) => j<{ segments: Array<{ start: number; end: number; text: string }> }>(r as unknown as Response)),
};

export const mediaUrl = (reelId: number, file: string) => `/api/reels/${reelId}/media/${file}`;
