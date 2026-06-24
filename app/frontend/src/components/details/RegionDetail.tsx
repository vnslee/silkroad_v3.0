// RegionDetail (P2) — 권역 상세 정보 화면.
// 디자인 참조: region_detail_rendering_engine.py 산출 HTML(DTL_<REGION>_NNN.html) 구조.
// 구성(스펙 §4 P2): KPI 3카드 → 기진출 국가 → (권역 지도 + 진출예정국 Quick-Win 순위) → 권역 인사이트.
// 데이터는 프론트에서 3-소스 병합(buildRegionDetail) — 표현만 담당(렌더링 엔진 미사용).
import { useEffect, useRef, useState } from 'react'
import type {
  RegionDetailData,
  RegionCandidateCountry,
  RegionEnteredCountry,
} from '../reports/types'
import { buildRegionMapGeometry } from './regionMapGeo'

interface Props {
  data: RegionDetailData
  className?: string
}

// 진출상태 → 지도 노드 색(채움/글자) + 범례 라벨. render_helpers _MAP_STATE와 동일.
const MAP_STATE: Record<string, { fill: string; fg: string; label: string }> = {
  운영중: { fill: '#3f6cb4', fg: '#ffffff', label: '운영중' },
  준비중: { fill: '#6e97d6', fg: '#101622', label: '준비중' },
  미진출: { fill: '#eef0f2', fg: '#3b3f46', label: '미진출/후보' },
}

// 점수(0-100) → 신호색. render_helpers.score_color와 동일.
function scoreColor(v: number): string {
  return v >= 70 ? '#4f8a6d' : v >= 50 ? '#3f6cb4' : v >= 35 ? '#c08a2e' : '#c0533f'
}

// 법인종류(SA/JV) → 라벨·색. region_detail_rendering_engine _ENTITY_TYPE와 동일.
const ENTITY_TYPE: Record<string, { label: string; bg: string; fg: string }> = {
  SA: { label: '단독법인', bg: '#e9f3ee', fg: '#4f8a6d' },
  JV: { label: 'JV', bg: '#fbf0e6', fg: '#c08a2e' },
}

function Badge({ text, bg, fg }: { text: string; bg: string; fg: string }) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded font-label-sm text-label-sm whitespace-nowrap"
      style={{ background: bg, color: fg }}
    >
      {text}
    </span>
  )
}

export function RegionDetail({ data, className = '' }: Props) {
  const kpi = data.kpi ?? { candidates: 0, quickwin: 0, killswitch_failed: 0 }
  const entered = data.entered_countries ?? []
  const candidates = [...(data.candidate_countries ?? [])].sort(
    (a, b) => (a.quick_win_rank ?? 999) - (b.quick_win_rank ?? 999),
  )
  const members = data.map?.members ?? []
  const es = data.executive_summary

  return (
    <div
      className={`flex items-start justify-center min-h-full w-full p-margin-mobile md:p-margin-desktop bg-background ${className}`}
    >
      <div className="w-full max-w-5xl rounded-xl custom-shadow-level-3 flex flex-col border-surface-border bg-surface-container">
        <div className="p-lg flex flex-col gap-xl">
          {/* 제목(권역명)은 DetailView 헤더 chrome에 이미 노출 — 바디 중복 제거 */}
          {/* KPI 3카드 */}
          <div className="grid grid-cols-3 gap-sm">
            <KpiCard value={kpi.candidates} label="분석 후보국" color="#3F6CB4" />
            <KpiCard value={kpi.quickwin} label="Quick-win 최우선" color="#4F8A6D" />
            <KpiCard value={kpi.killswitch_failed} label="킬스위치 탈락" color="#14171C" />
          </div>

          {/* 기진출 국가 */}
          {entered.length > 0 && <EnteredList rows={entered} />}

          {/* 권역 지도 + 진출예정국 Quick-Win 순위 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md items-stretch">
            <RegionMap code={data.code} members={members} />
            {candidates.length > 0 && <QuickwinTable rows={candidates} />}
          </div>

          {/* 권역 인사이트 */}
          <RegionInsight es={es} baseline={data.baseline_country} />
        </div>
      </div>
    </div>
  )
}

function KpiCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-surface-container-lowest border border-surface-border rounded-[14px] p-md text-center">
      <div className="font-mono text-[clamp(25.5px,calc(22.5px_+_0.833vw),34.5px)] font-bold leading-none" style={{ color }}>
        {value}
      </div>
      <div className="font-body-sm text-[clamp(10.2px,calc(9px_+_0.333vw),13.8px)] text-[#6B7280] mt-1">{label}</div>
    </div>
  )
}

function EntityCell({ type }: { type: string }) {
  const e = ENTITY_TYPE[(type || '').toUpperCase()]
  if (!e) return <span className="text-on-surface-variant">—</span>
  return <Badge text={e.label} bg={e.bg} fg={e.fg} />
}

function ProductsCell({ products }: { products: string[] }) {
  if (!products?.length) return <span className="text-on-surface-variant">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {products.map((p, i) => (
        <Badge key={i} text={p} bg="#eaf0f8" fg="#2c4c86" />
      ))}
    </div>
  )
}

function EnteredList({ rows }: { rows: RegionEnteredCountry[] }) {
  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2">
      <h3 className="font-headline-md text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)] leading-[24px] text-primary font-bold mb-md">
        기진출 국가
      </h3>
      <table className="w-full text-left border-collapse font-body-sm text-body-sm">
        <thead>
          <tr className="bg-surface-light border-b border-surface-border">
            <Th>국가</Th>
            <Th>법인종류</Th>
            <Th>설립연도</Th>
            <Th>관리상품</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.code}
              className="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors"
            >
              <td className="p-sm text-on-surface">
                {r.name_ko}
                {r.name_en && r.name_en !== r.name_ko && (
                  <span className="text-on-surface-variant"> {r.name_en}</span>
                )}
              </td>
              <td className="p-sm">
                <EntityCell type={r.type} />
              </td>
              <td className="p-sm text-on-surface-variant">{r.since ?? '—'}</td>
              <td className="p-sm">
                <ProductsCell products={r.products} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RegionMap({ code, members }: { code: string; members: RegionDetailData['map']['members'] }) {
  // 실제 국경(world-atlas 50m)을 권역 멤버 bbox 에 fit 해 클로즈업. 진출상태별 채움.
  // atlas 매칭 0건(미등록 권역)이면 안내 폴백.
  // 지도 영역의 실제 크기를 ResizeObserver 로 측정해 그 비율로 projection 을 fit —
  // 패널이 넓든 좁든 letterbox 여백 없이 지도가 영역을 꽉 채운다.
  const areaRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 360, h: 380 })

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect
      if (!r) return
      const w = Math.round(r.width)
      const h = Math.round(r.height)
      if (w > 0 && h > 0) setSize((p) => (p.w === w && p.h === h ? p : { w, h }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const geo = buildRegionMapGeometry(members, size.w, size.h)
  const statusByCode = Object.fromEntries(members.map((m) => [m.code, m.status]))
  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">
      <h3 className="font-headline-md text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)] leading-[24px] text-primary font-bold mb-md">
        권역 지도
      </h3>
      <div ref={areaRef} className="flex-1 flex items-stretch justify-center min-h-[380px]">
        {geo ? (
          <svg
            viewBox={geo.viewBox}
            preserveAspectRatio="xMidYMid meet"
            className="w-full h-full"
            role="img"
            aria-label={`${code} 권역 진출 상태 지도`}
          >
            {geo.shapes.map((s) => {
              const st = MAP_STATE[statusByCode[s.code]] ?? MAP_STATE['미진출']
              // 라벨 폰트는 viewBox(=패널 실측) 좌표계 기준 — 짧은 변에 비례시켜 패널 크기와 무관하게 일정한 화면 크기로 보이게 한다.
              const fs = Math.max(9, Math.min(18, Math.min(geo.width, geo.height) * 0.042))
              return (
                <g key={s.code}>
                  <path
                    d={s.d}
                    fill={st.fill}
                    stroke="#ffffff"
                    strokeWidth="0.7"
                    strokeLinejoin="round"
                  />
                  <text
                    x={s.label[0]}
                    y={s.label[1] + fs * 0.34}
                    textAnchor="middle"
                    fontSize={fs}
                    fontWeight="700"
                    fill={st.fg}
                    paintOrder="stroke"
                    stroke="rgba(255,255,255,0.85)"
                    strokeWidth={fs * 0.16}
                  >
                    {s.code}
                  </text>
                </g>
              )
            })}
          </svg>
        ) : (
          <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
            이 권역의 지도 데이터를 표시할 수 없습니다.
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-md mt-md pt-md border-t border-surface-border">
        {Object.values(MAP_STATE).map((s) => (
          <span
            key={s.label}
            className="flex items-center gap-xs font-label-sm text-label-sm text-on-surface-variant"
          >
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: s.fill }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function QuickwinTable({ rows }: { rows: RegionCandidateCountry[] }) {
  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2 flex flex-col h-full">
      <h3 className="font-headline-md text-[clamp(15.3px,calc(13.5px_+_0.5vw),20.7px)] leading-[24px] text-primary font-bold mb-md">
        진출 예정국 Quick-Win 순위
      </h3>
      <table className="w-full text-left border-collapse font-body-sm text-body-sm">
        <thead>
          <tr className="bg-surface-light border-b border-surface-border">
            <Th>#</Th>
            <Th>국가</Th>
            <Th>종합점수</Th>
            <Th>판정</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const v = r.composite_score ?? 0
            const col = scoreColor(v)
            return (
              <tr
                key={r.code}
                className="border-b border-surface-border last:border-0 hover:bg-surface-variant transition-colors"
              >
                <td className="p-sm font-label-md text-label-md text-primary font-bold">
                  {r.quick_win_rank ?? '—'}
                </td>
                <td className="p-sm text-on-surface whitespace-nowrap">
                  {r.name_ko}{' '}
                  <span className="font-mono text-xs text-on-surface-variant">{r.code}</span>
                </td>
                <td className="p-sm">
                  <div className="flex items-center gap-xs min-w-[88px]">
                    <div className="flex-1 w-full h-base bg-surface-border rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(0, Math.min(100, v))}%`, background: col }}
                      />
                    </div>
                    <span
                      className="font-label-md text-label-md font-semibold w-7 text-right shrink-0"
                      style={{ color: col }}
                    >
                      {Math.round(v * 10) / 10}
                    </span>
                  </div>
                </td>
                <td className="p-sm">
                  <Badge
                    text={r.quick_win ? '퀵윈' : r.quadrant || '-'}
                    bg={r.quick_win ? '#e9f3ee' : '#eef0f2'}
                    fg={r.quick_win ? '#4f8a6d' : '#3b3f46'}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function RegionInsight({
  es,
  baseline,
}: {
  es: RegionDetailData['executive_summary']
  baseline?: string
}) {
  // 기준국(top1·why_top1) 얘기는 제외 — AI 교차 인사이트만 본문으로.
  // 보고서 SummaryTab과 동일하게 기준국 언급 항목('기준국'·'baseline'·'(코드)')도 제외.
  const cross = (es?.ai_cross_insight?.insights ?? []).filter((i) => {
    const ko = i.ko || i.en || ''
    if (!ko) return false
    if (/기준국|baseline/i.test(ko)) return false
    if (baseline && ko.includes(`(${baseline})`)) return false
    return true
  })
  // 마지막 라인: 해당 권역 뉴스 1건(권역 스코프 우선, 없으면 첫 항목).
  const newsItems = es?.external_news_scan?.items ?? []
  const news = newsItems.find((n) => n.scope === 'region') ?? newsItems[0]
  if (cross.length === 0 && !news) return null
  return (
    <div className="bg-surface rounded-lg p-lg border border-surface-border custom-shadow-level-2">
      <div className="flex items-center gap-sm mb-md">
        <h3 className="font-headline-md text-[clamp(18.7px,calc(16.5px_+_0.611vw),25.3px)] leading-[30px] text-primary font-bold flex-1">
          권역 인사이트
        </h3>
        <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full whitespace-nowrap">
          AI 분석
        </span>
      </div>
      {cross.length > 0 && (
        <div className="flex flex-col gap-md">
          {cross.map((i, idx) => (
            <p key={idx} className="font-body-md text-body-md text-on-surface leading-relaxed m-0">
              {(i.ko || i.en)!.trim()}
            </p>
          ))}
        </div>
      )}
      {news && <RegionNewsLine news={news} hasAbove={cross.length > 0} />}
    </div>
  )
}

// 권역 인사이트 마지막 라인 — 해당 권역 뉴스 1건(헤드라인 + 출처·날짜). url 있으면 링크.
function RegionNewsLine({
  news,
  hasAbove,
}: {
  news: NonNullable<RegionDetailData['executive_summary']>['external_news_scan']['items'][number]
  hasAbove: boolean
}) {
  const meta = [news.publisher, news.date].filter(Boolean).join(' · ')
  const headline = (news.headline || '').trim()
  if (!headline) return null
  return (
    <div className={hasAbove ? 'mt-md pt-md border-t border-surface-border' : ''}>
      <div className="flex items-center gap-xs mb-1">
        <span className="font-label-sm text-label-sm text-secondary bg-secondary-fixed px-2 py-0.5 rounded-full whitespace-nowrap">
          권역 뉴스
        </span>
        {meta && (
          <span className="font-label-sm text-label-sm text-outline truncate">{meta}</span>
        )}
      </div>
      {news.url ? (
        <a
          href={news.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-body-md text-body-md text-on-surface leading-relaxed hover:text-secondary hover:underline"
        >
          {headline}
        </a>
      ) : (
        <p className="font-body-md text-body-md text-on-surface leading-relaxed m-0">{headline}</p>
      )}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="p-sm font-label-md text-label-md text-outline font-semibold">{children}</th>
  )
}
