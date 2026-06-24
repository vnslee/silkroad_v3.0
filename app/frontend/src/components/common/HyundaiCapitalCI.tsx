// 현대캐피탈 CI 로고 — 공식 자산(architecture/design/design_spec/HyundaiCapital_Logomark.jpg)을
// 여백 트림·투명 배경 PNG로 가공해 public/brand/에 둠.
// 경로는 Vite base(dev='/', prod='/app/')를 따라가도록 import.meta.env.BASE_URL로 조립한다
// (절대경로 '/app/...'는 base='./'인 dev에서 index.html로 fallback돼 이미지가 깨진다).
interface Props {
  className?: string
}

const CI_SRC = `${import.meta.env.BASE_URL}brand/hyundai_capital_ci.png`

export function HyundaiCapitalCI({ className = '' }: Props) {
  return (
    <img
      src={CI_SRC}
      alt="현대캐피탈"
      className={`h-[22px] w-auto select-none ${className}`}
      draggable={false}
    />
  )
}
