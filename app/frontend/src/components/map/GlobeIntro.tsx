// GlobeIntro(C4, FR-2.1) — three.js 밤의 지구 + 다이브 인트로(silk-road v1.0 이식).
// 밤의 지구본 등장·자전 → 카메라 다이브인 → 평면 펼침 → onDone(이후 MapView로 연결).
// reduced-motion/딥링크 시 즉시 완료(AR-1). 엔진은 nightGlobe.js(vanilla)를 마운트만.
import { useEffect, useRef } from 'react'
// @ts-expect-error — vanilla JS 엔진(타입 없음). vite 가 트랜스파일.
import { createGlobe } from './nightGlobe'
import './nightGlobe.css'

interface Props {
  reducedMotion: boolean
  onDone: () => void
}

export function GlobeIntro({ reducedMotion, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let done = false
    const finish = () => {
      if (done) return
      done = true
      onDone()
    }
    const api = createGlobe({
      canvas: canvasRef.current,
      svg: svgRef.current,
      stage: stageRef.current,
      reducedMotion,
      onIntroDone: finish,
    })
    if (reducedMotion) api.skipIntro()
    else api.runIntro()
    // 안전장치: 콜백 누락 대비 강제 완료.
    const guard = window.setTimeout(finish, 6000)
    return () => {
      window.clearTimeout(guard)
      api.destroy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div ref={stageRef} className="map-stage" style={{ position: 'fixed', inset: 0 }}>
      <canvas ref={canvasRef} id="globe-canvas" />
      <svg ref={svgRef} id="flat-map" />
      <div className="intro-overlay" aria-hidden="true">
        <div className="intro-logo visible">
          <div className="logo-eyebrow">Internal Analytics</div>
          <div className="logo-title">
            Where Should We
            <br />
            Expand <em>Next?</em>
          </div>
          <div className="logo-tagline">Global Auto Finance Market Diagnostics</div>
        </div>
      </div>
    </div>
  )
}
