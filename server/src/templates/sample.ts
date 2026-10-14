// 시안 미리 보기에 쓰는 예시 원고 (실제 카드 원고는 FR-MK 에서 AI 가 만든다)
import type { FrameContent } from './types.ts';

export const SAMPLE_CONTENT: FrameContent[] = [
  { kind: 'cover', headline: '처음 쓰는 사람을 위한\n**설정 5가지**', chip: '입문 가이드', sub: '저장해 두고 하나씩 따라 해 보세요' },
  { kind: 'body', title: '권한부터 정하세요', text: '처음엔 **읽기만** 허락하세요.\n\n쓰기는 확인한 뒤에 켜도 늦지 않아요. 한 번 켜 둔 권한은 설정에서 언제든 끌 수 있습니다.', page: 2, total: 7, chip: '기초' },
  { kind: 'closing', headline: '저장해 두고\n하나씩 따라 하세요' },
  { kind: 'reel_cover', headline: '설정\n**5가지**\n3분이면 끝', chip: '입문' },
];
