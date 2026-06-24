// DetailView(C6, FR-4, L8) — 상세 React 컴포넌트 렌더링 (iframe 제거).
// 헤더: 국기 + [국가/권역 선택 드롭다운] + 상태배지 + [데이터 버전 드롭다운] + 시뮬레이션·보고서.
// 본문은 React 컴포넌트로 직접 렌더링 (CountryDetail / RegionDetail).
import { useEffect, useState } from 'react'
import { api } from '../../api/client'
import { paths } from '../../api/paths'
import type { CountrySummary, Domain, RegionSummary } from '../../api/types'
import { useJobPolling } from '../../hooks/useJobPolling'
import { store } from '../../store'
import { Icon } from '../common/Icon'
import { HeaderSelect, type SelectOption } from '../common/HeaderSelect'
import { HeaderEmblem } from '../common/HeaderEmblem'
import { MicroExpander } from '../ui/micro-expander'
import { useT } from '../../i18n/dict'
import type { EntryMode } from '../../app/route'
import { CountryDetail } from '../details/CountryDetail'
import { RegionDetail } from '../details/RegionDetail'
import type { CountryDetailData, RegionDetailData, RegionReportData } from '../reports/types'
import { buildRegionDetail, type RegionResearchSnapshot } from '../../utils/regionDetail'

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
  // 진출형태(internal country_assets 보유 여부) — 값이 있으면 기진출국.
  entryMode?: string
}

export default function DetailView({ domain, code, mode }: Props) {
  const [ready, setReady] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [versions, setVersions] = useState<string[]>([])
  const [version, setVersion] = useState<string | undefined>(undefined) // undefined = latest
  const [simulating, setSimulating] = useState(false)
  const [detailData, setDetailData] = useState<CountryDetailData | RegionDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const t = useT()

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
    setJobId(null)

    api
      .getDetailVersions(domain, code)
      .then((v) => !cancelled && setVersions(v))
      .catch(() => !cancelled && setVersions([]))

    api
      .getExistence(domain, code)
      .then((info) => {
        if (cancelled) return
        if (!info.exists) {
          setError('리서치 데이터가 없습니다. 챗봇에서 리서치를 진행하세요.')
          return
        }
        if (info.has_detail) {
          setReady(true)
        } else {
          api
            .triggerDetail(domain, code)
            .then((job) => !cancelled && setJobId(job.job_id))
            .catch((e) => !cancelled && setError(String(e)))
        }
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [domain, code])

  useJobPolling(jobId, {
    onDone: () => {
      store.removeJob(jobId ?? '')
      setReady(true)
    },
    onError: (msg) => setError(msg),
  })

  // 상세 JSON 데이터 로드
  useEffect(() => {
    if (!ready) {
      setDetailData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    // 리서치 스냅샷 JSON (detail 경로) — country는 그대로, region은 병합 입력으로 사용.
    const detailPath = paths.detail(domain, code, version)
    const fetchSnapshot = fetch(detailPath).then((res) => {
      if (!res.ok) throw new Error(`Failed to load detail: ${res.statusText}`)
      return res.json()
    })

    if (domain === 'country') {
      fetchSnapshot
        .then((data) => {
          if (cancelled) return
          setDetailData(data)
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
    label: c.nameKo ? `${c.nameKo} (${c.name})` : c.name,
    sub: c.code,
  }))
  // 버전 옵션(최신 + 렌더본 ID들). value/label 모두 렌더 ID(DTL_<ID>_NNN).
  const versionOptions: SelectOption[] = [
    { value: '', label: '최신 (latest)', sub: '기본' },
    ...versions.map((v) => ({ value: v, label: v, sub: '렌더본' })),
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
          label: `${meta?.name ?? code} 보고서 생성`,
        })
      })
      .catch((e) => setError(`보고서 생성 트리거 실패: ${String(e)}`))
      .finally(() => setSimulating(false))
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 헤더 chrome */}
      <div className="flex shrink-0 items-start justify-between gap-md border-b border-surface-border p-lg pr-16">
        <div className="flex items-center gap-md">
          <HeaderEmblem domain={domain} code={code} name={meta?.name} />
          <div>
            <div className="flex items-baseline gap-sm">
              {/* 국가/권역 선택 드롭다운 */}
              <HeaderSelect
                ariaLabel={isCountry ? '국가 선택' : '권역 선택'}
                options={targetOptions}
                value={code}
                onChange={goTarget}
                trigger={
                  <span className="flex items-baseline gap-sm">
                    <span className="font-headline-lg text-headline-lg text-primary">{meta?.name ?? code}</span>
                    {meta?.nameKo && (
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
                  {status}
                </span>
              )}
              <span className="font-label-sm text-label-sm text-outline">
                {isCountry ? `Region: ${meta?.region ?? '-'}` : '권역'}
              </span>
              {/* 데이터 버전 선택 */}
              <span className="font-label-sm text-label-sm text-outline">·</span>
              <HeaderSelect
                ariaLabel="데이터 버전 선택"
                options={versionOptions}
                value={version ?? ''}
                onChange={(v) => setVersion(v || undefined)}
                trigger={
                  <span className="flex items-center gap-xs font-label-sm text-label-sm text-secondary">
                    <Icon name="history" className="text-[14px]" />
                    {version ?? '최신'}
                  </span>
                }
              />
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
            상세화면을 준비 중입니다…
          </div>
        )}
        {!error && ready && loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">데이터를 불러오는 중...</p>
          </div>
        )}
        {!error && ready && !loading && detailData && (
          <>
            {domain === 'country' && <CountryDetail data={detailData as CountryDetailData} />}
            {domain === 'region' && <RegionDetail data={detailData as RegionDetailData} />}
          </>
        )}
      </div>
    </div>
  )
}
