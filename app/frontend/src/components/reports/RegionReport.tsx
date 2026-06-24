// RegionReport (PR2) — 권역 퀵윈 분석 보고서.
// mockup 04_region_report.html 구조 그대로: sticky 탭 네비 + 탭별 콘텐츠.
// 헤더 chrome(대상/버전 선택·PDF·메일)은 ReportView가 담당하므로 여기선 본문만 렌더.
import { useState } from 'react'
import type { RegionReportData } from './types'
import { useT } from '../../i18n/dict'
import { SummaryTab } from './region/SummaryTab'
import { KillswitchTab } from './region/KillswitchTab'
import { AttractivenessTab } from './region/AttractivenessTab'
import { ITTab } from './region/ITTab'
import { MarketTab } from './region/MarketTab'

interface Props {
  data: RegionReportData
  className?: string
  // 인쇄 모드 — true면 탭 네비 없이 모든 탭을 섹션 제목과 함께 세로로 펼쳐 렌더(PDF용).
  printMode?: boolean
}

type TabId = 'summary' | 'killswitch' | 'attractiveness' | 'it' | 'market'

// 탭 라벨·서브라벨은 t()로 치환 — id별 dict 키 매핑.
const TAB_DEFS: { id: TabId; labelKey: string; subKey: string }[] = [
  { id: 'summary', labelKey: 'rgn.tab.summary', subKey: 'rgn.tab.summary.sub' },
  { id: 'killswitch', labelKey: 'rgn.tab.killswitch', subKey: 'rgn.tab.killswitch.sub' },
  { id: 'attractiveness', labelKey: 'rgn.tab.attractiveness', subKey: 'rgn.tab.attractiveness.sub' },
  { id: 'it', labelKey: 'rgn.tab.it', subKey: 'rgn.tab.it.sub' },
  { id: 'market', labelKey: 'rgn.tab.market', subKey: 'rgn.tab.market.sub' },
]

// 탭 id → 콘텐츠 컴포넌트(인쇄 시 전체 펼침에 재사용).
function TabContent({ id, data }: { id: TabId; data: RegionReportData }) {
  switch (id) {
    case 'summary':
      return <SummaryTab data={data} />
    case 'killswitch':
      return <KillswitchTab data={data} />
    case 'attractiveness':
      return <AttractivenessTab data={data} />
    case 'it':
      return <ITTab data={data} />
    case 'market':
      return <MarketTab data={data} />
  }
}

export function RegionReport({ data, className = '', printMode = false }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')
  const t = useT()
  const tabs = TAB_DEFS.map((d) => ({ id: d.id, label: t(d.labelKey), sub: t(d.subKey) }))

  // 인쇄 모드 — 모든 탭을 섹션 제목과 함께 세로로 펼쳐 렌더(탭별 새 페이지는 print CSS가 처리).
  if (printMode) {
    return (
      <main className={`px-gutter sm:px-xl lg:px-[64px] py-xl ${className}`}>
        <div className="max-w-7xl mx-auto">
          {tabs.map((t) => (
            <section key={t.id} className="report-print-section">
              <h2 className="report-print-heading font-headline-md text-headline-md text-primary mb-md">
                {t.label} <span className="text-text-secondary text-[0.7em]">{t.sub}</span>
              </h2>
              <TabContent id={t.id} data={data} />
            </section>
          ))}
        </div>
      </main>
    )
  }

  return (
    <main className={`px-gutter sm:px-xl lg:px-[64px] py-xl ${className}`}>
      <div className="max-w-[min(92vw,1920px)] mx-auto">
        {/* sticky 탭 네비 */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-xl p-sm mb-xl sticky top-0 z-10 card-shadow">
          <div className="flex gap-sm overflow-x-auto" role="tablist" aria-label="권역 보고서 탭">
            {tabs.map((t) => {
              const active = activeTab === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-xs px-md py-sm rounded-lg font-label-md text-label-md uppercase tracking-wider whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-primary text-on-primary'
                      : 'text-text-secondary hover:bg-surface-container'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="opacity-60 text-[clamp(8.5px,calc(7.5px_+_0.278vw),11.5px)]">{t.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div role="tabpanel">
          <TabContent id={activeTab} data={data} />
        </div>
      </div>
    </main>
  )
}
