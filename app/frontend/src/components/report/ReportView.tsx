// ReportView(C7, FR-5) — 보고서 React 컴포넌트 렌더링 (iframe 제거).
// 헤더: 국기 + [국가/권역 선택] + Report ID·생성일 + [보고서 버전 선택] + 이름 + PDF·메일.
// 본문은 React 컴포넌트로 직접 렌더링 (CountryReport / RegionReport).
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { api } from '../../api/client'
import { paths } from '../../api/paths'
import type { CountrySummary, Domain, RegionSummary, ReportRef } from '../../api/types'
import { buildMailtoUrl } from '../../utils/mailto'
import { Icon } from '../common/Icon'
import { HeaderSelect, type SelectOption } from '../common/HeaderSelect'
import { HeaderEmblem } from '../common/HeaderEmblem'
import { MicroExpander } from '../ui/micro-expander'
import { useT } from '../../i18n/dict'
import type { EntryMode } from '../../app/route'
import { CountryReport } from '../reports/CountryReport'
import { RegionReport } from '../reports/RegionReport'
import type { CountryReportData, RegionReportData } from '../reports/types'

interface Props {
  domain: Domain
  code: string
  reportId?: string
  mode: EntryMode
}

interface CatalogItem {
  code: string
  name: string
  nameKo?: string
  region?: string
  baseline?: string
  
  isBaseline: boolean
  hasReport: boolean
  entryMode?: string
}

export default function ReportView({ domain, code, reportId, mode }: Props) {
  const [reports, setReports] = useState<ReportRef[]>([])
  const [selected, setSelected] = useState<string | undefined>(reportId)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [reportData, setReportData] = useState<CountryReportData | RegionReportData | null>(null)
  const [loading, setLoading] = useState(false)
  // 인쇄 모드 — PDF 버튼을 누르면 모든 탭을 펼쳐 렌더한 뒤 브라우저 인쇄를 띄운다.
  const [printMode, setPrintMode] = useState(false)
  const t = useT()

  // PDF — 서버 변환(weasyprint) 대신 화면(React 보고서)을 브라우저 인쇄로 저장.
  //   ① printMode=true → 모든 탭을 펼친 보고서를 Portal로 body 직속(#print-root)에 렌더
  //   (조상 팝업의 fixed/overflow 제약이 없어 페이지 단위 분할이 깔끔) → ② 다음 페인트 후
  //   window.print() → ③ 인쇄 종료 시 원복. 화면과 동일하게 PDF 저장된다.
  useEffect(() => {
    if (!printMode) return
    const id = requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
    const after = () => setPrintMode(false)
    window.addEventListener('afterprint', after)
    return () => {
      cancelAnimationFrame(id)
      window.removeEventListener('afterprint', after)
    }
  }, [printMode])

  // #print-root 보장(없으면 생성) — Portal 대상.
  const getPrintRoot = () => {
    let el = document.getElementById('print-root')
    if (!el) {
      el = document.createElement('div')
      el.id = 'print-root'
      document.body.appendChild(el)
    }
    return el
  }

  const handlePrintPdf = () => setPrintMode(true)

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
            baseline: 'baseline_country' in x ? (x.baseline_country ?? undefined) : undefined,
            isBaseline: 'is_baseline' in x ? x.is_baseline : false,
            hasReport: x.has_report,
            entryMode: 'entry_mode' in x ? (x.entry_mode ?? undefined) : undefined,
          })),
        )
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [domain])

  // 보고서 목록(버전 선택용). 대상 변경 시 재로드.
  useEffect(() => {
    let cancelled = false
    setError(null)
    api
      .listReports(domain, code)
      .then((res) => {
        if (cancelled) return
        setReports(res.reports)
        // reportId 우선, 없으면 최신(목록 마지막) 자동 선택
        if (reportId) setSelected(reportId)
        else if (res.reports.length >= 1) setSelected(res.reports[res.reports.length - 1].report_id)
        else setSelected(undefined)
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [domain, code, reportId])

  // 보고서 JSON 데이터 로드
  useEffect(() => {
    if (!selected) {
      setReportData(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    // JSON 데이터를 직접 fetch
    const jsonPath = paths.reportJson(domain, code, selected)
    fetch(jsonPath)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load report: ${res.statusText}`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setReportData(data)
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
  }, [domain, code, selected])

  const current = reports.find((r) => r.report_id === selected)
  const meta = catalog.find((c) => c.code === code)
  const isCountry = domain === 'country'
  const name = meta?.name ?? code
  const title = isCountry ? `${name} 진출 진단 보고서` : `${name} 퀵윈 분석`

  // 진출여부 배지(참조 헤더의 미진출/진출/기준국 배지) — 진출형태(단독법인/JV)는 기진출국만 존재.
  const entered = isCountry ? !!meta?.entryMode : meta?.hasReport
  const status = meta?.isBaseline ? '기준국' : entered ? '진출' : '미진출'
  // 진출형태(단독법인/JV) — 진출 상태일 때만 배지 옆에 덧붙인다. 미진출은 숨김.
  const entryMode = isCountry && entered ? meta?.entryMode : undefined
  const statusIcon = meta?.isBaseline ? 'star' : entered ? 'check_circle' : 'explore'
  const statusStyle = meta?.isBaseline
    ? 'bg-secondary-fixed text-on-secondary-fixed-variant border-secondary-fixed-dim'
    : entered
      ? 'bg-success-container text-success border-success/30'
      : 'bg-surface-container text-text-secondary border-surface-border'

  // 생성일 — ISO 타임스탬프를 날짜+시:분(YYYY-MM-DD HH:MM)까지만 표시.
  const generatedLabel = (() => {
    const raw = current?.generated_at
    if (!raw) return undefined
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw.slice(0, 16).replace('T', ' ')
    const p = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  })()

  const targetOptions: SelectOption[] = catalog.map((c) => ({
    value: c.code,
    label: c.nameKo ? `${c.nameKo} (${c.name})` : c.name,
    sub: c.code,
  }))
  const versionOptions: SelectOption[] = reports.map((r) => ({
    value: r.report_id,
    label: r.report_id,
    sub: r.generated_at ?? undefined,
  }))

  const goTarget = (newCode: string) => {
    // 현재 진입 모드 유지 — 풀사이즈면 같은 페이지 내 교체.
    window.location.hash = `#/${domain}/${newCode}/report?mode=${mode}`
  }

  const onSendMail = () => {
    const url = buildMailtoUrl({
      domain,
      targetName: name,
      reportId: selected ?? '',
      createdAt: current?.generated_at ?? undefined,
      summary: current?.title ?? '진단 결과 요약',
      htmlUrl: paths.reportHtml(domain, code, selected ?? ''),
      pdfUrl: paths.reportPdf(domain, code, selected ?? ''),
    })
    window.location.href = url
  }

  if (error) return <p className="p-lg font-body-md text-on-error-container">{error}</p>

  if (!selected && reports.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-md p-lg text-center">
        <p className="font-body-md text-on-surface-variant">생성된 보고서가 없습니다.</p>
        <button
          className="rounded-lg bg-primary px-md py-sm font-label-md text-label-md text-on-primary"
          onClick={() => {
            api.createReport(domain, code)
            window.location.hash = `#/${domain}/${code}/detail?mode=${mode}`
          }}
        >
          보고서 생성하기
        </button>
      </div>
    )
  }

  if (!selected) {
    return <p className="p-lg font-body-md text-on-surface-variant">보고서를 불러오는 중…</p>
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 헤더 chrome */}
      <div className="flex shrink-0 items-start justify-between gap-gutter border-b border-surface-border p-lg pr-16">
        <div className="flex items-start gap-md">
          {/* 국기(국가) / 권역 엠블럼 — 참조 RPT_CTR_PL_003 헤더 형식 */}
          <HeaderEmblem domain={domain} code={code} name={name} />
          <div>
            {/* 제목(위) — 대상 선택 드롭다운 */}
            <HeaderSelect
              ariaLabel={isCountry ? '국가 선택' : '권역 선택'}
              options={targetOptions}
              value={code}
              onChange={goTarget}
              trigger={
                <h1 className="m-0 font-headline-lg text-headline-lg tracking-tight text-primary">{title}</h1>
              }
            />
            {/* 메타 행(아래) — Report ID(버전 선택) · 생성일 · 기준연도 · 상태배지 */}
            <div className="mt-xs flex flex-wrap items-center gap-sm">
              <span className="font-label-sm text-label-sm uppercase tracking-wider text-text-secondary">Report</span>
              <HeaderSelect
                ariaLabel="보고서 버전 선택"
                options={versionOptions}
                value={selected}
                onChange={setSelected}
                trigger={
                  <span className="flex items-center gap-xs font-label-sm text-label-sm font-semibold text-text-primary">
                    <Icon name="history" className="text-[14px]" />
                    {selected}
                  </span>
                }
              />
              {generatedLabel && (
                <>
                  <span className="h-1 w-1 rounded-full bg-surface-border" />
                  <span className="font-label-sm text-label-sm text-text-secondary">Generated: {generatedLabel}</span>
                </>
              )}
              {meta?.baseline && (
                <>
                  <span className="h-1 w-1 rounded-full bg-surface-border" />
                  <span className="font-label-sm text-label-sm text-text-secondary">기준국: {meta.baseline}</span>
                </>
              )}
              <span className="h-1 w-1 rounded-full bg-surface-border" />
              <span
                className={`inline-flex items-center gap-xs rounded-full border px-2 py-[2px] font-label-sm text-label-sm uppercase tracking-wide ${statusStyle}`}
              >
                <Icon name={statusIcon} className="text-[12px]" />
                {status}
              </span>
              {entryMode && (
                <span className="inline-flex items-center gap-xs rounded-full border border-secondary-fixed-dim bg-secondary-fixed px-2 py-[2px] font-label-sm text-label-sm uppercase tracking-wide text-on-secondary-fixed-variant">
                  <Icon name="apartment" className="text-[12px]" />
                  {entryMode}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <MicroExpander
            variant="outline"
            iconName="picture_as_pdf"
            text={t('action.pdf')}
            expanded
            onClick={handlePrintPdf}
          />
          <MicroExpander
            variant="default"
            iconName="forward_to_inbox"
            text={t('action.sendMail')}
            expanded
            onClick={onSendMail}
          />
        </div>
      </div>

      {/* 본문 — React 컴포넌트로 렌더링(화면용, 탭 전환 방식) */}
      <div className="flex-1 overflow-auto bg-surface">
        {loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-gray-500">보고서를 불러오는 중...</p>
          </div>
        )}
        {error && !loading && (
          <div className="flex h-full items-center justify-center">
            <p className="text-red-600">{error}</p>
          </div>
        )}
        {reportData && !loading && (
          <>
            {domain === 'country' && <CountryReport data={reportData as CountryReportData} />}
            {domain === 'region' && <RegionReport data={reportData as RegionReportData} />}
          </>
        )}
      </div>

      {/* 인쇄용 — 모든 탭을 펼친 보고서를 body 직속(#print-root)에 Portal로 렌더.
          화면엔 안 보이고(@media print에서만 표시), window.print() 시 이 영역만 PDF로 나간다. */}
      {printMode &&
        reportData &&
        createPortal(
          domain === 'country' ? (
            <CountryReport data={reportData as CountryReportData} printMode />
          ) : (
            <RegionReport data={reportData as RegionReportData} printMode />
          ),
          getPrintRoot(),
        )}
    </div>
  )
}
