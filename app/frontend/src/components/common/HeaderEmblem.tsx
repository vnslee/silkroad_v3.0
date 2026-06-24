// HeaderEmblem — 상세화면(P1/P2)·보고서화면(PR1/PR2) 헤더 좌측 엠블럼.
// 국가(country): flagcdn 국기 이미지(실패 시 flag 아이콘 폴백).
// 권역(region): 단일 국기가 없으므로 권역 대표 이모지 + 권역색 그라데이션으로 채운다(mockup의 public 아이콘 보강).
import { useState } from 'react'
import type { Domain } from '../../api/types'
import { Icon } from './Icon'

// 권역 코드 → 대표 이모지(대륙) + AISea 지역색 그라데이션. 미정의 권역은 지구본으로 폴백.
// 지역색(AISea): NA(미주) #4F8BFF / ME #FBBF24 / EU #C8F051 / APAC #FB7185.
const REGION_EMBLEM: Record<string, { emoji: string; from: string; to: string }> = {
  EU: { emoji: '🇪🇺', from: '#C8F051', to: '#9fcf2e' }, // 유럽 — 라임그린
  APAC: { emoji: '🌏', from: '#FB7185', to: '#e04b62' }, // 아시아·태평양 — 로즈
  NA: { emoji: '🌎', from: '#4F8BFF', to: '#2f6be0' }, // 미주(남·북미 통합) — 블루
  ME: { emoji: '🌍', from: '#FBBF24', to: '#e0a300' }, // 중동 — 골드
}

const REGION_FALLBACK = { emoji: '🌐', from: '#3a4048', to: '#14181C' }

type Props = {
  domain: Domain
  /** 국가/권역 코드 (예: ES, EU) */
  code: string
  /** 대체 텍스트용 이름 */
  name?: string
}

export function HeaderEmblem({ domain, code, name }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const isCountry = domain === 'country'
  const box =
    'flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-surface-border shadow-sm'

  if (isCountry) {
    // 국기 이미지 — 실패 시 flag 아이콘으로 폴백.
    if (imgFailed) {
      return (
        <div className={`${box} bg-surface-container`}>
          <Icon name="flag" filled className="text-primary text-[24px]" />
        </div>
      )
    }
    return (
      <div className={`${box} bg-surface-container`}>
        <img
          alt={`${name ?? code} 국기`}
          src={`https://flagcdn.com/w160/${code.toLowerCase()}.png`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgFailed(true)}
        />
      </div>
    )
  }

  // 권역 — 대표 이모지 + 권역색 그라데이션.
  const r = REGION_EMBLEM[code.toUpperCase()] ?? REGION_FALLBACK
  return (
    <div
      className={box}
      style={{ background: `linear-gradient(135deg, ${r.from}, ${r.to})` }}
      role="img"
      aria-label={`${name ?? code} 권역`}
    >
      <span className="text-[26px] leading-none" aria-hidden>
        {r.emoji}
      </span>
    </div>
  )
}
