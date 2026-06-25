// DetailView(C6, FR-4, L8) — 상세 React 컴포넌트 렌더링 (iframe 제거).
// 헤더: 국기 + [국가/권역 선택 드롭다운] + 상태배지 + [데이터 버전 드롭다운] + 시뮬레이션·보고서.
// 본문은 React 컴포넌트로 직접 렌더링 (CountryDetail / RegionDetail).
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { paths } from '../../api/paths'
import type { CountrySummary, Domain, RegionSummary } from '../../api/types'
import { store, useStore } from '../../store'
import { LangProvider } from '../../i18n/locale'
import { Icon } from '../common/Icon'
import { HeaderSelect, type SelectOption } from '../common/HeaderSelect'
import { HeaderEmblem } from '../common/HeaderEmblem'
import { MicroExpander } from '../ui/micro-expander'
import { useT, statusLabel } from '../../i18n/dict'
import type { EntryMode } from '../../app/route'
import { CountryDetail } from '../details/CountryDetail'
import { RegionDetail } from '../details/RegionDetail'
import type {
  CountryDetailData,
  CountryReportData,
  RegionDetailData,
  RegionReportData,
} from '../reports/types'
import { buildRegionDetail, type RegionResearchSnapshot } from '../../utils/regionDetail'
import { formatTimestamp, formatVersionLabel } from '../../utils/format'

interface Props {
  domain: Domain
  code: string
  mode: EntryMode
}

interface CatalogItem {
  code: string
  name: string
  nameKo?: string
  region?: string
  isBaseline: boolean
  hasReport: boolean
  // 진출 상태(internal country_status): '운영중'|'미진출'|'진출예정'|'준비중' 등. 없으면 undefined.
  status?: string
  // 진출형태(internal country_assets[code].type): '단독법인'|'JV'. 값이 있으면 기진출국.
  entryMode?: string
  // 진출국 사용 솔루션. 기진출국만.
  solution?: string
  // 진출연도. 기진출국만.
  since?: number
}

export default function DetailView({ domain, code, mode }: Props) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [versions, setVersions] = useState<string[]>([])
  const [version, setVersion] = useState<string | undefined>(undefined) // undefined = latest
  const [simulating, setSimulating] = useState(false)
  const [detailData, setDetailData] = useState<CountryDetailData | RegionDetailData | null>(null)
  // 국가(P1) "진출 정보" 패널용 최신 보고서 — 없으면 null(진출 상태만 표시).
  const [countryReport, setCountryReport] = useState<CountryReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const t = useT()
  const lang = useStore((s) => s.lang)

  // 카탈로그(대상 선택용)
  useEffect(() => {
    let cancelled = false
    const load = domain === 'country' ? api.getCountries() : api.getRegions()
    load
      .then((list) => {
        if (cancelled) return
        setCatalog(
          (list as Array<CountrySummary | RegionSummary>).map((x) => ({
            code: x.code,
            name: x.name,
            nameKo: x.name_ko ?? undefined,
            region: 'region' in x ? (x.region ?? undefined) : undefined,
            isBaseline: 'is_baseline' in x ? x.is_baseline : false,
            hasReport: x.has_report,
            status: 'status' in x ? (x.status ?? undefined) : undefined,
            entryMode: 'entry_mode' in x ? (x.entry_mode ?? undefined) : undefined,
            solution: 'solution' in x ? (x.solution ?? undefined) : undefined,
            since: 'since' in x ? (x.since ?? undefined) : undefined,
          })),
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [domain])

  // 대상 변경 시: 버전 목록 로드 + 버전 초기화 + 존재 확인
  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)
    setVersion(undefined)

    api
      .getDetailVersions(domain, code)
      .then((v) => !cancelled && setVersions(v))
      .catch(() => !cancelled && setVersions([]))

    api
      .getExistence(domain, code)
      .then((info) => {
        if (cancelled) return
        if (!info.exists) {
          setError(t('dv.noResearch'))
          return
        }
        // 상세화면은 React가 직접 렌더한다 — 리서치 데이터만 있으면 바로 준비 완료.
        // (과거엔 서버에 HTML 캐시를 만들 때까지 비동기 잡을 폴링했으나, 이제 불필요.)
        setReady(true)
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [domain, code])

  // 상세 JSON 데이터 로드
  useEffect(() => {
    if (!ready) {
      setDetailData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)
    setCountryReport(null)

    // 리서치 스냅샷 JSON (detail 경로) — country는 그대로, region은 병합 입력으로 사용.
    const detailPath = paths.detail(domain, code, version)
    const fetchSnapshot = fetch(detailPath).then((res) => {
      if (!res.ok) throw new Error(`Failed to load detail: ${res.statusText}`)
      return res.json()
    })

    if (domain === 'country') {
      // "진출 정보" 패널(시스템 결정·IT 유사도·베이스라인·기준 솔루션)은 보고서 JSON에 있다.
      // 보고서는 미생성일 수 있으므로 실패/부재 시 null로 진행(진출 상태만 표시).
      const fetchReport = api
        .listReports(domain, code)
        .then((res) => {
          const latest = res.reports[res.reports.length - 1]
          if (!latest) return null
          return api.getReportJson<CountryReportData>(domain, code, latest.report_id)
        })
        .catch(() => null)

      Promise.all([fetchSnapshot, fetchReport])
        .then(([data, report]) => {
          if (cancelled) return
          setDetailData(data)
          setCountryReport(report ?? null)
          setLoading(false)
        })
        .catch((e) => {
          if (cancelled) return
          setError(String(e))
          setLoading(false)
        })
      return () => {
        cancelled = true
      }
    }

    // region(P2): 3-소스 병합 — 리서치 스냅샷 + 원시 internal(detail-sources) + 최신 퀵윈 보고서.
    // 보고서는 없을 수 있으므로(미생성) 실패해도 null로 진행(후보/인사이트만 빈 값).
    const fetchSources = api.getRegionDetailSources(code)
    const fetchReport = api
      .listReports(domain, code)
      .then((res) => {
        const latest = res.reports[res.reports.length - 1]
        if (!latest) return null
        return api.getReportJson<RegionReportData>(domain, code, latest.report_id)
      })
      .catch(() => null)

    Promise.all([fetchSnapshot, fetchSources, fetchReport])
      .then(([snapshot, sources, report]) => {
        if (cancelled) return
        setDetailData(
          buildRegionDetail(snapshot as RegionResearchSnapshot, sources, report ?? null),
        )
        setLoading(false)
      })
      .catch((e) => {
        if (cancelled) return
        setError(String(e))
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [domain, code, version, ready])

  const isCountry = domain === 'country'
  const meta = catalog.find((c) => c.code === code)
  // 리서치 데이터 생성일시 — country/region 모두 detailData.fetched_at에 ISO 타임스탬프 보유.
  const researchGeneratedLabel = formatTimestamp(detailData?.fetched_at)
  // 진출 상태 — 백엔드 country_detail 엔진과 동일 기준: country_status(meta.status) 우선,
  // 없으면 country_assets 보유(meta.entryMode) → '기진출', 둘 다 없으면 '미진출'. (hasReport 무관)
  const status = meta?.isBaseline
    ? '기준국'
    : meta?.status ?? (meta?.entryMode ? '기진출' : '미진출')
  // 색: 운영중/기진출=초록, 미진출=레드, 그 외(진출예정·준비중 등)=중립. (detail 엔진 _status_badge와 일치)
  const statusStyle = meta?.isBaseline
    ? 'bg-secondary-fixed text-on-secondary-fixed-variant'
    : status === '운영중' || status === '기진출'
      ? 'bg-success-container text-success border border-success/30'
      : status === '미진출'
        ? 'bg-error-container text-error border border-error/30'
        : 'bg-surface-container text-on-surface-variant'

  // 대상 선택 옵션
  const targetOptions: SelectOption[] = catalog.map((c) => ({
    value: c.code,
    // 영문 모드: 영문명만. 한글 모드: "한글명 (영문명)".
    label: lang !== 'en' && c.nameKo ? `${c.nameKo} (${c.name})` : c.name,
    sub: c.code,
  }))
  // 버전 옵션(최신 + 리서치 스냅샷 타임스탬프들). value=<TS>, label=사람이 읽기 쉬운 일시.
  const versionOptions: SelectOption[] = [
    { value: '', label: t('dtl.ver.latest'), sub: t('dtl.ver.latestSub') },
    ...versions.map((v) => ({ value: v, label: formatVersionLabel(v), sub: t('dtl.ver.snapshot') })),
  ]

  const goTarget = (newCode: string) => {
    // 현재 진입 모드(팝업/풀사이즈) 유지 — 풀사이즈면 같은 페이지 내 교체.
    window.location.hash = `#/${domain}/${newCode}/detail?mode=${mode}`
  }

  // [시뮬레이션] — 보고서 생성 잡 트리거 → store 등록 시 ProgressPanel(§5.3)이 진행 바를 노출.
  const runSimulation = () => {
    setSimulating(true)
    api
      .createReport(domain, code)
      .then((job) => {
        store.addJob({
          jobId: job.job_id,
          kind: 'report',
          domain,
          id: code,
          label: t('dv.reportJob').replace('{name}', meta?.name ?? code),
        })
      })
      .catch((e) => setError(t('dv.reportTriggerFailed').replace('{error}', String(e))))
      .finally(() => setSimulating(false))
  }

  return (
    <div className="content-scale flex h-full min-h-0 flex-col">
      {/* 헤더 chrome — relative z-overlay로 본문(sticky z-chrome)보다 위 스태킹 컨텍스트를 만들어
          드롭다운(absolute top-full)이 본문 위로 펼쳐지게 한다. */}
      <div className="relative z-overlay flex shrink-0 items-start justify-between gap-md border-b border-surface-border p-lg pr-16">
        <div className="flex items-center gap-md">
          <HeaderEmblem domain={domain} code={code} name={meta?.name} />
          <div>
            <div className="flex items-baseline gap-sm">
              {/* 국가/권역 선택 드롭다운 */}
              <HeaderSelect
                ariaLabel={isCountry ? t('dv.selectCountry') : t('dv.selectRegion')}
                options={targetOptions}
                value={code}
                onChange={goTarget}
                trigger={
                  <span className="flex items-baseline gap-sm">
                    <span className="font-headline-lg text-headline-lg text-primary">{meta?.name ?? code}</span>
                    {/* 한글 보조 표기는 한글 모드에서만 — 영문 모드는 영문명만. */}
                    {lang !== 'en' && meta?.nameKo && (
                      <span className="font-body-lg text-body-lg text-on-surface-variant">{meta.nameKo}</span>
                    )}
                  </span>
                }
              />
            </div>
            <div className="mt-xs flex items-center gap-sm">
              {/* 진출 상태 배지는 국가에만 해당 — 권역은 진출 상태 개념이 없어 미표시. */}
              {isCountry && (
                <span className={`inline-flex items-center rounded px-2 py-0.5 font-label-sm text-label-sm ${statusStyle}`}>
                  {statusLabel(status, lang)}
                </span>
              )}
              <span className="font-label-sm text-label-sm text-outline">
                {isCountry ? `${t('map.regionPrefix')}: ${meta?.region ?? '-'}` : t('map.regionPrefix')}
              </span>
              {/* 데이터 버전 선택 */}
              <span className="font-label-sm text-label-sm text-outline">·</span>
              <HeaderSelect
                ariaLabel={t('dv.selectDataVersion')}
                options={versionOptions}
                value={version ?? ''}
                onChange={(v) => setVersion(v || undefined)}
                trigger={
                  <span className="flex items-center gap-xs font-label-sm text-label-sm text-secondary">
                    <Icon name="history" className="text-[14px]" />
                    {version ? formatVersionLabel(version) : t('dtl.ver.latestShort')}
                  </span>
                }
              />
              {/* 리서치 데이터 생성일시 — 보고서 헤더 Generated 표시와 동일 형식(YYYY-MM-DD HH:MM). */}
              {researchGeneratedLabel && (
                <>
                  <span className="font-label-sm text-label-sm text-outline">·</span>
                  <span className="font-label-sm text-label-sm text-text-secondary">
                    Generated: {researchGeneratedLabel}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <MicroExpander
            variant="outline"
            iconName="play_circle"
            text={t('action.simulation')}
            isLoading={simulating}
            expanded
            onClick={runSimulation}
          />
          <MicroExpander
            variant="default"
            iconName="description"
            text={t('action.report')}
            expanded
            onClick={() => {
              window.location.hash = `#/${domain}/${code}/report?mode=${mode}`
            }}
          />
        </div>
      </div>

      {/* 본문 — React 컴포넌트로 렌더링 */}
      <div className="min-h-0 flex-1 overflow-auto bg-surface">
        {error && (
          <div className="flex h-full items-center justify-center p-lg text-center font-body-md text-on-surface-variant">
            {error}
          </div>
        )}
        {!error && !ready && (
          <div className="flex h-full items-center justify-center p-lg font-body-md text-on-surface-variant">
            {t('dv.preparing')}
          </div>
        )}
        {!error && ready && loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">{t('dv.loading')}</p>
          </div>
        )}
        {!error && ready && !loading && detailData && (
          <LangProvider value={lang}>
            {domain === 'country' && (
              <CountryDetail
                data={detailData as CountryDetailData}
                report={countryReport}
                entryStatus={statusLabel(status, lang)}
                entryStatusStyle={statusStyle}
                entered={Boolean(meta?.entryMode)}
                entrySolution={meta?.solution}
                entryMode={meta?.entryMode}
                entrySince={meta?.since}
                baselineNameKo={
                  countryReport
                    ? (() => {
                        const b = catalog.find(
                          (c) => c.code === countryReport.tabs.tab_1_2_decision.base_country,
                        )
                        if (!b) return undefined
                        // 영문 모드: 영문명(name) 우선, 없으면 한글명 폴백. 한글 모드: 한글명.
                        return (lang === 'en' ? b.name : b.nameKo) ?? b.nameKo ?? undefined
                      })()
                    : undefined
                }
              />
            )}
            {domain === 'region' && <RegionDetail data={detailData as RegionDetailData} />}
          </LangProvider>
        )}
      </div>
    </div>
  )
}
