// 범례(C4, FR-2.3) — AISea 좌하단 blur 칩. 색+텍스트 병행(AR-5).
// 육지 채색 4종(운영중·미진출·현대망·대상외) + 마커 2종(기진출국·진출후보국) 표시.
import { useT } from '../../i18n/dict'
import { LAND_COLORS } from './countryColor'

export function Legend() {
  const t = useT()
  // 육지 채색 4종 — countryColor.ts 팔레트와 동일 색(SoT).
  const lands: { key: string; color: string }[] = [
    { key: 'legend.operating', color: LAND_COLORS.operating },
    { key: 'legend.notEntered', color: LAND_COLORS.notEntered },
  ]
  return (
    <div className="absolute bottom-lg left-lg z-chrome flex items-center gap-md rounded-[11px] border border-surface-border bg-[rgba(255,255,255,0.92)] px-md py-sm font-label-md text-[13.5px] text-on-surface-variant shadow-[0_4px_14px_rgba(20,23,28,0.06)] backdrop-blur-[8px]">
      <span className="font-semibold text-on-surface">{t('legend.title')}</span>
      {lands.map((l) => (
        <span key={l.key} className="flex items-center gap-xs">
          <span
            className="h-[11px] w-[11px] rounded-[3px] border border-white/70"
            style={{ backgroundColor: l.color }}
          />
          {t(l.key)}
        </span>
      ))}
      <span className="h-3 w-px bg-surface-border" aria-hidden />
      <span className="flex items-center gap-xs">
        <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-white bg-[#14181C] shadow-[0_0_0_1.5px_#14181C]" />
        {t('legend.established')}
      </span>
      <span className="flex items-center gap-xs">
        <span className="h-[11px] w-[11px] rounded-full border-[1.5px] border-[#14181C] bg-accent shadow-[0_0_0_1.5px_#C8F051]" />
        {t('legend.candidate')}
      </span>
    </div>
  )
}
