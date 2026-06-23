// HeaderEmblem — 상세화면(P1/P2)·보고서화면(PR1/PR2) 헤더 좌측 엠블럼.
// 국가(country): flagcdn 국기 이미지(실패 시 flag 아이콘 폴백).
// 권역(region): 단일 국기가 없으므로 권역 대표 이모지 + 권역색 그라데이션으로 채운다(mockup의 public 아이콘 보강).
import { useState } from 'react'
import type { Domain } from '../../api/types'
import { Icon } from './Icon'

// 권역 코드 → 대표 이모지(대륙) + 그라데이션색. 미정의 권역은 지구본으로 폴백.
const REGION_EMBLEM: Record<string, { emoji: string; from: string; to: string }> = {
  EU: { emoji: '🇪🇺', from: '#1a3a8f', to: '#2563c9' }, // 유럽
  APAC: { emoji: '🌏', from: '#0e7490', to: '#0891b2' }, // 아시아·태평양
  NA: { emoji: '🌎', from: '#9a3412', to: '#c2410c' }, // 북미
  SA: { emoji: '🌎', from: '#15803d', to: '#16a34a' }, // 남미
}

const REGION_FALLBACK = { emoji: '🌐', from: '#334155', to: '#475569' }

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
