// RegionReport (PR2) — 권역 퀵윈 분석 보고서.
// mockup 04_region_report.html 구조 그대로: sticky 탭 네비 + 탭별 콘텐츠.
// 헤더 chrome(대상/버전 선택·PDF·메일)은 ReportView가 담당하므로 여기선 본문만 렌더.
import { useState } from 'react'
import type { RegionReportData } from './types'
import { SummaryTab } from './region/SummaryTab'
import { KillswitchTab } from './region/KillswitchTab'
import { AttractivenessTab } from './region/AttractivenessTab'
import { ITTab } from './region/ITTab'
import { MarketTab } from './region/MarketTab'

interface Props {
  data: RegionReportData
  className?: string
}

type TabId = 'summary' | 'killswitch' | 'attractiveness' | 'it' | 'market'

const TABS: { id: TabId; icon: string; label: string; sub: string }[] = [
  { id: 'summary', icon: 'summarize', label: '요약', sub: 'Summary' },
  { id: 'killswitch', icon: 'verified_user', label: '킬스위치', sub: 'Kill-Switch' },
  { id: 'attractiveness', icon: 'trending_up', label: '매력도', sub: 'Attractiveness' },
  { id: 'it', icon: 'leaderboard', label: 'IT/순위', sub: 'IT & Ranking' },
  { id: 'market', icon: 'public', label: '시장배경', sub: 'Market' },
]

export function RegionReport({ data, className = '' }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('summary')

  return (
    <main className={`px-gutter sm:px-xl lg:px-[64px] py-xl ${className}`}>
      <div className="max-w-7xl mx-auto">
        {/* sticky 탭 네비 */}
        <div className="bg-surface-container-lowest border border-surface-border rounded-xl p-sm mb-xl sticky top-0 z-10 card-shadow">
          <div className="flex gap-sm overflow-x-auto" role="tablist" aria-label="권역 보고서 탭">
            {TABS.map((t) => {
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
                  <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                  <span>{t.label}</span>
                  <span className="opacity-60 text-[10px]">{t.sub}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div role="tabpanel">
          {activeTab === 'summary' && <SummaryTab data={data} />}
          {activeTab === 'killswitch' && <KillswitchTab data={data} />}
          {activeTab === 'attractiveness' && <AttractivenessTab data={data} />}
          {activeTab === 'it' && <ITTab data={data} />}
          {activeTab === 'market' && <MarketTab data={data} />}
        </div>
      </div>
    </main>
  )
}
