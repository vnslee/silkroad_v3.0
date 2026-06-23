# Component Dependencies — research-chatbot (2차)

## 의존 매트릭스 (행 → 열 호출)
| ↓ \ → | ResearchRouter | ChatRouter | ResearchOrch | ResearchAgent | Chatbot | BedrockClient | PromptLoader | JobMgr(1차) | StorageResolver(1차) | Bedrock |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| **ResearchRouter** | – | – | ✔(BG) | – | – | – | – | ✔ | – | – |
| **ChatRouter** | – | – | – | – | ✔ | – | – | – | – | – |
| **ResearchOrch** | – | – | – | ✔ | – | – | – | ✔(progress) | – | – |
| **ResearchAgent** | – | – | – | – | – | ✔ | ✔ | – | ✔(save) | – |
| **Chatbot** | – | – | – | – | – | ✔ | – | – | ✔(exists) | – |
| **BedrockClient** | – | – | – | – | – | – | – | – | – | ✔ |

- 방향: Router → Service → (BedrockClient → Bedrock). 순환 없음.
- 1차 컴포넌트(JobMgr·StorageResolver)는 **피호출만**(확장된 채로 재사용).
- BedrockClient만 외부 Bedrock에 의존(격리).

## 데이터 흐름 (리서치, 텍스트)
```
POST /api/research/{domain}/{id}
 → ResearchRouter → JobMgr.create_job → BG: ResearchOrch.run_research_job
     → ResearchAgent.run
         → PromptLoader(prompt+schema)
         → BedrockClient.generate_structured → Bedrock(Opus 4.8) → JSON
         → StorageResolver.save_research → storage/data/research/<domain>/<id>/
     → JobMgr.succeed(result)
GET /api/jobs/{id} → JobStatus(progress/result)
```

## 컴포넌트 관계도 (Mermaid)
```mermaid
flowchart TD
    Client["Client Frontend"]
    RR["Research Router C13"]
    CR["Chat Router C14"]
    Orch["Research Orchestrator C11"]
    Agent["Research Agent C10"]
    Chat["Chatbot Service C12"]
    BC["Bedrock Client C8"]
    PL["Prompt Loader C9"]
    Job["Job Manager 1st"]
    SR["Storage Resolver 1st"]
    BR["Bedrock Opus 4.8"]
    ST["storage data research"]
    Spec["research spec md"]

    Client --> RR
    Client --> CR
    RR --> Job
    RR --> Orch
    CR --> Chat
    Orch --> Agent
    Orch --> Job
    Agent --> PL
    Agent --> BC
    Agent --> SR
    Chat --> BC
    Chat --> SR
    BC --> BR
    PL --> Spec
    SR --> ST

    style RR fill:#4CAF50,stroke:#1B5E20,color:#fff
    style CR fill:#4CAF50,stroke:#1B5E20,color:#fff
    style BR fill:#FFA726,stroke:#E65100,color:#000
    style Job fill:#90CAF9,stroke:#1565C0,color:#000
    style SR fill:#90CAF9,stroke:#1565C0,color:#000
    style ST fill:#BDBDBD,stroke:#424242,color:#000
    style Spec fill:#BDBDBD,stroke:#424242,color:#000
```

### Text Alternative
```
Client → {ResearchRouter, ChatRouter}
ResearchRouter → JobManager(1차), ResearchOrchestrator
ChatRouter → ChatbotService
ResearchOrchestrator → ResearchAgent, JobManager(progress)
ResearchAgent → PromptLoader, BedrockClient, StorageResolver(1차)
ChatbotService → BedrockClient, StorageResolver(1차)
BedrockClient → Bedrock(Opus 4.8)
PromptLoader → architecture/research/*.md
StorageResolver → storage/data/research/
(단방향, 순환 없음)
```

## 외부 의존 (requirements.txt 반영)
- anthropic==0.109.2 (AnthropicBedrockMantle) — 신규 명시
- boto3==1.42.97 (자격증명 체인, 1차에서 이미 핀)
- (테스트) pytest·hypothesis·httpx (1차)
