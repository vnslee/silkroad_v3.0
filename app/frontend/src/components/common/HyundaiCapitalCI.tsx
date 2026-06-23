// 현대캐피탈 CI 로고 — 공식 자산(architecture/design/AISea/HyundaiCapital_Logomark.jpg)을
// 여백 트림·투명 배경 PNG로 가공해 public/brand/에 둠. Vite base('/app/') 기준 절대경로로 참조.
interface Props {
  className?: string
}

export function HyundaiCapitalCI({ className = '' }: Props) {
  return (
    <img
      src="/app/brand/hyundai_capital_ci.png"
      alt="현대캐피탈"
      className={`h-[22px] w-auto select-none ${className}`}
      draggable={false}
    />
  )
}
