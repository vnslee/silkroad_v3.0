// 차트 공통 타입 정의

export interface TimeseriesPoint {
  year: number
  value: number
}

export interface TimeseriesData {
  history: TimeseriesPoint[]
  forecast?: TimeseriesPoint[]
  cagr_hist?: number
  cagr_forecast?: number
  estimated?: boolean
}

export interface ChartDataItem {
  label: string
  value: number
  color?: string
}

export interface RadarChartData {
  label: string
  scores: number[]
  color: string
}

export interface RadarAxis {
  name: string
  max: number
}

/** 로즈(나이팅게일) 차트 항목 — 동일 각도 쐐기, 반지름이 value를 인코딩 */
export interface RoseChartDatum {
  label: string
  value: number
  /** 원본 표기(예: "약 20%") — 툴팁/범례 표시용 */
  display?: string
  color?: string
}
