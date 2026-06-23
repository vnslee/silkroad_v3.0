// MicroExpander — 원형 아이콘에서 hover/focus 시 알약(pill)으로 펼쳐지며 라벨을 보이는
// 마이크로 인터랙션 버튼. 로딩 시 다시 원형으로 접히고 스피너를 표시한다.
//
// 이 프로젝트 규약에 맞춰 원본(shadcn/lucide) 대비 다음을 조정:
//  - 아이콘: lucide → Material Symbols(<Icon/>) (CLAUDE.md 아이콘 규약)
//  - 색: shadcn 토큰(primary-foreground 등) → AISea 시맨틱 토큰(on-primary·surface-border 등)
//  - 모션: framer-motion → motion/react
import * as React from 'react'
import { motion, type HTMLMotionProps, type Variants, AnimatePresence } from 'motion/react'
import { cn } from '../../lib/utils'
import { Icon } from '../common/Icon'

type Variant = 'default' | 'outline' | 'ghost' | 'destructive'

interface MicroExpanderProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  /** 펼쳐졌을 때 표시할 라벨. */
  text: string
  /** Material Symbols 아이콘 이름(예: 'save', 'picture_as_pdf'). icon 노드보다 우선순위 낮음. */
  iconName?: string
  /** 커스텀 아이콘 노드. 주어지면 iconName 대신 사용. */
  icon?: React.ReactNode
  /** 시각 스타일. */
  variant?: Variant
  /** true면 스피너 표시 + 상호작용 비활성 + 원형으로 접힘. */
  isLoading?: boolean
  /** 항상 펼친 상태로 둘지(반응형: 넓은 화면에서 라벨 상시 노출용). */
  expanded?: boolean
}

const VARIANT_STYLES: Record<Variant, string> = {
  default: 'bg-primary text-on-primary border border-primary shadow-sm hover:brightness-110',
  outline: 'bg-surface-container-lowest border border-primary text-primary hover:bg-surface-variant',
  ghost: 'bg-transparent border border-transparent text-on-surface-variant hover:bg-surface-container',
  destructive: 'bg-error text-on-error border border-error hover:brightness-110',
}

const containerVariants: Variants = {
  initial: { width: '40px' },
  hover: { width: 'auto' },
  loading: { width: '40px' },
}

const textVariants: Variants = {
  initial: { opacity: 0, x: -8 },
  hover: { opacity: 1, x: 0, transition: { delay: 0.12, duration: 0.26, ease: 'easeOut' } },
  exit: { opacity: 0, x: -4, transition: { duration: 0.1, ease: 'linear' } },
}

/** 원형↔알약 마이크로 인터랙션 버튼. */
export const MicroExpander = React.forwardRef<HTMLButtonElement, MicroExpanderProps>(
  ({ text, iconName, icon, variant = 'default', isLoading = false, expanded = false, className, onClick, ...props }, ref) => {
    const [isHovered, setIsHovered] = React.useState(false)
    const open = !isLoading && (isHovered || expanded)

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isLoading) return
      onClick?.(e)
    }

    return (
      <motion.button
        ref={ref}
        className={cn(
          'relative flex h-10 items-center overflow-hidden rounded-full',
          'whitespace-nowrap font-label-md text-label-md font-semibold',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          isLoading && 'cursor-not-allowed opacity-80',
          VARIANT_STYLES[variant],
          className,
        )}
        initial="initial"
        animate={isLoading ? 'loading' : open ? 'hover' : 'initial'}
        variants={containerVariants}
        transition={{ type: 'spring', stiffness: 150, damping: 20, mass: 0.8 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
        onClick={handleClick}
        disabled={isLoading}
        aria-label={text}
        {...props}
      >
        <span className="z-10 grid h-10 w-10 shrink-0 place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {isLoading ? (
              <motion.span
                key="spinner"
                initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              >
                <Icon name="progress_activity" className="animate-spin text-[20px]" />
              </motion.span>
            ) : (
              <motion.span
                key="icon"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.2 }}
              >
                {icon ?? <Icon name={iconName ?? 'add'} className="text-[20px]" />}
              </motion.span>
            )}
          </AnimatePresence>
        </span>

        <motion.span variants={textVariants} className="pl-0.5 pr-4">
          {text}
        </motion.span>
      </motion.button>
    )
  },
)

MicroExpander.displayName = 'MicroExpander'
