// Material Symbols 아이콘(mockup 동일 아이콘 세트). 이모지 대체 금지.
interface Props {
  name: string
  className?: string
  filled?: boolean
  title?: string
}

export function Icon({ name, className = '', filled = false, title }: Props) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden={title ? undefined : true}
      title={title}
      role={title ? 'img' : undefined}
    >
      {name}
    </span>
  )
}
