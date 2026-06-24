// 보고서 탭 전환 시 스크롤을 맨 위로 — country/region 보고서 공용.
// 탭 콘텐츠는 조상(ReportView의 overflow-auto 컨테이너)에서 스크롤되므로, 주어진 요소에서
// 가장 가까운 '실제 스크롤되는 조상'을 찾아 top으로 보낸다(없으면 window 폴백).
export function scrollReportToTop(from: HTMLElement | null): void {
  let el: HTMLElement | null = from?.parentElement ?? null
  while (el) {
    const style = getComputedStyle(el)
    const oy = style.overflowY
    if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) {
      el.scrollTo({ top: 0, behavior: 'auto' })
      return
    }
    el = el.parentElement
  }
  window.scrollTo({ top: 0, behavior: 'auto' })
}
