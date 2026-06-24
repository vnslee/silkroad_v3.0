// RulesetForm(C8, FR-6) — internal_latest.json의 실제 가중치/계수를 조회·편집·저장.
// 보고서 생성 엔진이 읽는 값(values·similarity_item_weights·tier_weights·decision_thresholds)을
// GET /api/ruleset 로 불러와 편집 후 PUT 으로 저장한다. 상단 드롭다운으로 과거 버전 스냅샷 로드 가능.
//
// UI: 수치 직접입력 대신 슬라이더 + 비례 바 시각화. 합=100% 그룹은 그룹 상단에
// 스택 바로 구성 비율을 보여주고 [정규화] 버튼으로 100%에 자동 보정한다.
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../api/client'
import { ApiError } from '../../api/client'
import type { RulesetPayload, RulesetSaveResult, RulesetVersionInfo } from '../../api/types'
import { clamp, isSumOne, sumWeights } from './validation'
import { SaveSuccessModal } from './SaveSuccessModal'
import { Icon } from '../common/Icon'

// 계수/임계 키 → 한글 라벨(없으면 키 그대로). 화면 가독성용.
const LABELS: Record<string, string> = {
  // report_blend
  w_biz: '사업매력도 비중',
  w_it: 'IT 준비도 비중',
  // decision_thresholds
  expansion_min_score: '확산 임계 (≥ → B시스템 확산)',
  hq_build_min_score: '본사 구축 임계 (≥ → 자체구축)',
  // tier_weights
  tier1: 'Tier 1 · 최상위 출처',
  tier2: 'Tier 2 · 신뢰 출처',
  tier3: 'Tier 3 · 일반 출처',
  tier4: 'Tier 4 · 보조 출처',
}

const lbl = (k: string) => LABELS[k] ?? k

// 스택 바·바 채움색 — AISea 팔레트(잉크블랙 + 지역색 패밀리).
const PALETTE = ['#14181C', '#2f6be0', '#34D399', '#FBBF24', '#FB7185', '#3a4048', '#92b4ff']

// 합이 1.0이어야 하는 가중치 그룹
const SUM_ONE_GROUPS = new Set([
  'biz_attractiveness',
  'it_readiness',
  'report_blend',
  'similarity_item_weights',
])

type WeightKey =
  | 'biz_attractiveness'
  | 'it_readiness'
  | 'report_blend'
  | 'similarity_item_weights'
  | 'tier_weights'
  | 'decision_thresholds'

export default function RulesetForm() {
  const [data, setData] = useState<RulesetPayload | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // 저장 성공 시 결과(버전·스냅샷 파일) → 팝업 표시. null이면 팝업 닫힘.
  const [saveResult, setSaveResult] = useState<RulesetSaveResult | null>(null)
  // 버전 드롭다운 목록 + 현재 화면에 로드된 버전
  const [versions, setVersions] = useState<RulesetVersionInfo[]>([])
  const [selectedVersion, setSelectedVersion] = useState<string>('')

  // 버전 목록 새로고침(초기·저장 후). 실패/비배열 응답이어도 본 폼은 동작하므로 빈 목록으로.
  const refreshVersions = () =>
    api
      .getRulesetVersions()
      .then((list) => setVersions(Array.isArray(list) ? list : []))
      .catch(() => undefined)

  useEffect(() => {
    let alive = true
    api
      .getRuleset()
      .then((d) => {
        if (!alive) return
        setData(d)
        setSelectedVersion(d.version ?? '')
      })
      .catch((e) =>
        alive && setLoadError(e instanceof ApiError ? e.message : '룰셋을 불러오지 못했습니다.'),
      )
    refreshVersions()
    return () => {
      alive = false
    }
  }, [])

  const setField = (group: WeightKey, key: string, value: number) => {
    setData((d) => (d ? { ...d, [group]: { ...d[group], [key]: value } } : d))
  }

  // 그룹 전체 교체(정규화 버튼용).
  const setGroup = (group: WeightKey, next: Record<string, number>) => {
    setData((d) => (d ? { ...d, [group]: next } : d))
  }

  // 드롭다운에서 버전 선택 → 해당 버전 값 로드(latest는 plain GET, 그 외는 버전별 GET).
  const onSelectVersion = async (version: string) => {
    if (!version || version === selectedVersion) return
    setSaveError(null)
    const info = versions.find((v) => v.version === version)
    try {
      const loaded = info?.is_latest
        ? await api.getRuleset()
        : await api.getRulesetVersion(version)
      setData(loaded)
      setSelectedVersion(version)
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : `버전 v${version}을 불러오지 못했습니다.`)
    }
  }

  // 합=1.0 그룹들의 검증 상태(저장 가능 판정)
  const invalidGroups = useMemo(() => {
    if (!data) return []
    const bad: WeightKey[] = []
    for (const g of SUM_ONE_GROUPS) {
      const group = data[g as WeightKey] as Record<string, number>
      if (group && Object.keys(group).length && !isSumOne(group)) bad.push(g as WeightKey)
    }
    return bad
  }, [data])

  const canSave = !!data && invalidGroups.length === 0 && !saving
  // 최신 버전을 보고 있는지(드롭다운 안내 배지용). 목록이 비면 최신으로 간주.
  const isViewingLatest =
    versions.length === 0 || versions.some((v) => v.is_latest && v.version === selectedVersion)

  const onSave = async () => {
    if (!data) return
    setSaving(true)
    setSaveError(null)
    try {
      const out = await api.saveRuleset(data)
      setData(out.ruleset)
      setSaveResult(out)
      setSelectedVersion(out.version)
      await refreshVersions() // 새 버전 스냅샷을 드롭다운에 반영
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : '저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-4xl p-lg">
        <h2 className="mb-md text-headline-lg text-on-surface">룰셋 설정</h2>
        <p className="rounded-md bg-error-container px-md py-sm text-body-md text-on-error-container">
          {loadError}
        </p>
      </div>
    )
  }
  if (!data) {
    return (
      <div className="flex items-center gap-sm p-xl text-on-surface-variant">
        <Icon name="progress_activity" className="animate-spin text-[20px]" />
        룰셋을 불러오는 중…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl p-lg">
      {/* 스티키 헤더 — 제목 + 버전 선택 + 저장 */}
      <div className="sticky top-0 z-10 -mx-lg mb-lg flex flex-wrap items-center justify-between gap-md border-b border-surface-border bg-surface-container-low/95 px-lg py-md backdrop-blur">
        <div className="flex items-center gap-md">
          <span className="flex h-11 w-11 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon name="tune" className="text-[24px]" />
          </span>
          <div>
            <h2 className="text-headline-md font-bold text-on-surface">룰셋 설정</h2>
            <p className="text-body-sm text-on-surface-variant">보고서 생성에 쓰이는 가중치·계수</p>
          </div>
        </div>
        <div className="flex items-center gap-md">
          <label className="flex items-center gap-sm text-body-sm text-on-surface-variant">
            <Icon name="history" className="text-[18px]" />
            <select
              className="rounded-md border border-surface-border bg-surface-container-lowest px-sm py-xs text-body-md text-on-surface focus:border-primary focus:outline-none"
              value={selectedVersion}
              onChange={(e) => onSelectVersion(e.target.value)}
              aria-label="룰셋 버전 선택"
            >
              {/* 현재 로드된 버전이 목록에 없을 수도 있어 안전하게 옵션 보강 */}
              {!versions.some((v) => v.version === selectedVersion) && selectedVersion && (
                <option value={selectedVersion}>v{selectedVersion}</option>
              )}
              {versions.map((v) => (
                <option key={v.file} value={v.version}>
                  v{v.version}
                  {v.is_latest ? ' (최신)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            className="flex items-center gap-xs rounded-md bg-primary px-lg py-sm font-semibold text-on-primary shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!canSave}
            onClick={onSave}
          >
            <Icon name={saving ? 'progress_activity' : 'save'} className={`text-[18px] ${saving ? 'animate-spin' : ''}`} />
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>

      {invalidGroups.length > 0 && (
        <p className="mb-md flex items-center gap-sm rounded-md bg-error-container px-md py-sm text-body-sm text-on-error-container">
          <Icon name="error" className="text-[18px]" />
          합이 100%가 아닌 가중치 그룹이 있어 저장할 수 없습니다. 각 그룹의 <strong>정규화</strong> 버튼으로 맞출 수 있습니다.
        </p>
      )}

      {!isViewingLatest && (
        <p className="mb-md flex items-center gap-sm rounded-md bg-secondary-fixed px-md py-sm text-body-sm text-on-secondary-container">
          <Icon name="info" className="text-[18px]" />
          과거 버전 <strong>v{selectedVersion}</strong>을 보고 있습니다. 저장하면 새 버전으로 기록됩니다.
        </p>
      )}

      {/* 2단: 좌=점수 가중치(합 100%) / 우=임계값·계수. 좁은 화면은 1단으로 떨어진다. */}
      <div className="grid grid-cols-1 gap-lg lg:grid-cols-2">
        {/* 좌열 — ① 점수 가중치 */}
        <section className="flex flex-col gap-lg">
          <SectionLabel
            no="①"
            title="점수 가중치"
            desc="각 그룹의 합이 100%(1.0)가 되어야 저장할 수 있습니다."
          />
          <WeightGroup
            title="사업매력도 항목 가중치"
            hint="매력도 점수 산식 항목 비중 (values.biz_attractiveness)"
            group="biz_attractiveness"
            values={data.biz_attractiveness}
            sumOne
            onChange={setField}
            onReplace={setGroup}
          />
          <WeightGroup
            title="IT 준비도 항목 가중치"
            hint="IT 준비도 점수 산식 항목 비중 (values.it_readiness)"
            group="it_readiness"
            values={data.it_readiness}
            sumOne
            onChange={setField}
            onReplace={setGroup}
          />
          <WeightGroup
            title="보고서 종합 점수 혼합비"
            hint="매력도 ↔ IT 종합 점수 가중 (values.report_blend)"
            group="report_blend"
            values={data.report_blend}
            sumOne
            onChange={setField}
            onReplace={setGroup}
          />
          <WeightGroup
            title="유사도 항목 가중치"
            hint="종합 유사도 산정 항목 비중 (similarity_item_weights)"
            group="similarity_item_weights"
            values={data.similarity_item_weights}
            axes={data.similarity_item_axes}
            sumOne
            onChange={setField}
            onReplace={setGroup}
          />
        </section>

        {/* 우열 — ② 임계값·계수 */}
        <section className="flex flex-col gap-lg">
          <SectionLabel no="②" title="임계값·계수" desc="출처 신뢰 배수와 시스템 전략 분기 기준값." />
          <WeightGroup
            title="출처 신뢰 계수 (Tier)"
            hint="출처 신뢰도별 점수 가중 배수 (0~1.0). Tier 1은 1.0 고정 권장"
            group="tier_weights"
            values={data.tier_weights}
            min={0}
            max={1}
            step={0.05}
            unit="x"
            onChange={setField}
            onReplace={setGroup}
          />
          <WeightGroup
            title="시스템 결정 임계값"
            hint="유사도 기반 시스템 전략 분기 (0~100점)"
            group="decision_thresholds"
            values={data.decision_thresholds}
            min={0}
            max={100}
            step={1}
            unit="pt"
            onChange={setField}
            onReplace={setGroup}
            hideKeys={['apac_internalization_min_score']}
          />
        </section>
      </div>

      {saveError && (
        <p className="mt-lg flex items-center gap-sm rounded-md bg-error-container px-md py-sm text-body-sm text-on-error-container">
          <Icon name="error" className="text-[18px]" />
          {saveError}
        </p>
      )}

      {saveResult && <SaveSuccessModal result={saveResult} onClose={() => setSaveResult(null)} />}
    </div>
  )
}

// ── 섹션 헤더 ────────────────────────────────────────────────────
function SectionLabel({ no, title, desc }: { no: string; title: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-sm">
      <span className="text-headline-md font-bold text-primary">{no}</span>
      <div>
        <h3 className="text-body-lg font-semibold text-on-surface">{title}</h3>
        <p className="text-body-sm text-on-surface-variant">{desc}</p>
      </div>
    </div>
  )
}

// ── 가중치/계수 그룹 카드 ─────────────────────────────────────────
function WeightGroup({
  title,
  hint,
  group,
  values,
  axes,
  sumOne = false,
  min = 0,
  max = 1,
  step = 0.01,
  unit,
  onChange,
  onReplace,
  hideKeys,
}: {
  title: string
  hint?: string
  group: WeightKey
  values: Record<string, number>
  axes?: Record<string, string>
  sumOne?: boolean
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (group: WeightKey, key: string, value: number) => void
  onReplace: (group: WeightKey, next: Record<string, number>) => void
  /** 화면에서 숨길 키(엔진 미사용 등) — 데이터엔 남기고 표시만 제외. */
  hideKeys?: string[]
}) {
  const keys = Object.keys(values).filter((k) => !hideKeys?.includes(k))
  if (keys.length === 0) return null

  const total = sumWeights(values)
  const valid = !sumOne || isSumOne(values)
  const pct = (v: number) => `${(Math.round(v * 1000) / 10).toFixed(1)}%`

  // 합=1.0 그룹 정규화 — 각 값을 합으로 나눠 100%에 맞춤. 합 0이면 균등 분배.
  const normalize = () => {
    const next: Record<string, number> = {}
    if (total <= 0) {
      const even = 1 / keys.length
      keys.forEach((k) => (next[k] = Math.round(even * 1000) / 1000))
    } else {
      keys.forEach((k) => (next[k] = Math.round((values[k] / total) * 1000) / 1000))
    }
    onReplace(group, next)
  }

  return (
    <fieldset className="rounded-lg border border-surface-border bg-surface-container-lowest p-md shadow-sm">
      <div className="mb-sm flex items-start justify-between gap-md">
        <div>
          <legend className="text-body-md font-semibold text-on-surface">{title}</legend>
          {hint && <p className="mt-0.5 text-body-sm text-on-surface-variant">{hint}</p>}
        </div>
        {sumOne && (
          <div className="flex shrink-0 items-center gap-sm">
            <span
              className={`flex items-center gap-xs rounded-full px-sm py-xs text-label-md font-semibold ${
                valid
                  ? 'bg-tertiary-container text-on-tertiary-container'
                  : 'bg-error-container text-on-error-container'
              }`}
            >
              <Icon name={valid ? 'check_circle' : 'error'} className="text-[16px]" />
              합 {pct(total)}
            </span>
            <button
              type="button"
              onClick={normalize}
              disabled={valid}
              className="flex items-center gap-xs rounded-full border border-surface-border px-sm py-xs text-label-md text-on-surface-variant transition hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-40"
              title="합이 100%가 되도록 비율을 자동 보정합니다"
            >
              <Icon name="balance" className="text-[16px]" />
              정규화
            </button>
          </div>
        )}
      </div>

      {/* 합=1.0 그룹: 구성 비율 스택 바 */}
      {sumOne && total > 0 && (
        <div className="mb-md flex h-2.5 w-full overflow-hidden rounded-full bg-surface-container-high">
          {keys.map((k, i) => (
            <div
              key={k}
              className="h-full"
              style={{ width: `${(values[k] / total) * 100}%`, background: PALETTE[i % PALETTE.length] }}
              title={`${lbl(k)} · ${pct(values[k])}`}
            />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {keys.map((k, i) => (
          <WeightRow
            key={k}
            label={lbl(k)}
            sub={axes?.[k]}
            value={values[k]}
            color={sumOne ? PALETTE[i % PALETTE.length] : '#14181C'}
            min={min}
            max={max}
            step={step}
            percent={sumOne}
            unit={unit}
            onChange={(v) => onChange(group, k, clamp(v, min, max))}
            ariaLabel={`${title} ${lbl(k)}`}
          />
        ))}
      </div>
    </fieldset>
  )
}

// ── 단일 항목 행: 라벨 + 슬라이더(바) + 인라인 수치 ──────────────────
function WeightRow({
  label,
  sub,
  value,
  color,
  min,
  max,
  step,
  percent,
  unit,
  onChange,
  ariaLabel,
}: {
  label: string
  sub?: string
  value: number
  color: string
  min: number
  max: number
  step: number
  percent: boolean
  unit?: string
  onChange: (value: number) => void
  ariaLabel: string
}) {
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0

  // 인라인 편집값 — percent 그룹은 %(0~100), 그 외는 원단위.
  const display = percent ? Math.round(value * 1000) / 10 : value
  const onInput = (raw: number) => {
    if (!Number.isFinite(raw)) return
    onChange(percent ? raw / 100 : raw)
  }

  return (
    <div className="flex items-center gap-md">
      {/* 라벨 */}
      <div className="w-44 shrink-0">
        <span className="block truncate text-body-sm text-on-surface" title={label}>
          {label}
        </span>
        {sub && (
          <span className="block truncate text-label-sm text-on-surface-variant" title={sub}>
            {sub}
          </span>
        )}
      </div>

      {/* 슬라이더 = 바 트랙 + 채움 + 썸 + 보이지 않는 native range(접근성·드래그) */}
      <div className="relative h-4 flex-1">
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-surface-container-high" />
        <div
          className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full"
          style={{ width: `${fillPct}%`, background: color }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface-container-lowest shadow"
          style={{ left: `${fillPct}%`, background: color }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={ariaLabel}
        />
      </div>

      {/* 인라인 수치 편집 */}
      <div className="flex w-24 shrink-0 items-center justify-end gap-xs">
        <input
          type="number"
          min={percent ? 0 : min}
          max={percent ? 100 : max}
          step={percent ? 0.1 : step}
          value={percent ? display : Math.round(value * 100) / 100}
          onChange={(e) => onInput(Number(e.target.value))}
          className="w-14 rounded border border-surface-border bg-surface-container-lowest px-xs py-0.5 text-right text-body-sm tabular-nums text-on-surface focus:border-primary focus:outline-none"
          aria-label={`${ariaLabel} 값`}
        />
        <span className="w-6 text-left text-label-sm text-on-surface-variant">
          {percent ? '%' : unit ?? ''}
        </span>
      </div>
    </div>
  )
}
