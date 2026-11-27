// 「묶음별 평균」 묶음 — 축 · 형식 · 제목 유형으로 저장률 · 공유율 평균, 표본이 모자라면 「표본 부족」
import { DIMS, type Dim, type Group, type View } from './insightsShared.tsx';

export function GroupsSection({ groups, dim, setDim, s }: { groups: Group[]; dim: Dim; setDim: (d: Dim) => void; s: View['settings'] }) {
  return (
  <section className="card">
    <div className="card-head">
      <h2>묶음별 평균</h2>
      <div className="seg" role="tablist" aria-label="묶는 기준">
        {DIMS.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={dim === d.id} className={dim === d.id ? 'on' : ''} onClick={() => setDim(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
    </div>
    <p className="muted small">
      저장률 = 저장 ÷ 도달, 공유율 = 공유 ÷ 도달(게시물마다 낸 비율의 평균). {dim === 'format' ? '잇지 않은 게시물도 들어가요.' : '세트와 이은 게시물만 들어가요.'}
      {` 「표본 부족」은 값 있는 게시물이 ${s.minSamples}개보다 적어 결론을 내지 않는다는 뜻이에요.`}
      {dim === 'title' && ' 제목 유형은 표지 제목으로 정해요: 「?」 · 「…까 · 나요」로 끝나면 질문형, 숫자가 있으면 숫자형.'}
    </p>
    {groups.length === 0 ? (
      <p className="empty-state">{dim === 'format' ? '48시간이 지난 게시물이 아직 없어요.' : '48시간이 지난 게시물 중 세트와 이은 것이 아직 없어요.'}</p>
    ) : (
      <div className="ins-scroll">
        <table className="ins-table">
          <thead>
            <tr>
              <th>{DIMS.find((d) => d.id === dim)!.label}</th>
              <th className="num">게시물</th>
              <th className="num">저장률</th>
              <th className="num">공유율</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.key}>
                <td>{g.label}</td>
                <td className="num">{g.n}</td>
                <td className="num">
                  <Rate m={g.saveRate} />
                </td>
                <td className="num">
                  <Rate m={g.shareRate} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
  );
}

function Rate({ m }: { m: Group['saveRate'] }) {
  if (m.enough && m.formatted) return <>{m.formatted}</>;
  return (
    <span className="badge badge-off" title="값 있는 게시물이 모자라 결론을 내지 않아요">
      표본 부족{m.n ? ` · ${m.n}개` : ''}
    </span>
  );
}
