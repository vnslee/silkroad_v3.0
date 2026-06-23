// mailto URL 조립(C11, L7) — 단위 테스트 대상(FT-3).
// 서버 발송 없음·수신주소 무저장(to 비움), mailto 첨부 미지원 → 본문 링크 + 첨부 안내.
// SES 첨부 발송은 별도 범위(3차 제외) — sendMail 핸들러를 추상화해 추후 교체 가능.
import type { Domain } from '../api/types'

const MAX_BODY = 2000 // web_design_spec §6.6: 본문 ~2000자 이내

export interface MailtoInput {
  domain: Domain
  targetName: string
  reportId: string
  createdAt?: string
  summary: string
  htmlUrl: string
  pdfUrl?: string
}

export function buildMailtoUrl(input: MailtoInput): string {
  const subject = `[Silk Road] ${input.targetName} 진출 진단 보고서 — ${input.reportId}`

  const lines: string[] = [
    `${input.targetName} 진출 진단 보고서를 공유합니다.`,
    `· 보고서 ID: ${input.reportId}`,
  ]
  if (input.createdAt) lines.push(`· 생성일시: ${input.createdAt}`)
  lines.push(`· 요약: ${input.summary}`)
  lines.push('')
  lines.push(`▶ 보고서(HTML): ${toAbsolute(input.htmlUrl)}`)
  if (input.pdfUrl) lines.push(`▶ PDF: ${toAbsolute(input.pdfUrl)}`)
  lines.push('')
  lines.push('※ 메일 첨부는 지원되지 않습니다. PDF가 필요하면 위 링크에서 내려받아 첨부해 주세요.')

  let body = lines.join('\n')
  if (body.length > MAX_BODY) body = body.slice(0, MAX_BODY - 1) + '…'

  return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// 상대 API URL을 절대 URL로(메일 수신자가 클릭 가능하도록). 테스트 환경(window 없음)에선 원본 유지.
function toAbsolute(url: string): string {
  if (/^https?:\/\//.test(url)) return url
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin + url
  }
  return url
}
