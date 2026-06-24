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

  // 후속 추천 질문(보유국 QA 답변과 함께 노출 — senario.md 틀 안)
  'chat.suggestions.aria': { ko: '추천 후속 질문', en: 'Suggested follow-up questions' },

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
    ko: '새로운 국가를 추가하고 싶어요.',
    en: 'I want to add a new country.',
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
  'legend.established': { ko: '기 진출', en: 'Active markets' },
  'legend.candidate': { ko: '진출 후보', en: 'Candidate markets' },
  'legend.operating': { ko: '운영중', en: 'Operating' },
  'legend.notEntered': { ko: '진출 예정', en: 'Planned markets' },
  'legend.hyundai': { ko: '현대차 사업망', en: 'Hyundai network' },
  'legend.none': { ko: '대상 외', en: 'Out of scope' },
  'map.aria': { ko: '세계 지도', en: 'World map' },
  'map.zoomIn': { ko: '확대', en: 'Zoom in' },
  'map.zoomOut': { ko: '축소', en: 'Zoom out' },
  'map.bannerLead': { ko: '진출 후보 시장을 지도에서 선택하거나', en: 'Pick a candidate market on the map, or' },
  'map.bannerAsk': { ko: 'AISea에게 물어보세요 →', en: 'ask AISea →' },
  'map.regionPrefix': { ko: '권역', en: 'Region' },

  // 권역명(지도 hover/툴팁)
  'region.na': { ko: '미주', en: 'Americas' },
  'region.eu': { ko: '유럽', en: 'Europe' },
  'region.me': { ko: '중동', en: 'Middle East' },
  'region.ap': { ko: '아시아·태평양', en: 'Asia-Pacific' },
  'region.af': { ko: '아프리카', en: 'Africa' },

  // ── 보고서 헤더 제목(ReportView) ──
  'report.title.country': { ko: '{name} 진출 진단 보고서', en: '{name} Market Entry Diagnostic' },
  'report.title.region': { ko: '{name} 퀵윈 분석', en: '{name} Quick-Win Analysis' },

  // ── 공유(shared.tsx) ──
  'report.captive': { ko: '캡티브', en: 'Captive' },
  'report.captive.title': { ko: '캡티브 금융사 보유 추정', en: 'Likely has a captive lender' },
  'report.insight': { ko: '인사이트', en: 'Insight' },
  'report.evidence': { ko: '근거', en: 'Source' },
  'report.evidenceInsight': { ko: '근거 · 인사이트', en: 'Source · Insight' },
  'report.source': { ko: '출처', en: 'Source' },
  'report.months': { ko: '개월', en: 'months' },
  'report.sub.noData': { ko: '구독료 구간 데이터가 없습니다.', en: 'No subscription tier data.' },
  'report.sub.cumCount': { ko: '누적건수', en: 'Cumulative volume' },
  'report.sub.unitPrice': { ko: '단가', en: 'Unit price' },
  'report.sub.existing': { ko: '기존 누적', en: 'Existing cumulative' },
  'report.sub.newAdded': { ko: '신규 추가', en: 'Newly added' },
  'report.sub.newCum': { ko: '신규 누적', en: 'New cumulative' },
  'report.sub.appliedPrice': { ko: '적용 단가', en: 'Applied unit price' },
  'report.sub.unit': { ko: '건', en: 'cases' },
  'report.ext.noData': { ko: '해당국 외부솔루션 후보 데이터가 없습니다.', en: 'No external solution candidate data for this country.' },
  'report.ext.lead': { ko: '권역 확산·본사 구축 기준 미달 → 현지 외부솔루션 도입을 검토합니다. 후보 벤더는 다음과 같습니다.', en: 'Below the regional-expansion and HQ-build thresholds → consider a local external solution. Candidate vendors are below.' },
  'report.ext.leadApac': { ko: '자체구축(내재화)과 함께 검토할 현지 외부솔루션 후보입니다. 자체구축 예상 비용은 TCO 탭을 참조하세요.', en: 'Local external solution candidates to weigh alongside in-house build. See the TCO tab for in-house build cost estimates.' },
  'report.ext.quote': { ko: '별도 견적', en: 'Quote on request' },
  'report.ext.solutionType': { ko: '솔루션 유형', en: 'Solution type' },
  'report.ext.vendorPattern': { ko: '벤더 패턴', en: 'Vendor pattern' },
  'report.ext.costNote': { ko: '* 도입 비용은 벤더별 견적에 따라 산정됩니다.', en: '* Implementation cost depends on each vendor’s quote.' },
  'report.hq.lead': { ko: '권역 확산 기준 미달, 외부솔루션 대비 적합 → 본사 자체구축을 권고합니다. 예상 규모는 다음과 같습니다.', en: 'Below the regional-expansion threshold but favorable vs. external solutions → HQ in-house build is recommended. Estimated scale below.' },
  'report.hq.leadApac': { ko: '유사도 충분 → 본사 내재화 구축을 권고합니다. 예상 규모는 다음과 같습니다.', en: 'Sufficient similarity → HQ in-house build is recommended. Estimated scale below.' },
  'report.hq.cost': { ko: '예상 구축비용', en: 'Estimated build cost' },
  'report.hq.months': { ko: '예상 구축기간', en: 'Estimated build period' },
  'report.hq.note': { ko: '* 본사 자체구축 기준 baseline 값(참고용).', en: '* HQ in-house build baseline values (for reference).' },
  'report.hq.noteApac': { ko: '* 내재화 기준 baseline 값(참고용).', en: '* In-house build baseline values (for reference).' },
  // 결정 트리 SVG
  'dt.regionBuild1': { ko: '권역 내 구축', en: 'In-region built' },
  'dt.regionBuild2': { ko: '시스템 존재?', en: 'system exists?' },
  'dt.noExternal': { ko: 'NO → 외부솔루션', en: 'NO → External' },
  'dt.similarity': { ko: '유사도', en: 'Similarity' },
  'dt.expansion': { ko: '권역 내 확산', en: 'In-region expansion' },
  'dt.hqBuild': { ko: '본사 자체구축', en: 'HQ in-house build' },
  'dt.external': { ko: '외부솔루션', en: 'External solution' },
  'dt.passThreshold': { ko: '기준점 통과?', en: 'Passes threshold?' },
  'dt.yesExternal': { ko: 'YES → 외부솔루션', en: 'YES → External' },
  'dt.noFallback': { ko: 'NO (Fallback)', en: 'NO (Fallback)' },
  'dt.apac.title': { ko: 'APAC 진출 검토', en: 'APAC entry review' },
  'dt.apac.subtitle': { ko: '두 경로 함께 검토', en: 'Review both paths' },
  'dt.apac.ext': { ko: '외부솔루션 도입', en: 'Adopt external solution' },
  'dt.apac.int': { ko: '자체구축(내재화)', en: 'In-house build' },
  'dt.apac.note': { ko: 'APAC은 권역 확산·유사도 분기를 적용하지 않습니다 — 두 경로를 동등하게 비교 검토합니다.', en: 'APAC does not apply region-expansion / similarity branching — both paths are compared equally.' },

  // ── 보고서 탭 라벨 ──
  'rpt.sections': { ko: '보고서 섹션', en: 'Report sections' },
  'rpt.tab.summary': { ko: '요약', en: 'Summary' },
  'rpt.tab.similarity': { ko: '유사도 점수', en: 'Similarity' },
  'rpt.tab.decision': { ko: '시스템 결정 트리', en: 'Decision tree' },
  'rpt.tab.tco': { ko: 'TCO · 구독료', en: 'TCO · Subscription' },
  'rpt.tab.market': { ko: '시장·경쟁 배경', en: 'Market & competition' },

  // ── 시장 탭(MarketTab) ──
  'mkt.qualSummary': { ko: '국가 정성 요약', en: 'Country qualitative summary' },
  'mkt.finTop5': { ko: '금융사 Top 5 (점유율 · 캡티브 강도)', en: 'Top 5 lenders (share · captive strength)' },
  'mkt.oemTop5': { ko: 'OEM Top 5 (점유율 · 캡티브 보유)', en: 'Top 5 OEMs (share · captive)' },
  'mkt.evTrend': { ko: 'EV 보급률 · EV/ICE 잔존가치 추이', en: 'EV adoption · EV/ICE residual value trend' },
  'mkt.evRate': { ko: 'EV 보급률', en: 'EV adoption' },
  'mkt.evResidual': { ko: 'EV/ICE 잔존가치(3년)', en: 'EV/ICE residual value (3yr)' },
  'mkt.lineLegend': { ko: '실선=과거, 점선=전망 · 단위: %', en: 'Solid=history, dashed=forecast · unit: %' },
  'mkt.rateRange': { ko: '경쟁사 금리 범위', en: 'Competitor rate range' },
  'mkt.regulators': { ko: '규제기관', en: 'Regulators' },
  'mkt.keyMetrics': { ko: '시장·경쟁 핵심 지표 (원천 데이터)', en: 'Market & competition key metrics (source data)' },
  'mkt.top5cum': { ko: 'Top 5 누적 점유율', en: 'Top 5 cumulative share' },
  'mkt.rankCompany': { ko: '순위 · 기업', en: 'Rank · Company' },
  'mkt.share': { ko: '점유율', en: 'Share' },
  'mkt.value': { ko: '값', en: 'Value' },
  'mkt.competitors': { ko: '경쟁사 현황 (유형별)', en: 'Competitors (by type)' },
  'mkt.totalFirms': { ko: '총 {n}개사', en: '{n} firms' },
  'mkt.entryForm': { ko: '진출 형태', en: 'Entry form' },
  'mkt.countSuffix': { ko: '개', en: '' },
  'mkt.grp.bank': { ko: '은행계 자회사', en: 'Bank subsidiaries' },
  'mkt.grp.oem': { ko: 'OEM 캡티브', en: 'OEM captives' },
  'mkt.grp.fleet': { ko: '플릿/렌팅 리스사', en: 'Fleet/leasing' },
  'mkt.grp.specialty': { ko: '전문 여신사·기타', en: 'Specialty lenders & others' },
  'mkt.brandTop10': { ko: '브랜드 Top 10', en: 'Brand Top 10' },
  'mkt.newCarReg': { ko: '신차 등록 순위', en: 'New-car registration rank' },
  'mkt.newsScan': { ko: '외부 이슈 스캔', en: 'External issue scan' },
  'mkt.newsMissing': { ko: '관련 화이트리스트 이슈 미확보 — 실사 단계 보강 필요', en: 'No whitelisted issue found — to be reinforced during due diligence' },
  'mkt.original': { ko: '원문', en: 'Source' },
  'mkt.overallInsight': { ko: '종합 인사이트', en: 'Overall insight' },

  // ── 요약 탭(SummaryTab) ──
  'sum.dec.apac': { ko: '외부솔루션 · 자체구축(양쪽 검토)', en: 'External · In-house (both reviewed)' },
  'sum.dec.expansion': { ko: '권역 내 확산 ({base} 시스템)', en: 'In-region expansion ({base} system)' },
  'sum.dec.hq': { ko: '본사 자체구축', en: 'HQ in-house build' },
  'sum.dec.ext': { ko: '외부솔루션', en: 'External solution' },
  'sum.side.apac': { ko: '해당국 외부솔루션', en: 'Local external solution' },
  'sum.side.ext': { ko: '추천 외부솔루션', en: 'Recommended external solution' },
  'sum.side.hq': { ko: '본사 구축 예상 비용', en: 'Estimated HQ build cost' },
  'sum.side.sub': { ko: '구독료 구간표', en: 'Subscription tier table' },
  'sum.side.build': { ko: '구축비용·기간', en: 'Build cost · period' },
  'sum.wf.build': { ko: '구축비', en: 'Build' },
  'sum.wf.sub': { ko: '구독료(10Y)', en: 'Subscription (10Y)' },
  'sum.wf.maint': { ko: '유지보수(10Y)', en: 'Maintenance (10Y)' },
  'sum.wf.ops': { ko: '운영비(10Y)', en: 'Operations (10Y)' },
  'sum.wf.total': { ko: '10년 TCO', en: '10-year TCO' },
  'sum.hero.eyebrow': { ko: '국가 진단 보고서 · IT 유사도', en: 'Country diagnostic · IT similarity' },
  'sum.hero.line1': { ko: '{country}의 종합 유사도는 베이스라인 {base} 대비 {score}점/100으로, 이에 따라 시스템 결정은 {decision}(으)로 권고됩니다.', en: '{country}’s overall similarity vs. baseline {base} is {score}/100, so the recommended system decision is {decision}.' },
  'sum.hero.baselineSelf': { ko: '{country}은(는) 이미 시스템이 배포된 권역 기준국으로, 신규 구축·TCO 산정 대상이 아닙니다.', en: '{country} is the regional baseline with the system already deployed, so it is not subject to new build / TCO estimation.' },
  'sum.hero.deployed': { ko: '{country}은(는) 이미 진출(운영중)한 국가로, 신규 구축·TCO 산정 대상이 아닙니다.', en: '{country} is an already-operating market, so it is not subject to new build / TCO estimation.' },
  'sum.hero.tcoPre': { ko: '예상 10년 TCO는', en: 'Estimated 10-year TCO is' },
  'sum.hero.tcoMid': { ko: '이며, 구축 기간은 약 {months}개월, 예상 신규 계약은 {contracts}건/년으로 추정됩니다.', en: ', with a build period of about {months} months and an estimated {contracts} new contracts/year.' },
  'sum.hero.conclusion': { ko: '결론적으로, {rec}을(를) 권고합니다.', en: 'In conclusion, we recommend {rec}.' },
  'sum.itSimScore': { ko: 'IT 유사도 점수', en: 'IT similarity score' },
  'sum.kpi.simScore': { ko: '유사도 점수', en: 'Similarity score' },
  'sum.kpi.tco': { ko: '예상 10년 TCO', en: 'Estimated 10-year TCO' },
  'sum.kpi.buildMonths': { ko: '예상 구축 기간', en: 'Estimated build period' },
  'sum.baselineLabel': { ko: '기준국', en: 'Baseline' },
  'sum.operatingLabel': { ko: '운영국가', en: 'Operating market' },
  'sum.noTco': { ko: '신규 TCO 산정 대상 아님', en: 'Not subject to new TCO estimation' },
  'sum.noBuild': { ko: '구축 기간 해당 없음', en: 'Build period N/A' },
  'sum.buildNote': { ko: '베이스라인 대비 {months}M ({pct}%) 단축', en: '{months}M ({pct}%) shorter vs. baseline' },
  'sum.buildNoteApac': { ko: '기준국 {base} 자산 기준 대략 비용 (유사도 승수 미적용)', en: 'Approx. cost based on baseline {base} assets (no similarity multiplier)' },
  'sum.decisionTree': { ko: '시스템 결정 트리', en: 'System decision tree' },
  'sum.noDecisionTree': { ko: '{country}은(는) 이미 시스템이 운영 중인 국가로, 신규 진출 결정 트리는 적용되지 않습니다.', en: '{country} already operates the system, so the new-entry decision tree does not apply.' },
  'sum.overallInsight': { ko: '국가 종합 인사이트', en: 'Country overall insight' },

  // ── TCO 탭 ──
  'tco.title': { ko: 'TCO · 구독료', en: 'TCO · Subscription' },
  'tco.noTco': { ko: '{country}은(는) 이미 시스템이 배포된 국가이거나 TCO 산정 대상이 아니어서, 구축비용·구독료 산식이 제공되지 않습니다.', en: '{country} has the system deployed or is not subject to TCO estimation, so build/subscription formulas are not provided.' },
  'tco.cases': { ko: '건', en: 'cases' },
  'tco.band': { ko: '구간', en: 'band' },
  'tco.kpi.total': { ko: '총 10년 TCO', en: 'Total 10-year TCO' },
  'tco.kpi.buildMonths': { ko: '예상 구축 기간', en: 'Estimated build period' },
  'tco.kpi.contracts': { ko: '예상 계약건수', en: 'Estimated contracts' },
  'tco.kpi.buildBasis': { ko: '구축비 기준', en: 'Build cost basis' },
  'tco.baselineAsset': { ko: '기준국 자산', en: 'Baseline assets' },
  'tco.noMultiplier': { ko: '유사도 승수 미적용', en: 'No similarity multiplier' },
  'tco.kpi.multiplier': { ko: '유사도 승수', en: 'Similarity multiplier' },
  'tco.panel.buildApac': { ko: '구축비용·기간 (기준국 자체구축 기준)', en: 'Build cost · period (baseline in-house build)' },
  'tco.apacNote': { ko: 'APAC은 유사도 승수를 적용하지 않고, 기준국({base})의 자체구축 비용·기간을 그대로 사용합니다. 외부 솔루션 도입 비용과 비교하기 위한 기준값입니다.', en: 'APAC does not apply a similarity multiplier and uses baseline ({base}) in-house build cost/period directly — a reference for comparing against external-solution costs.' },
  'tco.panel.buildFormula': { ko: '구축비용·기간 산식', en: 'Build cost · period formula' },
  'tco.panel.contractsFormula': { ko: '예상 계약건수 산식', en: 'Estimated contracts formula' },
  'tco.panel.waterfall': { ko: '10년 TCO 구성 분해 (워터폴)', en: '10-year TCO breakdown (waterfall)' },
  'tco.panel.cumulative': { ko: '10년 누적 비용 추이', en: '10-year cumulative cost trend' },
  'tco.legend.y0': { ko: 'Y0 구축비', en: 'Y0 build cost' },
  'tco.legend.cumTotal': { ko: '누적 총비용', en: 'Cumulative total' },
  'tco.formula': { ko: '산식', en: 'Formula' },
  'tco.cumFormula': { ko: '누적(Y) = 구축비 + (연 구독료 + 연 유지보수 + 운영비 ÷ 10) × Y', en: 'Cumulative(Y) = Build + (annual subscription + annual maintenance + ops ÷ 10) × Y' },
  'tco.panel.subTier': { ko: '구독료 구간 (전체 소급)', en: 'Subscription tiers (full retroactive)' },
  'tco.subTierNote': { ko: 'X=누적 계약건수, Y=건당 단가 · 누적 증가 시 자동 하향 (전 물량 소급)', en: 'X=cumulative contracts, Y=unit price · steps down automatically as volume grows (applies to all volume)' },
  'tco.panel.buildCompareApac': { ko: '구축비용·기간 (기준국 {base} 자체구축)', en: 'Build cost · period (baseline {base} in-house build)' },
  'tco.panel.buildCompare': { ko: '구축비용 비교 (기준국 → 신규국)', en: 'Build cost comparison (baseline → new market)' },
  'tco.buildCompareNoteApac': { ko: 'APAC은 승수를 적용하지 않고 기준국({base}) 자체구축 비용·기간을 그대로 사용합니다. 외부 솔루션 도입 비용과 비교하기 위한 기준값입니다.', en: 'APAC applies no multiplier and uses baseline ({base}) in-house build cost/period directly — a reference for comparing against external-solution costs.' },
  'tco.buildCompareNote': { ko: '비구독 솔루션 — 구독료 대신 기준국(B) 구축비용 대비 신규국 구축비용을 비교합니다. 구독료는 운영비에 포함됩니다.', en: 'Non-subscription solution — instead of subscription fees, compares baseline (B) vs. new-market build cost. Subscription is included in operations.' },
  'tco.panel.multiplier': { ko: '유사도 → TCO 승수', en: 'Similarity → TCO multiplier' },
  'tco.multiplierLead': { ko: '탭1-1 종합 유사도 점수를 베이스라인 비용·기간에 적용할 승수로 환산합니다.', en: 'Converts the tab 1-1 overall similarity score into a multiplier applied to baseline cost/period.' },
  'tco.multiplierHqNote': { ko: '내재화(본사 자체구축) 결정이라 재사용 승수는 구축비에 적용되지 않습니다. 아래 표는 참고용입니다.', en: 'Since the decision is in-house build, the reuse multiplier is not applied to build cost. The table below is for reference.' },
  'tco.multiplierApacNote': { ko: 'APAC은 기준국({base}) 자체구축 값을 그대로 사용하므로 유사도 승수가 적용되지 않습니다. 아래 표는 참고용입니다.', en: 'APAC uses baseline ({base}) in-house build values directly, so no similarity multiplier applies. The table below is for reference.' },
  'tco.overallSim': { ko: '종합 유사도', en: 'Overall similarity' },
  'tco.mult': { ko: '승수', en: 'Multiplier' },
  'tco.currentSim': { ko: '현재 유사도', en: 'Current similarity' },
  'tco.appliedBand': { ko: '적용 구간', en: 'Applied band' },
  'tco.appliedMult': { ko: '적용 승수', en: 'Applied multiplier' },
  'tco.panel.basisItems': { ko: '계약 규모 산정 근거 항목', en: 'Contract-volume basis items' },
  'tco.noSubTier': { ko: '이 국가는 구독료 구간이 적용되지 않습니다.', en: 'Subscription tiers do not apply to this country.' },
  'tco.current': { ko: '현재', en: 'Now' },

  // ── 결정 트리 탭(DecisionTreeTab) ──
  'dtt.side.internalize': { ko: '내재화 예상 비용', en: 'Estimated in-house build cost' },

  // ── 유사도 탭(SimilarityTab) ──
  'sim.score': { ko: '유사도 점수', en: 'Similarity score' },
  'sim.axis.system': { ko: '시스템', en: 'System' },
  'sim.axis.product': { ko: '상품', en: 'Product' },
  'sim.axis.regulatory': { ko: '규제', en: 'Regulatory' },
  'sim.axis.risk': { ko: '리스크', en: 'Risk' },
  'sim.axisScores': { ko: '축별 점수', en: 'Scores by axis' },
  'sim.tcoMult': { ko: 'TCO 적용 승수', en: 'TCO multiplier' },
  'sim.bandApplied': { ko: '유사도 {band} → {mult}% 적용', en: 'Similarity {band} → {mult}% applied' },
  'sim.dimScoring': { ko: '디멘전별 채점', en: 'Scoring by dimension' },
  'sim.dimScoringLead': { ko: '각 디멘전을 1~5점 척도로 양국 평가 후, 격차에 따라 유사도를 산출합니다.', en: 'Each dimension is rated 1–5 for both countries, and similarity is derived from the gap.' },
  'sim.evidenceItems': { ko: '유사도 산정 근거 항목 (원천 데이터)', en: 'Similarity basis items (source data)' },
  'sim.axisLabel': { ko: '축', en: 'Axis' },
  'sim.weight': { ko: '가중치', en: 'Weight' },
  'sim.dimension': { ko: '디멘전', en: 'Dimension' },
  'sim.targetCountry': { ko: '대상국', en: 'Target' },
  'sim.baseline': { ko: '베이스라인', en: 'Baseline' },
  'sim.gap': { ko: '격차', en: 'Gap' },
  'sim.similarity': { ko: '유사도', en: 'Similarity' },

  // ── 권역 보고서 탭 라벨(RegionReport) ──
  'rgn.tab.summary': { ko: '요약', en: 'Summary' },
  'rgn.tab.killswitch': { ko: '킬스위치', en: 'Kill-switch' },
  'rgn.tab.attractiveness': { ko: '매력도', en: 'Attractiveness' },
  'rgn.tab.it': { ko: 'IT/순위', en: 'IT & Ranking' },
  'rgn.tab.market': { ko: '시장배경', en: 'Market' },
  'rgn.tab.summary.sub': { ko: 'Summary', en: 'Summary' },
  'rgn.tab.killswitch.sub': { ko: 'Kill-Switch', en: 'Kill-Switch' },
  'rgn.tab.attractiveness.sub': { ko: 'Attractiveness', en: 'Attractiveness' },
  'rgn.tab.it.sub': { ko: 'IT & Ranking', en: 'IT & Ranking' },
  'rgn.tab.market.sub': { ko: 'Market', en: 'Market' },

  // ── 권역 요약 탭(region SummaryTab) ──
  'rsum.top1reason': { ko: '1위 근거', en: 'Top-1 rationale' },
  'rsum.recentIssue': { ko: '최근 이슈', en: 'Recent issue' },
  'rsum.attrXit': { ko: '매력도 × IT 유사도', en: 'Attractiveness × IT similarity' },
  'rsum.fullRanking': { ko: '전체 순위', en: 'Full ranking' },
  'rsum.externalScan': { ko: '외부 이슈 스캔', en: 'External issue scan' },
  'rsum.quickwinTop3': { ko: '퀵윈 순위 (Top 3)', en: 'Quick-win ranking (Top 3)' },

  // ── 권역 킬스위치 탭 ──
  'rks.matrix': { ko: '킬스위치 매트릭스', en: 'Kill-switch matrix' },
  'rks.countries': { ko: '개국', en: 'countries' },

  // ── 권역 매력도 탭 ──
  'rattr.bizRank': { ko: '비즈니스 매력도 순위', en: 'Business attractiveness ranking' },
  'rattr.contribution': { ko: '항목 기여분', en: 'Item contribution' },

  // ── 권역 IT 탭 ──
  'rit.heatmap': { ko: '{metric} 히트맵', en: '{metric} heatmap' },
  'rit.quickwinRank': { ko: '퀵윈 종합 순위', en: 'Quick-win overall ranking' },
  'rit.attrXmetric': { ko: '매력도 × {metric}', en: 'Attractiveness × {metric}' },
  'rit.top3profile': { ko: '상위 3개국 프로파일', en: 'Top 3 country profiles' },

  // ── 권역 시장배경 탭 ──
  'rmkt.background': { ko: '시장 배경 (참고)', en: 'Market background (reference)' },

  // ── 상세화면 공통(P1/P2) ──
  'dtl.aiInsight': { ko: 'AI 인사이트', en: 'AI insight' },
  'dtl.entryInfo': { ko: '진출 정보', en: 'Entry info' },
  // 데이터 버전 드롭다운(상세 헤더)
  'dtl.ver.latest': { ko: '최신 (latest)', en: 'Latest' },
  'dtl.ver.latestSub': { ko: '기본', en: 'Default' },
  'dtl.ver.rendered': { ko: '렌더본', en: 'Rendered' },
  'dtl.ver.latestShort': { ko: '최신', en: 'Latest' },
  'dtl.keyTrend': { ko: '핵심 시장 지표 추이', en: 'Key market metric trend' },
  'dtl.competitorTop': { ko: '경쟁 금융사 Top {n}', en: 'Top {n} competitor lenders' },
  'dtl.row.status': { ko: '진출 상태', en: 'Entry status' },
  'dtl.row.solution': { ko: '사용 솔루션', en: 'Solution in use' },
  'dtl.row.entityType': { ko: '법인 유형', en: 'Entity type' },
  'dtl.row.systemDecision': { ko: '시스템 결정', en: 'System decision' },
  'dtl.row.itSim': { ko: 'IT 유사도', en: 'IT similarity' },
  'dtl.row.baseline': { ko: '권역 베이스라인', en: 'Regional baseline' },
  'dtl.row.baseSystem': { ko: '기준 솔루션', en: 'Baseline solution' },
  'dtl.row.entryDate': { ko: '진출일', en: 'Entry year' },
  // 진출 상태 값(데이터/룰셋 literal) — 영문 모드에서 배지·태그 번역에 사용.
  'status.운영중': { ko: '운영중', en: 'Operating' },
  'status.기진출': { ko: '기 진출', en: 'Active market' },
  'status.미진출': { ko: '미진출', en: 'Not entered' },
  'status.진출예정': { ko: '진출예정', en: 'Planned' },
  'status.준비중': { ko: '준비중', en: 'In preparation' },
  'status.기준국': { ko: '기준국', en: 'Baseline' },
  // 진출 법인 유형 값(country_assets.type literal).
  'entityMode.단독법인': { ko: '단독법인', en: 'SA' },
  'entityMode.JV': { ko: 'JV', en: 'JV' },
  // 권역 퀵윈 사분면 라벨(client quadrantLabel literal).
  'quadrant.선별 후보': { ko: '선별 후보', en: 'Shortlist' },
  'quadrant.기회 탐색': { ko: '기회 탐색', en: 'Explore' },
  'quadrant.관망': { ko: '관망', en: 'Watch' },
  // 취급 상품 값(country_assets.products literal).
  'product.오토론': { ko: '오토론', en: 'Auto loan' },
  'product.할부금융': { ko: '할부금융', en: 'Installment' },
  'product.리스': { ko: '리스', en: 'Lease' },
  'product.운용리스': { ko: '운용리스', en: 'Operating lease' },
  'dtl.year': { ko: '년', en: '' },
  'dtl.afterReport': { ko: '시스템 결정·유사도는 보고서 생성 후 표시됩니다.', en: 'System decision & similarity appear after a report is generated.' },
  'dtl.noTimeseries': { ko: '시계열 데이터가 없습니다.', en: 'No time-series data.' },
  'dtl.chart.gdp': { ko: 'GDP 성장률(%)', en: 'GDP growth (%)' },
  'dtl.chart.autoFin': { ko: '오토금융 이용률(신차, %)', en: 'Auto finance penetration (new car, %)' },
  'dtl.chart.autoFinShort': { ko: '오토금융 이용률(신차)', en: 'Auto finance penetration (new car)' },
  'dtl.chart.sales': { ko: '신차 판매대수', en: 'New car sales' },

  // ── 권역 요약 탭 추가 라벨 ──
  'rsum.attractiveness': { ko: '매력도', en: 'Attractiveness' },
  'rsum.itSim': { ko: 'IT 유사도', en: 'IT similarity' },
  'rsum.col.rank': { ko: '순위', en: 'Rank' },
  'rsum.col.country': { ko: '국가', en: 'Country' },
  'rsum.col.attr': { ko: '매력도', en: 'Attr.' },
  'rsum.col.it': { ko: 'IT', en: 'IT' },
  'rsum.col.quickwin': { ko: '퀵윈', en: 'Quick-win' },
  'rsum.news.regionCommon': { ko: '권역 공통', en: 'Region-wide' },
  'rsum.news.source': { ko: '출처:', en: 'Source:' },
  'rsum.news.original': { ko: '↗ 원문', en: '↗ Source' },

  // ── 권역 킬스위치 탭 추가 라벨 ──
  'rks.col.country': { ko: '국가', en: 'Country' },
  'rks.col.entryForm': { ko: '진출 형태', en: 'Entry form' },
  'rks.pass': { ko: '통과', en: 'Pass' },
  'rks.fail': { ko: '탈락', en: 'Fail' },
  'rks.flag': { ko: '주의', en: 'Flag' },

  // ── 권역 매력도 탭 추가 라벨 ──
  'rattr.weight': { ko: '가중치', en: 'Weight' },
  'rattr.scoreFormula': { ko: '국가별 점수 산식', en: 'Per-country score formula' },
  'rattr.viewFormula': { ko: '산식 보기', en: 'View formula' },
  'rattr.reverseScore': { ko: '高=惡 역점수', en: 'High=bad (reverse)' },
  'rattr.normalScore': { ko: '高=好 정점수', en: 'High=good (normal)' },
  'rattr.surveyItem': { ko: '조사항목', en: 'Survey item' },
  'rattr.contributionCol': { ko: '기여', en: 'Contribution' },
  'rattr.surveyValue': { ko: '조사값', en: 'Survey value' },
  'rattr.normalized': { ko: '정규화 (0~100)', en: 'Normalized (0–100)' },
  'rattr.effectiveWeight': { ko: '유효 가중치', en: 'Effective weight' },

  // ── 권역 IT 탭 추가 라벨 ──
  'rit.col.rank': { ko: '순위', en: 'Rank' },
  'rit.col.country': { ko: '국가', en: 'Country' },
  'rit.col.quickwin': { ko: '퀵윈', en: 'Quick-win' },
  'rit.col.attr': { ko: '매력도', en: 'Attr.' },
  'rit.col.it': { ko: 'IT', en: 'IT' },
  'rit.col.overall': { ko: '종합', en: 'Overall' },
  'rit.band': { ko: '밴드', en: 'Band' },
  'rit.baseline': { ko: '기준', en: 'Baseline' },
  'rit.scoreFormula': { ko: '국가별 {metric} 산식', en: 'Per-country {metric} formula' },
  'rit.quickwinFormula': { ko: '국가별 퀵윈 점수 산식', en: 'Per-country quick-win formula' },
  'rit.metric.maturity': { ko: 'IT 성숙도', en: 'IT maturity' },
  'rit.metric.similarity': { ko: 'IT 유사도', en: 'IT similarity' },
  'rit.profile.sales': { ko: '신차 판매', en: 'New car sales' },
  'rit.profile.finUse': { ko: '금융 이용', en: 'Finance use' },
  'rit.profile.ev': { ko: 'EV 보급', en: 'EV adoption' },
  'rit.profile.attr': { ko: '매력도', en: 'Attractiveness' },
  'rit.profile.itSim': { ko: 'IT 유사도', en: 'IT similarity' },
  'rit.profile.killswitch': { ko: '킬스위치', en: 'Kill-switch' },
  'rit.profile.competitorEntry': { ko: '경쟁사 진출', en: 'Competitor entry' },
  'rit.profile.finTop5': { ko: '금융사 Top 5', en: 'Top 5 lenders' },
  'rit.profile.keyIssue': { ko: '핵심 이슈', en: 'Key issue' },
  'rit.profile.aiComment': { ko: 'AI 코멘트', en: 'AI comment' },
  'rit.viewFormula': { ko: '산식 보기', en: 'View formula' },
  'rit.surveyItem': { ko: '조사항목', en: 'Survey item' },
  'rit.effectiveWeight': { ko: '유효 가중치', en: 'Effective weight' },
  'rit.bandScore': { ko: '밴드 점수', en: 'Band score' },
  'rit.qw.excluded': { ko: '기준국 (제외)', en: 'Baseline (excluded)' },
  'rit.qw.killswitchFail': { ko: '킬스위치 탈락', en: 'Kill-switch failed' },
  'rit.qw.evaluated': { ko: '평가 대상', en: 'Evaluated' },

  // ── 권역 시장배경 탭 추가 라벨 ──
  'rmkt.oemTop5': { ko: 'OEM Top 5', en: 'Top 5 OEMs' },
  'rmkt.brandTop10': { ko: '브랜드 Top 10', en: 'Brand Top 10' },
  'rmkt.competitors': { ko: '주요 경쟁사', en: 'Key competitors' },
  'rmkt.purchasePattern': { ko: '구매 패턴(할부·리스)', en: 'Purchase pattern (loan·lease)' },
  'rmkt.avgPrice': { ko: '평균 신차가격', en: 'Avg. new-car price' },
  'rmkt.countrySummary': { ko: '국가 요약', en: 'Country summary' },

  // ── 권역 상세화면(RegionDetail) ──
  'rdtl.kpi.candidates': { ko: '분석 후보국', en: 'Candidate markets' },
  'rdtl.kpi.quickwin': { ko: 'Quick-win 최우선', en: 'Top Quick-win' },
  'rdtl.kpi.killswitchFailed': { ko: '킬스위치 탈락', en: 'Kill-switch failed' },
  'rdtl.entered.title': { ko: '기 진출 국가', en: 'Active markets' },
  'rdtl.entered.entityType': { ko: '법인종류', en: 'Entity type' },
  'rdtl.entered.since': { ko: '설립연도', en: 'Since' },
  'rdtl.entered.products': { ko: '관리상품', en: 'Products' },
  'rdtl.col.country': { ko: '국가', en: 'Country' },
  'rdtl.trend.title': { ko: '시장 추세 (5년)', en: 'Market trend (5yr)' },
  'rdtl.trend.tag': { ko: '시장규모·EV', en: 'Market size · EV' },
  'rdtl.trend.marketSize': { ko: '오토금융 시장규모', en: 'Auto finance market size' },
  'rdtl.trend.evRate': { ko: 'EV 보급률', en: 'EV adoption' },
  'rdtl.trend.note': { ko: '실선 = 실적(history), 점선 = 전망(forecast). CAGR은 실적 구간 연복리 성장률.', en: 'Solid = history, dashed = forecast. CAGR is the historical-period compound annual growth rate.' },
  'rdtl.map.title': { ko: '권역 지도', en: 'Region map' },
  'rdtl.map.assetLink': { ko: '자산 연결', en: 'Asset links' },
  'rdtl.map.show': { ko: '보기', en: 'Show' },
  'rdtl.map.hide': { ko: '끄기', en: 'Hide' },
  'rdtl.map.noData': { ko: '이 권역의 지도 데이터를 표시할 수 없습니다.', en: 'No map data available for this region.' },
  'rdtl.map.bubbleLegend': { ko: '버블 = 시장규모', en: 'Bubble = market size' },
  'rdtl.map.state.active': { ko: '운영중', en: 'Operating' },
  'rdtl.map.state.preparing': { ko: '준비중', en: 'Preparing' },
  'rdtl.map.state.none': { ko: '미진출/후보', en: 'Not entered / candidate' },
  'rdtl.quickwin.title': { ko: '진출 예정국 Quick-Win 순위', en: 'Quick-Win ranking for planned markets' },
  'rdtl.quickwin.score': { ko: '종합점수', en: 'Composite score' },
  'rdtl.quickwin.verdict': { ko: '판정', en: 'Verdict' },
  'rdtl.quickwin.badge': { ko: '퀵윈', en: 'Quick-win' },
  'rdtl.insight.eyebrow': { ko: '권역 진단 · AI 교차 인사이트', en: 'Region diagnostic · AI cross-insight' },
  'rdtl.insight.hidden': { ko: '+{n}건 (보고서)', en: '+{n} more (report)' },
  'rdtl.insight.title': { ko: '권역 인사이트', en: 'Region insight' },

  // ── 룰셋 설정(RulesetForm) ──
  'rs.title': { ko: '룰셋 설정', en: 'Ruleset settings' },
  'rs.subtitle': { ko: '보고서 생성에 쓰이는 가중치·계수', en: 'Weights & coefficients used in report generation' },
  'rs.versionAria': { ko: '룰셋 버전 선택', en: 'Select ruleset version' },
  'rs.versionLatest': { ko: ' (최신)', en: ' (latest)' },
  'rs.save': { ko: '저장', en: 'Save' },
  'rs.saving': { ko: '저장 중…', en: 'Saving…' },
  'rs.loading': { ko: '룰셋을 불러오는 중…', en: 'Loading ruleset…' },
  'rs.loadError': { ko: '룰셋을 불러오지 못했습니다.', en: 'Failed to load ruleset.' },
  'rs.saveError': { ko: '저장에 실패했습니다.', en: 'Failed to save.' },
  'rs.versionLoadError': { ko: '버전 v{v}을 불러오지 못했습니다.', en: 'Failed to load version v{v}.' },
  'rs.invalidGroups': {
    ko: '합이 100%가 아닌 가중치 그룹이 있어 저장할 수 없습니다. 각 그룹의 정규화 버튼으로 맞출 수 있습니다.',
    en: 'Some weight groups do not sum to 100%, so saving is blocked. Use each group’s Normalize button to fix it.',
  },
  'rs.pastVersion': {
    ko: '과거 버전 v{v}을 보고 있습니다. 저장하면 새 버전으로 기록됩니다.',
    en: 'You are viewing past version v{v}. Saving will record a new version.',
  },
  'rs.section1.title': { ko: '점수 가중치', en: 'Score weights' },
  'rs.section1.desc': {
    ko: '각 그룹의 합이 100%(1.0)가 되어야 저장할 수 있습니다.',
    en: 'Each group must sum to 100% (1.0) to allow saving.',
  },
  'rs.section2.title': { ko: '임계값·계수', en: 'Thresholds & coefficients' },
  'rs.section2.desc': {
    ko: '출처 신뢰 배수와 시스템 전략 분기 기준값.',
    en: 'Source-trust multipliers and system-strategy branch thresholds.',
  },
  'rs.grp.biz.title': { ko: '사업매력도 항목 가중치', en: 'Business attractiveness item weights' },
  'rs.grp.biz.hint': { ko: '매력도 점수 산식 항목 비중 (values.biz_attractiveness)', en: 'Item weights in the attractiveness score formula (values.biz_attractiveness)' },
  'rs.grp.it.title': { ko: 'IT 준비도 항목 가중치', en: 'IT readiness item weights' },
  'rs.grp.it.hint': { ko: 'IT 준비도 점수 산식 항목 비중 (values.it_readiness)', en: 'Item weights in the IT readiness score formula (values.it_readiness)' },
  'rs.grp.blend.title': { ko: '보고서 종합 점수 혼합비', en: 'Report overall-score blend' },
  'rs.grp.blend.hint': { ko: '매력도 ↔ IT 종합 점수 가중 (values.report_blend)', en: 'Attractiveness ↔ IT overall-score weighting (values.report_blend)' },
  'rs.grp.sim.title': { ko: '유사도 항목 가중치', en: 'Similarity item weights' },
  'rs.grp.sim.hint': { ko: '종합 유사도 산정 항목 비중 (similarity_item_weights)', en: 'Item weights for overall similarity (similarity_item_weights)' },
  'rs.grp.tier.title': { ko: '출처 신뢰 계수 (Tier)', en: 'Source-trust coefficients (Tier)' },
  'rs.grp.tier.hint': { ko: '출처 신뢰도별 점수 가중 배수 (0~1.0). Tier 1은 1.0 고정 권장', en: 'Score multipliers by source trust (0–1.0). Tier 1 recommended fixed at 1.0' },
  'rs.grp.decision.title': { ko: '시스템 결정 임계값', en: 'System decision thresholds' },
  'rs.grp.decision.hint': { ko: '유사도 기반 시스템 전략 분기 (0~100점)', en: 'Similarity-based system-strategy branching (0–100 pts)' },
  'rs.sumBadge': { ko: '합 {pct}', en: 'Sum {pct}' },
  'rs.normalize': { ko: '정규화', en: 'Normalize' },
  'rs.normalizeTitle': { ko: '합이 100%가 되도록 비율을 자동 보정합니다', en: 'Auto-adjusts ratios to sum to 100%' },
  'rs.valueAria': { ko: '값', en: 'value' },
  // 계수/임계 항목 라벨
  'rs.lbl.w_biz': { ko: '사업매력도 비중', en: 'Attractiveness weight' },
  'rs.lbl.w_it': { ko: 'IT 준비도 비중', en: 'IT readiness weight' },
  'rs.lbl.expansion_min_score': { ko: '확산 임계 (≥ → B시스템 확산)', en: 'Expansion threshold (≥ → expand B system)' },
  'rs.lbl.hq_build_min_score': { ko: '본사 구축 임계 (≥ → 자체구축)', en: 'HQ-build threshold (≥ → in-house build)' },
  'rs.lbl.tier1': { ko: 'Tier 1 · 최상위 출처', en: 'Tier 1 · top-grade source' },
  'rs.lbl.tier2': { ko: 'Tier 2 · 신뢰 출처', en: 'Tier 2 · trusted source' },
  'rs.lbl.tier3': { ko: 'Tier 3 · 일반 출처', en: 'Tier 3 · general source' },
  'rs.lbl.tier4': { ko: 'Tier 4 · 보조 출처', en: 'Tier 4 · supplementary source' },
  // 매력도/IT/유사도 항목 — 룰셋 JSON의 키가 한글이라 ko는 키 그대로, en만 매핑.
  'rs.lbl.gdp_growth': { ko: 'GDP 성장률', en: 'GDP growth' },
  'rs.lbl.car_sales': { ko: '자동차 판매대수', en: 'Car sales volume' },
  'rs.lbl.market_size': { ko: '시장규모', en: 'Market size' },
  'rs.lbl.autofin_cagr': { ko: '오토금융 성장률(CAGR)', en: 'Auto finance growth (CAGR)' },
  'rs.lbl.fin_penetration': { ko: '금융 이용률', en: 'Finance penetration' },
  'rs.lbl.fin_type': { ko: '금융이용유형', en: 'Finance usage type' },
  'rs.lbl.competition': { ko: '경쟁강도', en: 'Competitive intensity' },
  'rs.lbl.solution_type': { ko: '솔루션 유형', en: 'Solution type' },
  'rs.lbl.digital_maturity': { ko: '디지털 채널 성숙도', en: 'Digital channel maturity' },
  'rs.lbl.license_type': { ko: '라이선스 종류', en: 'License type' },
  'rs.lbl.data_localization': { ko: '데이터현지화', en: 'Data localization' },
  'rs.lbl.repossession': { ko: '차량회수 절차', en: 'Vehicle repossession process' },
  'rs.lbl.purchase_pattern': { ko: '구매 패턴(할부·리스 비중)', en: 'Purchase pattern (installment·lease)' },
  'rs.lbl.license_regime': { ko: '라이선스 체제(세그먼트별)', en: 'License regime (by segment)' },
  'rs.lbl.data_localization_duty': { ko: '데이터 현지화 의무', en: 'Data-localization duty' },
  'rs.lbl.repossession_ease': { ko: '차량회수 절차 용이성', en: 'Repossession process ease' },
  // 저장 성공 팝업(SaveSuccessModal)
  'rs.saved.title': { ko: '룰셋이 저장되었습니다', en: 'Ruleset saved' },
  'rs.saved.desc': {
    ko: '이후 생성되는 보고서부터 새 가중치가 반영됩니다.',
    en: 'New weights apply to reports generated from now on.',
  },
  'rs.saved.version': { ko: '버전', en: 'Version' },
  'rs.saved.snapshot': { ko: '스냅샷', en: 'Snapshot' },
  'rs.saved.savedAt': { ko: '저장 시각', en: 'Saved at' },
  'rs.saved.confirm': { ko: '확인', en: 'OK' },

  // ── 모달 컨테이너 상단 스트립(App.modalFrame / 컨테이너 공통) ──
  'shell.back': { ko: '← 지도로', en: '← Map' },
  'shell.backAria': { ko: '지도로 돌아가기', en: 'Back to map' },
  'shell.closeAria': { ko: '닫기', en: 'Close' },
  'shell.tag.ruleset': { ko: '룰셋 설정', en: 'Ruleset' },
  'shell.title.ruleset': { ko: '진단 룰셋 설정', en: 'Diagnostic ruleset settings' },
  'shell.tag.countryReport': { ko: '국가 진단 보고서', en: 'Country report' },
  'shell.tag.regionReport': { ko: '권역 진단 보고서', en: 'Region report' },
  'shell.title.countryReport': { ko: '국가 진단 보고서', en: 'Country report' },
  'shell.title.regionReport': { ko: '권역 진단 보고서', en: 'Region report' },
  'shell.tag.countryDetail': { ko: '국가 정보', en: 'Country info' },
  'shell.tag.regionDetail': { ko: '권역 정보', en: 'Region info' },
  'shell.title.countryDetail': { ko: '국가 상세', en: 'Country detail' },
  'shell.title.regionDetail': { ko: '권역 상세', en: 'Region detail' },
}

export function translate(key: string, lang: Lang): string {
  const e = DICT[key]
  if (!e) return key
  return e[lang] ?? e.ko
}

/** 데이터 literal 값 → 언어별 라벨(`<prefix>.<value>` 키 조회). 매핑 없으면 원본 값 그대로(미상 값 안전). */
export function valueLabel(prefix: string, value: string | undefined, lang: Lang): string {
  if (!value) return ''
  const e = DICT[`${prefix}.${value}`]
  return e ? (e[lang] ?? e.ko) : value
}

/** 진출 상태 값(한글 literal) → 언어별 라벨. */
export function statusLabel(status: string | undefined, lang: Lang): string {
  return valueLabel('status', status, lang)
}

/** 컴포넌트용 — lang store 구독 t(). */
export function useT() {
  const lang = useStore((s) => s.lang)
  return (key: string) => translate(key, lang)
}
