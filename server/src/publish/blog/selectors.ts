// 티스토리 글쓰기 화면의 자리(사용자 결정 2026-11-20 — 완전 자동 발행). 공식 API 가 2024 년에 끝나 화면을 채우는 수밖에 없다.
// 출처: 2026-11-20 에 본 공개 저장소 스크립트 셋(violetbeach/ai-tools · leejw1212/tistory-skin · boksajang/blogauto-naver)이 서로 일치한 값만.
// 코드는 옮기지 않았고 화면의 자리(사실)만 적었다. **실제 티스토리 계정으로는 확인 못 함** — 티스토리가 화면을 바꾸면 여기 한 곳을 고친다
export const TISTORY = {
  /** 글쓰기 주소 — 로그인 전이면 로그인 화면으로 넘어간다 */
  newPost: (blog: string) => `https://${blog}.tistory.com/manage/newpost/`,
  /** 발행 뒤 넘어가는 글 목록 주소 */
  postsPath: /^\/manage\/posts\/?$/,
  /** 발행 뒤 글 주소를 찾는 공개 RSS */
  rss: (blog: string) => `https://${blog}.tistory.com/rss`,
  title: '#post-title-inp',
  /** 본문 편집기는 TinyMCE — window.tinymce.activeEditor 로 글을 넣는다(모드 바꾸기 없이) */
  editorReady: 'iframe[id$="_ifr"], .mce-edit-area',
  /** 사진 넣기: 편집기 도구 막대의 첨부 단추 → 「사진」 메뉴 → 파일 고르기 창 */
  attachButton: ['#mceu_0-open', 'button:has(.mce-i-image)', 'button:has(#attach-image-text)'],
  attachImageItem: ['#attach-image-text', '[role="menuitem"]:has(#attach-image-text)', '.mce-menu-item:has(#attach-image-text)'],
  tag: '#tagText',
  /** 「완료」 → 발행 설정 층 */
  done: '#publish-layer-btn',
  visibility: { public: '#open20', private: '#open0' },
  publish: '#publish-btn',
} as const;
