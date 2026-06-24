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
