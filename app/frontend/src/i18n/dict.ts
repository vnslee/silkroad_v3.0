// 경량 i18n(C12) — 외부 라이브러리 없이 store(lang) 구독 t() 헬퍼.
// UI 텍스트(헤더·메뉴·범례·지도·챗봇 등) 한/영 사전. 원본 리포트/상세 콘텐츠는
// 백엔드 데이터라 여기서 다루지 않는다(국가·권역명은 데이터의 name/name_ko 사용).
import { useStore } from '../store'
import type { Lang } from '../store'

type Dict = Record<string, { ko: string; en: string }>

export const DICT: Dict = {
  // 헤더 / 내비
  'nav.map': { ko: '지도', en: 'Map' },
  'nav.country': { ko: '국가 분석', en: 'Country' },
  'nav.region': { ko: '권역 분석', en: 'Region' },
  'nav.report': { ko: '보고서', en: 'Reports' },
  'nav.ruleset': { ko: '룰셋', en: 'Ruleset' },
  'nav.toHome': { ko: '메인 지도로 이동', en: 'Go to map' },
  'menu.countryTitle': { ko: '', en: '' },
  'menu.regionTitle': { ko: '', en: '' },
  'menu.reportTitle': { ko: '', en: '' },
  'menu.countryReport': { ko: '국가 진단 보고서', en: 'Country report' },
  'menu.regionReport': { ko: '권역 진단 보고서', en: 'Region report' },
  'search.placeholder': { ko: '국가 검색…', en: 'Search country…' },
  'search.aria': { ko: '국가 검색', en: 'Search country' },
  'chat.aria': { ko: 'AISea 어시스턴트', en: 'AISea assistant' },

  // 챗봇(ChatWidget)
  'chat.fab': { ko: 'AISea에게 물어보기', en: 'Ask AISea' },
  'chat.openAria': { ko: 'AISea 어시스턴트 열기', en: 'Open AISea assistant' },
  'chat.title': { ko: 'AISea 어시스턴트', en: 'AISea assistant' },
  'chat.online': { ko: '진단 엔진 온라인', en: 'Diagnostic engine online' },
  'chat.close': { ko: '챗봇 닫기', en: 'Close chat' },
  'chat.inputAria': { ko: '질문 입력', en: 'Type your question' },
  'chat.inputPlaceholder': { ko: '진출 시장에 대해 물어보세요…', en: 'Ask about a target market…' },
  'chat.send': { ko: '전송', en: 'Send' },
  'chat.disclaimer': {
    ko: 'AI 응답에는 부정확한 내용이 있을 수 있어요. 중요한 정보는 확인해 주세요.',
    en: 'AI responses may be inaccurate. Please verify important information.',
  },
  'chat.greeting': {
    ko: '안녕하세요 👋 AISea 진단 어시스턴트예요.\n진출을 검토 중인 국가나 권역을 말씀해 주시면 리스크 진단을 도와드릴게요.',
    en: "Hi 👋 I'm AISea, your diagnostic assistant.\nTell me a country or region you're considering and I'll help assess the risks.",
  },
  'chat.quick.spain': { ko: '스페인 시장 진단 보고서 만들어줘', en: 'Create a Spain market diagnostic report' },
  'chat.quick.euQuickwin': { ko: '유럽 권역 내 Quick-win 가능 국가 분석', en: 'Analyze Quick-win candidates in Europe' },
  'chat.research.yes': { ko: '예, 리서치 진행', en: 'Yes, run research' },
  'chat.research.no': { ko: '아니오', en: 'No' },
  'chat.research.fallbackPrompt': {
    ko: '보유 정보가 없습니다. 리서치를 진행할까요?',
    en: 'No data on hand. Shall I run research?',
  },
  'chat.research.started': {
    ko: '리서치를 시작했습니다. 잠시만 기다려 주세요…',
    en: 'Research started. Please hold on…',
  },
  'chat.research.done': {
    ko: '리서치가 완료되었습니다. 다시 질문해 주시면 데이터를 바탕으로 답변드릴게요.',
    en: 'Research complete. Ask again and I’ll answer from the new data.',
  },
  'chat.research.error': { ko: '리서치 중 오류가 발생했습니다: ', en: 'Research error: ' },
  'chat.research.triggerError': { ko: '리서치 트리거 실패: ', en: 'Failed to trigger research: ' },
  'chat.error': { ko: '오류가 발생했습니다: ', en: 'An error occurred: ' },
  'chat.jobLabel': { ko: ' 리서치', en: ' research' },
  'chat.reportLabel': { ko: ' 보고서', en: ' report' },
  // 거절(아니오) 후 안내 — 보유국 한정.
  'chat.research.declined': {
    ko: '알겠습니다. 보유 중인 국가 정보에 한해서만 답변드릴 수 있어요. 다른 국가를 물어봐 주세요.',
    en: 'Understood. I can only answer about countries already on hand. Please ask about another country.',
  },
  // 권역 신규 리서치 차단(정책) — 백엔드 403과 동일 취지.
  'chat.research.regionBlocked': {
    ko: '권역 단위 신규 리서치는 현재 지원하지 않습니다. 권역 내 개별 국가의 리서치를 도와드릴 수 있어요.',
    en: 'Region-level new research is not supported. I can help research individual countries within a region.',
  },
  // 보고서 흐름
  'chat.report.started': {
    ko: '보고서 생성을 시작했습니다. 진행 상황은 상단에 표시됩니다…',
    en: 'Report generation started. Progress shows at the top…',
  },
  'chat.report.done': { ko: '보고서 생성이 완료되었습니다.', en: 'Report generation complete.' },
  'chat.report.doneShare': {
    ko: '보고서 생성이 완료되었습니다 ({id}). 메일로 공유하시겠어요?',
    en: 'Report generated ({id}). Share by email?',
  },
  'chat.report.error': { ko: '보고서 생성 중 오류가 발생했습니다: ', en: 'Report error: ' },
  'chat.report.triggerError': { ko: '보고서 생성 트리거 실패: ', en: 'Failed to trigger report: ' },
  'chat.research.startedTop': {
    ko: '리서치를 시작했습니다. 진행 상황은 상단에 표시됩니다…',
    en: 'Research started. Progress shows at the top…',
  },
  // 액션 칩 라벨
  'chat.action.summary': { ko: '국가 상세 정보 요약하기', en: 'Summarize country detail' },
  'chat.action.research': { ko: '리서치 수행', en: 'Run research' },
  'chat.action.re_research': { ko: '리서치 재수행', en: 'Re-run research' },
  'chat.action.report': { ko: '보고서 생성', en: 'Generate report' },
  'chat.action.re_report': { ko: '보고서 재생성', en: 'Regenerate report' },
  // 상세/요약 분기
  'chat.summary.ask': {
    ko: '{id} 정보를 상세 화면에서 보시겠어요, 아니면 요약으로 받으시겠어요?',
    en: 'View {id} in the detail screen, or get a summary here?',
  },
  'chat.summary.openDetail': { ko: '상세 화면 열기', en: 'Open detail view' },
  'chat.summary.getSummary': { ko: '요약으로 받기', en: 'Get summary' },
  'chat.summary.request': { ko: '{id} 핵심 지표를 요약해줘', en: 'Summarize key metrics for {id}' },

  // 관점 선택(senario.md — 비즈니스/시스템/Both)
  'chat.perspective.ask': {
    ko: '어떤 관점으로 설명해 드릴까요?',
    en: 'Which perspective would you like?',
  },
  'chat.perspective.business': { ko: '비즈니스', en: 'Business' },
  'chat.perspective.system': { ko: '시스템', en: 'System' },
  'chat.perspective.both': { ko: '둘 다', en: 'Both' },

  // 초기 선택지(senario.md Case1/2/3)
  'chat.case.addCountry': { ko: '새로운 국가 추가하기', en: 'Add a new country' },
  'chat.case.explore': { ko: '진출 검토 국가·권역 조사', en: 'Explore a target country/region' },
  'chat.case.ask': { ko: '데이터 기반 질문하기', en: 'Ask a data-driven question' },
  'chat.case.addCountry.prompt': {
    ko: '새로운 국가를 추가하고 싶어요. 어떤 국가를 리서치할까요?',
    en: 'I want to add a new country. Which country should I research?',
  },
  'chat.case.explore.prompt': {
    ko: '진출을 검토 중인 국가나 권역을 조사하고 싶어요.',
    en: 'I want to explore a country or region we are considering.',
  },
  'chat.case.ask.prompt': {
    ko: '보유한 데이터를 기반으로 궁금한 점을 물어보고 싶어요.',
    en: 'I want to ask a question based on the data on hand.',
  },

  // 화면 액션 버튼(상세/보고서 우측 상단)
  'action.simulation': { ko: '보고서 생성', en: 'Generate report' },
  'action.report': { ko: '보고서', en: 'Report' },
  'action.pdf': { ko: 'PDF', en: 'PDF' },
  'action.sendMail': { ko: '메일 발송', en: 'Send mail' },

  // 상태 배지
  'badge.baseline': { ko: '기준국', en: 'Baseline' },
  'badge.entered': { ko: '진출', en: 'Active' },
  'badge.planned': { ko: '예정', en: 'Planned' },

  // 범례 / 지도
  'legend.title': { ko: '진출 현황', en: 'Market status' },
  'legend.established': { ko: '기진출', en: 'Active markets' },
  'legend.candidate': { ko: '진출 후보', en: 'Candidate markets' },
  'legend.operating': { ko: '운영중', en: 'Operating' },
  'legend.notEntered': { ko: '진출 예정국', en: 'Planned markets' },
  'legend.hyundai': { ko: '현대차 사업망', en: 'Hyundai network' },
  'legend.none': { ko: '대상 외', en: 'Out of scope' },
  'map.aria': { ko: '세계 지도', en: 'World map' },
  'map.zoomIn': { ko: '확대', en: 'Zoom in' },
  'map.zoomOut': { ko: '축소', en: 'Zoom out' },
  'map.bannerLead': { ko: '진출 후보 시장을 지도에서 선택하거나', en: 'Pick a candidate market on the map, or' },
  'map.bannerAsk': { ko: 'AISea에게 물어보세요 →', en: 'ask AISea →' },
  'map.regionPrefix': { ko: '권역', en: 'Region' },

  // 권역명(지도 hover/툴팁)
  'region.na': { ko: '북아메리카', en: 'North America' },
  'region.sa': { ko: '남아메리카', en: 'South America' },
  'region.eu': { ko: '유럽', en: 'Europe' },
  'region.me': { ko: '중동', en: 'Middle East' },
  'region.ap': { ko: '아시아·태평양', en: 'Asia-Pacific' },
  'region.af': { ko: '아프리카', en: 'Africa' },
}

export function translate(key: string, lang: Lang): string {
  const e = DICT[key]
  if (!e) return key
  return e[lang] ?? e.ko
}

/** 컴포넌트용 — lang store 구독 t(). */
export function useT() {
  const lang = useStore((s) => s.lang)
  return (key: string) => translate(key, lang)
}
