// 통화 표시 컴포넌트 — 외화 금액을 한화(KRW)로 환산해 크게, 원본 통화를 작게 병기.
// 환율은 FxContext(상위 ReportView가 /api/fx 로드 후 주입)에서 읽는다.
//   <Money value={436953} currency="EUR" />        → 블록(2줄): 6.3억원 / €436,953
//   <Money value={4.94} currency="EUR" inline />    → 인라인: 6.3억원 (€436,953)
// 환산 불가(fx 없음·통화 미정의)면 원본만 표시.
import { createContext, useContext, type ReactNode } from 'react'
import type { FxData } from '../../api/types'
import { moneyParts } from '../../utils/currency'

const FxContext = createContext<FxData | null>(null)

export function FxProvider({ fx, children }: { fx: FxData | null; children: ReactNode }) {
  return <FxContext.Provider value={fx}>{children}</FxContext.Provider>
}

export function useFx(): FxData | null {
  return useContext(FxContext)
}

interface MoneyProps {
  value: number | null | undefined
  /** 원본 통화 코드(예: 'EUR'). 데이터의 currency 필드. */
  currency: string
  /** true면 한 줄 '한화 (원본)', false(기본)면 2줄(한화 위·원본 아래). */
  inline?: boolean
  /** 워터폴 등에서 +부호를 앞에 붙일 때. */
  signed?: boolean
  className?: string
  /** 보조(원본 통화) 텍스트 색 클래스. 다크 배경 등에서 대비 보정용(기본 text-text-secondary). */
  subClassName?: string
}

/** 한화 + 원본 통화 병기. inline=false면 2줄 블록, true면 한 줄. */
export function Money({
  value,
  currency,
  inline = false,
  signed = false,
  className = '',
  subClassName = 'text-text-secondary',
}: MoneyProps) {
  const fx = useFx()
  const { krw, original } = moneyParts(value, currency, fx)
  const sign = signed && typeof value === 'number' && value >= 0 ? '+' : ''

  // 환산 불가 — 원본만(서브라벨 없이).
  if (krw == null) {
    return <span className={className}>{`${sign}${original}`}</span>
  }

  if (inline) {
    return (
      <span className={className}>
        {`${sign}${krw}`}
        <span className={subClassName}> ({`${sign}${original}`})</span>
      </span>
    )
  }

  // 2줄 블록 — 한화 크게(상속 폰트), 원본 작게.
  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span>{`${sign}${krw}`}</span>
      <span className={`font-label-sm text-label-sm ${subClassName}`}>{`${sign}${original}`}</span>
    </span>
  )
}
