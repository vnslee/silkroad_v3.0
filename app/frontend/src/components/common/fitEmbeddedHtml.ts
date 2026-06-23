// 팝업/풀사이즈 iframe에 embed된 렌더 엔진 HTML의 여백 축소 유틸(§5).
// 렌더 HTML은 standalone 열람 기준으로 max-width 래퍼(max-w-7xl/5xl) + mx-auto + 큰 패딩(48px)을
// 쓰는데, iframe 컨테이너 폭에 맞춰 펼치면 양옆 여백이 과하다. same-origin iframe이므로
// onLoad 시 내부 문서에 보정 CSS를 주입해 "페이지 래퍼"만 폭 제한을 풀고 패딩을 줄인다.
// 콘텐츠 내부의 차트(max-w-4xl)·이미지(max-w-[220px]) 등은 건드리지 않는다.

const STYLE_ID = 'aisea-embed-fit'

// 산출물 4종(report/detail × country/region)의 래퍼 구조가 조금씩 달라
// (main/p-margin/justify-center 유무, max-w 래퍼 깊이) 깊이 의존 대신 클래스 기반으로 잡는다.
const FIT_CSS = `
/* 1) 페이지 외곽 패딩 축소 (standalone 48px → embed 16px) */
main[class*="p-margin"],
main[class*="justify-center"],
body > div[class*="p-margin"],
body > div[class*="justify-center"] {
  padding: 16px !important;
}
/* 2) 중앙정렬 max-width 래퍼의 폭 제한 해제 — 컨테이너 꽉 채움.
   콘텐츠 내부 차트/이미지의 max-w(예: max-w-4xl, max-w-[220px])는 건드리지 않도록
   "mx-auto 와 함께 쓰인 페이지 래퍼"로 한정한다. */
div[class*="max-w-7xl"][class*="mx-auto"],
div[class*="max-w-6xl"][class*="mx-auto"],
div[class*="max-w-5xl"][class*="mx-auto"],
div[class*="max-w-5xl"][class*="w-full"] {
  max-width: 100% !important;
  width: 100% !important;
  margin-left: 0 !important;
  margin-right: 0 !important;
}
/* 3) detail 카드형 래퍼: 중앙정렬(items-start justify-center) flex 해제 → 카드가 폭 확장 */
body > div[class*="justify-center"],
main[class*="justify-center"] {
  display: block !important;
}
`

/**
 * iframe onLoad 핸들러. same-origin이 아니면 조용히 무시한다(보안 예외).
 */
export function fitEmbeddedHtml(ev: React.SyntheticEvent<HTMLIFrameElement>): void {
  const iframe = ev.currentTarget
  try {
    const doc = iframe.contentDocument
    if (!doc) return
    // 이미 주입돼 있으면 스킵(재로드 대비)
    if (doc.getElementById(STYLE_ID)) return
    const style = doc.createElement('style')
    style.id = STYLE_ID
    style.textContent = FIT_CSS
    doc.head.appendChild(style)
  } catch {
    // cross-origin 등 접근 불가 — 원본 그대로 둔다.
  }
}
