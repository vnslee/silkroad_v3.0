// HeaderEmblem — 상세화면(P1/P2)·보고서화면(PR1/PR2) 헤더 좌측 엠블럼.
// 국가(country): flagcdn 국기 이미지(실패 시 flag 아이콘 폴백).
// 권역(region): 공식 권역기가 있으면 그 깃발(예: EU), 없는 대륙권(NA·SA·APAC)은 지구본 아이콘.
import { useState } from 'react'
import type { Domain } from '../../api/types'
import { Icon } from './Icon'

// 공식 권역기가 있는 권역만 flagcdn 코드를 둔다. 그 외 대륙권은 깃발 없음 → 지구본 폴백.
const REGION_FLAG: Record<string, string> = {
  EU: 'eu', // 유럽연합 공식기
}

type Props = {
  domain: Domain
  /** 국가/권역 코드 (예: ES, EU) */
  code: string
  /** 대체 텍스트용 이름 */
  name?: string
}

export function HeaderEmblem({ domain, code, name }: Props) {
  const [imgFailed, setImgFailed] = useState(false)
  const box =
    'flex h-12 w-16 flex-shrink-0 items-center justify-center overflow-hidden rounded border border-surface-border shadow-sm'

  // 국기/권역기 이미지 소스 결정.
  // - 국가: 항상 국가 ISO2 국기.
  // - 권역: 공식 권역기가 있으면 그 깃발, 없으면 이미지 없음(지구본 표시).
  const isCountry = domain === 'country'
  const flagCode = isCountry ? code.toLowerCase() : REGION_FLAG[code.toUpperCase()]

  // 공식기가 없는 권역 → 지구본 아이콘.
  if (!flagCode) {
    return (
      <div className={`${box} bg-surface-container`} role="img" aria-label={`${name ?? code} 권역`}>
        <Icon name="public" filled className="text-primary text-[26px]" />
      </div>
    )
  }

  // 깃발 이미지 — 실패 시 flag 아이콘으로 폴백.
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
        alt={isCountry ? `${name ?? code} 국기` : `${name ?? code} 권역기`}
        src={`https://flagcdn.com/w160/${flagCode}.png`}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setImgFailed(true)}
      />
    </div>
  )
}
