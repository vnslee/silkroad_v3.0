// 상단 바(C4, FR-2.4) — AISea mockup 스타일 1단 헤더.
// 좌→우: (로고 블록=CI+AISea) · (내비: 지도/국가 분석▾/권역 분석▾/보고서▾/룰셋) · spacer · (국가 검색) · (한/EN 토글)
// 레이아웃 탭·챗 버튼은 제외(사용자 결정). 드롭다운 항목은 실제 카탈로그로 채우고 상태배지 표기(가짜 점수 금지).
import { useState } from 'react'
import type { CountrySummary, Domain, RegionSummary } from '../../api/types'
import { store } from '../../store'
import { useT } from '../../i18n/dict'
import { HyundaiCapitalCI } from '../common/HyundaiCapitalCI'
import { LanguageSelectorDropdown } from '../ui/language-selector-dropdown'
import { ExpandableSearch, type SearchSuggestion } from '../ui/expandable-search'

// 국가코드(ISO alpha-2) → 국기 이모지(regional indicator). 'ES' → 🇪🇸. 형식 안 맞으면 빈 문자열.
function flagEmoji(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return ''
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)),
  )
}

const MAX_SUGGESTIONS = 8

interface Props {
  countries: CountrySummary[]
  regions: RegionSummary[]
  /** 지도(홈) 활성 여부 — 호환용(현재 미사용). */
  onMap?: boolean
  /** '지도' 복귀 — 호환용(현재 미사용, CI 로고가 직접 리셋). */
  onGoMap?: () => void
}

type MenuKey = 'country' | 'region' | 'report' | null

function nav(hash: string) {
  window.location.hash = hash
}

export function TopBar({ countries, regions }: Props) {
  const [menu, setMenu] = useState<MenuKey>(null)
  const [search, setSearch] = useState('')
  const t = useT()

  const close = () => setMenu(null)
  const toggle = (k: Exclude<MenuKey, null>) => setMenu((m) => (m === k ? null : k))

  // 입력 부분일치(name/name_ko/code) 국가들 — 자동완성 후보. 코드 시작 일치를 우선 정렬.
  const matches = (() => {
    const q = search.trim().toLowerCase()
    if (!q) return []
    return countries
      .filter(
        (c) =>
          c.code.toLowerCase().includes(q) ||
          c.name.toLowerCase().includes(q) ||
          (c.name_ko ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => {
        // 한글명/영문명 prefix 일치를 가장 위로.
        const score = (c: (typeof countries)[number]) =>
          (c.name_ko ?? '').toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q) ? 0 : 1
        return score(a) - score(b)
      })
  })()

  const suggestions: SearchSuggestion[] = matches.slice(0, MAX_SUGGESTIONS).map((c) => ({
    id: c.code,
    label: c.name_ko ? `${c.name_ko}` : c.name,
    sub: c.name_ko ? c.name : c.code,
    prefix: flagEmoji(c.code),
  }))

  const goCountry = (code: string) => {
    close()
    setSearch('')
    nav(`#/country/${code}/detail?mode=popup`)
  }

  // 검색 — 후보 첫 매칭국으로 팝업 진입(Enter 폴백; 후보 선택은 onSelectSuggestion).
  const runSearch = () => {
    if (matches.length > 0) goCountry(matches[0].code)
  }

  return (
    <header
      className="absolute inset-x-0 top-0 z-chrome flex h-[60px] items-center gap-md border-b border-surface-border bg-[rgba(243,246,249,0.86)] px-lg backdrop-blur-[14px]"
    >
      {/* 로고 — 현대캐피탈 CI. 클릭 시 지도 초기화면으로. */}
      <button
        type="button"
        onClick={() => {
          close()
          // 지도 초기상태로 완전 리셋: 해시 비우고 새로고침.
          // 단, 지구본 인트로는 건너뛰고 펼쳐진 지도부터 — sessionStorage 1회성 플래그(App이 소비).
          sessionStorage.setItem('skipIntro', '1')
          window.location.hash = ''
          window.location.reload()
        }}
        aria-label={t('nav.toHome')}
        className="flex flex-none items-center rounded-lg pr-xs transition-opacity hover:opacity-80"
      >
        <HyundaiCapitalCI />
      </button>

      {/* 내비 — 각 항목별 드롭다운을 트리거 아래에 앵커 */}
      <nav className="flex flex-none items-center gap-[2px] whitespace-nowrap text-[16px]">
        <NavMenu
          label={t('nav.country')}
          open={menu === 'country'}
          onToggle={() => toggle('country')}
          onClose={close}
        >
          <Dropdown title={t('menu.countryTitle')}>
            {countries.map((c) => (
              <DropdownRow
                key={c.code}
                onClick={() => {
                  close()
                  nav(`#/country/${c.code}/detail?mode=fullscreen`)
                }}
              >
                <span className={`truncate ${c.is_baseline ? 'font-semibold text-on-surface' : ''}`}>
                  {c.name_ko ? `${c.name_ko} (${c.name})` : c.name}
                </span>
              </DropdownRow>
            ))}
          </Dropdown>
        </NavMenu>
        <NavMenu
          label={t('nav.region')}
          open={menu === 'region'}
          onToggle={() => toggle('region')}
          onClose={close}
        >
          <Dropdown title={t('menu.regionTitle')}>
            {regions.map((r) => (
              <DropdownRow
                key={r.code}
                onClick={() => {
                  close()
                  nav(`#/region/${r.code}/detail?mode=fullscreen`)
                }}
              >
                <span className="truncate">{r.name_ko ? `${r.name_ko} (${r.name})` : r.name}</span>
              </DropdownRow>
            ))}
          </Dropdown>
        </NavMenu>
        <NavMenu
          label={t('nav.report')}
          open={menu === 'report'}
          onToggle={() => toggle('report')}
          onClose={close}
        >
          <Dropdown title={t('menu.reportTitle')}>
            <DropdownRow
              onClick={() => {
                close()
                openFirstReport('country', countries)
              }}
            >
              <span>{t('menu.countryReport')}</span>
            </DropdownRow>
            <DropdownRow
              onClick={() => {
                close()
                openFirstReport('region', regions)
              }}
            >
              <span>{t('menu.regionReport')}</span>
            </DropdownRow>
          </Dropdown>
        </NavMenu>
        <button
          onClick={() => {
            close()
            nav('#/ruleset?mode=fullscreen')
          }}
          className="rounded-lg px-md py-sm font-medium text-on-surface-variant"
        >
          {t('nav.ruleset')}
        </button>
      </nav>

      <div className="flex-1" />

      {/* 한/영 언어 선택 드롭다운 */}
      <LanguageSelectorDropdown />

      {/* 국가 검색 — 아이콘→입력창 확장(MicroExpander 계열 모션) */}
      <ExpandableSearch
        value={search}
        onChange={setSearch}
        onSubmit={runSearch}
        suggestions={suggestions}
        onSelectSuggestion={(s) => goCountry(s.id)}
        placeholder={t('search.placeholder')}
        ariaLabel={t('search.aria')}
        className="flex-none"
      />

      {/* 챗봇 버튼 — AISea 어시스턴트 토글 */}
      <button
        type="button"
        onClick={() => store.toggleChat()}
        aria-label={t('chat.aria')}
        className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-primary text-white shadow-[0_4px_14px_rgba(63,108,180,0.32)] transition-transform hover:scale-105"
      >
        <span className="material-symbols-outlined text-[20px]">forum</span>
      </button>
    </header>
  )
}

// 내비 메뉴 항목 — 트리거 버튼 + (열림 시) 트리거 아래 앵커된 드롭다운.
function NavMenu({
  label,
  open,
  onToggle,
  onClose,
  children,
}: {
  label: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-xs rounded-lg px-md py-sm font-medium text-on-surface-variant"
      >
        {label}
        <span className="text-[9px] opacity-50">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[1]" onClick={onClose} />
          {children}
        </>
      )}
    </div>
  )
}

function Dropdown({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      role="menu"
      className="absolute left-0 top-[calc(100%+6px)] z-[2] max-h-[196px] w-max min-w-[120px] max-w-[240px] overflow-y-auto animate-aisea-pop rounded-[13px] border border-surface-border bg-surface-container-lowest p-[7px] shadow-[0_16px_44px_rgba(20,23,28,0.14)]"
    >
      {title && (
        <div className="px-md pb-xs pt-sm font-label-sm text-label-sm tracking-wide text-outline">{title}</div>
      )}
      {children}
    </div>
  )
}

function DropdownRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-sm rounded-[9px] px-md py-sm text-left font-body-sm text-body-sm transition-colors hover:bg-surface-container"
    >
      {children}
    </button>
  )
}

// 보고서 메뉴 — 보고서 보유 첫 대상으로 풀사이즈 진입(없으면 첫 항목).
function openFirstReport(
  domain: Domain,
  list: Array<{ code: string; has_report: boolean }>,
) {
  const target = list.find((x) => x.has_report) ?? list[0]
  if (target) nav(`#/${domain}/${target.code}/report?mode=fullscreen`)
}
