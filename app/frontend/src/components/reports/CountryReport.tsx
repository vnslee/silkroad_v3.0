// CountryReport (PR1) — 국가 진출 진단 보고서 본문(탭+콘텐츠).
// 헤더 chrome(국가 선택·PDF·메일)은 ReportView가 담당. 여기는 본문만 렌더.
// 디자인 source of truth: mockup 03_country_report.html (Kinetic Enterprise 팔레트).
import { useRef, useState } from 'react'
import type { CountryReportData } from './types'
import { useT } from '../../i18n/dict'
import { scrollReportToTop } from './scrollReportToTop'
import { SummaryTab } from './country/SummaryTab'
import { SimilarityTab } from './country/SimilarityTab'
import { DecisionTreeTab } from './country/DecisionTreeTab'
import { TcoTab } from './country/TcoTab'
import { MarketTab } from './country/MarketTab'

interface Props {
  data: CountryReportData
  className?: string
  // 인쇄 모드 — true면 탭 네비 없이 모든 탭을 섹션 제목과 함께 세로로 펼쳐 렌더(PDF용).
  printMode?: boolean
}

const TABS = [
  { id: 'summary', labelKey: 'rpt.tab.summary' },
  { id: 'similarity', labelKey: 'rpt.tab.similarity' },
  { id: 'decision', labelKey: 'rpt.tab.decision' },
  { id: 'tco', labelKey: 'rpt.tab.tco' },
  { id: 'market', labelKey: 'rpt.tab.market' },
] as const

// 탭 id → 콘텐츠 컴포넌트(인쇄 시 전체 펼침에 재사용).
function TabContent({ id, data }: { id: (typeof TABS)[number]['id']; data: CountryReportData }) {
  switch (id) {
    case 'summary':
      return <SummaryTab data={data} />
    case 'similarity':
      return <SimilarityTab data={data} />
    case 'decision':
      return <DecisionTreeTab data={data} />
    case 'tco':
      return <TcoTab data={data} />
    case 'market':
      return <MarketTab data={data} />
  }
}

export function CountryReport({ data, className = '', printMode = false }: Props) {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]['id']>('summary')
  const navRef = useRef<HTMLDivElement>(null)
  const t = useT()

  // 탭 전환 시 스크롤을 맨 위로(이전 탭에서 내린 위치가 유지되지 않게).
  const changeTab = (id: (typeof TABS)[number]['id']) => {
    setActiveTab(id)
    scrollReportToTop(navRef.current)
  }

  // 인쇄 모드 — 모든 탭을 섹션 제목과 함께 세로로 펼쳐 렌더(탭별 새 페이지는 print CSS가 처리).
  if (printMode) {
    return (
      <div className={`px-gutter sm:px-xl lg:px-[64px] py-xl ${className}`}>
        <div className="max-w-7xl mx-auto">
          {TABS.map((tab) => (
            <section key={tab.id} className="report-print-section">
              <h2 className="report-print-heading font-headline-md text-headline-md text-primary mb-md">
                {t(tab.labelKey)}
              </h2>
              <TabContent id={tab.id} data={data} />
            </section>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`px-gutter sm:px-xl lg:px-[64px] py-xl ${className}`}>
      <div className="max-w-[min(92vw,1920px)] mx-auto">
        {/* 탭 네비게이션 (sticky 칩) */}
        <div ref={navRef} className="bg-surface-container-lowest border border-surface-border rounded-xl px-sm py-[6px] mb-xl sticky top-0 z-chrome card-shadow">
          <div className="flex gap-xs overflow-x-auto" role="tablist" aria-label={t('rpt.sections')}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeTab(tab.id)}
                  className={`flex items-center gap-xs px-[14px] py-sm rounded-[9px] text-[clamp(11.05px,calc(9.75px_+_0.361vw),14.95px)] font-semibold whitespace-nowrap transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary ${
                    active ? 'bg-primary text-on-primary' : 'text-text-secondary hover:bg-surface-container'
                  }`}
                >
                  {t(tab.labelKey)}
                </button>
              )
            })}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <TabContent id={activeTab} data={data} />
      </div>
    </div>
  )
}
