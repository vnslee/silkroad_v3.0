// ReportTabs - 보고서 탭 네비게이션
interface Tab {
  id: string
  label: string
  labelEn: string
}

interface Props {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  className?: string
}

export function ReportTabs({ tabs, activeTab, onTabChange, className = '' }: Props) {
  return (
    <div className={`border-b border-gray-200 ${className}`}>
      <nav className="flex gap-1 px-8" aria-label="Tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                px-6 py-3 text-sm font-medium border-b-2 transition-colors
                ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }
              `}
            >
              <span className="block">{tab.label}</span>
              <span className="block text-xs opacity-60 mt-0.5">{tab.labelEn}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
