// 영상 뽑기(@remotion/renderer)가 읽는 입구. 길이는 편집 내용에서 계산한다
import { Composition, registerRoot } from 'remotion';
import { FPS, H, newReelDoc, totalFrames, W } from '../../../../server/src/reels/model.ts';
import { Reel, type ReelProps } from './Reel.tsx';

const defaultProps: ReelProps = {
  doc: newReelDoc('미리보기'),
  brand: { palette: { primary: '#3c4150', secondary: '#8f949c', accent: '#d9d9de', background: '#f4f5f7', text: '#111318' }, titleFont: 'pretendard', bodyFont: 'pretendard', handle: null },
  guide: { x: 0, y: 240, w: 1080, h: 1440 },
  mediaBase: '',
};

function Root() {
  return (
    <Composition
      id="Reel"
      component={Reel}
      width={W}
      height={H}
      fps={FPS}
      durationInFrames={totalFrames(defaultProps.doc)}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => ({ durationInFrames: totalFrames(props.doc) })}
    />
  );
}

registerRoot(Root);
