# PawDex PPT 다이어그램 - Mermaid 코드

> 사용법: 각 코드 블록을 https://mermaid.live 에 붙여넣기 → PNG/SVG 다운로드

---

## 1. 시스템 구조도 (전체 아키텍처)

```mermaid
graph TB
    subgraph USER["사용자"]
        WEB["웹 브라우저\npawdex.store"]
        APP["모바일 앱\nReact Native"]
    end

    subgraph VERCEL["Vercel - CDN + Edge"]
        subgraph NEXTJS["Next.js 16 Turbopack"]
            subgraph PAGES["페이지"]
                AUTH_P["인증\n로그인 회원가입"]
                SEARCH_P["검색\nAI 논문 분석"]
                RECORD_P["기록\n건강기록장"]
                MAP_P["지도\n동물병원 찾기"]
                PROFILE_P["프로필\n설정 관리"]
                PAYMENT_P["결제\n구독 관리"]
            end
            subgraph API["API Routes - 9개 엔드포인트"]
                API1["validate-and-translate"]
                API2["search-usage"]
                API3["analyze-papers"]
                API4["disease-description"]
                API5["saved-analyses"]
                API6["subscription"]
                API7["payments/confirm"]
                API8["delete-account"]
            end
        end
    end

    subgraph EXTERNAL["외부 서비스"]
        SUPA["Supabase\nAuth + PostgreSQL + Storage\nTokyo Region"]
        OPENAI["OpenAI\nGPT-4o-mini\n검증 번역 분석"]
        PUBMED["PubMed NIH\neUtils API\n3600만 논문"]
        TOSS["Toss Payments\n결제 처리"]
        KAKAO["Kakao Maps\n동물병원 검색"]
    end

    WEB -->|HTTPS| NEXTJS
    APP -->|HTTPS| NEXTJS

    API1 --> OPENAI
    API3 --> OPENAI
    API4 --> OPENAI
    API1 --> SUPA
    API2 --> SUPA
    API5 --> SUPA
    API6 --> SUPA
    API7 --> TOSS
    API7 --> SUPA
    API8 --> SUPA
    SEARCH_P --> PUBMED
    MAP_P --> KAKAO

    style USER fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px
    style VERCEL fill:#E3F2FD,stroke:#2196F3,stroke-width:2px
    style EXTERNAL fill:#FFF3E0,stroke:#FF9800,stroke-width:2px
    style NEXTJS fill:#F3E5F5,stroke:#9C27B0,stroke-width:1px
    style PAGES fill:#E8EAF6,stroke:#3F51B5,stroke-width:1px
    style API fill:#FCE4EC,stroke:#E91E63,stroke-width:1px
```

---

## 2. AI 논문 검색 파이프라인 (핵심 기능)

```mermaid
flowchart TD
    START(["사용자 검색\n고양이 감기"])

    S1["Step 1: 검증 + 번역\n/api/validate-and-translate"]
    S1_MAP{"diseaseMap\n매칭?"}
    S1_GPT["GPT-4o-mini\n질병 검증 + MeSH 번역"]
    S1_BAN{"금지어\n필터?"}
    S1_FAIL(["반려동물 질병이\n아닙니다"])

    S2["Step 2: 횟수 체크\n/api/search-usage"]
    S2_CHECK{"한도\n초과?"}
    S2_FAIL(["검색 횟수를 모두\n사용했습니다"])
    S2_LOG["search_logs 기록"]

    S3["Step 3: 캐시 확인\nsearch_cache 조회"]
    S3_CHECK{"48시간 이내\n캐시 존재?"}
    S3_HIT(["캐시 결과\n즉시 반환"])

    S4["Step 4: PubMed 검색\n논문 10편 ID 획득"]
    S4_DETAIL["3단계 폴백 전략\nTitle - Abstract - 자유텍스트"]

    S5["Step 5: 병렬 실행"]
    S5A["efetch 초록\n10편 가져오기"]
    S5B["GPT 질병설명\n생성"]

    S6["Step 6: AI 분석\nGPT-4o-mini"]
    S6_BATCH["6편 초과시\n2-batch 병렬 처리"]
    S6_RESULT["관련성 판단 + 제목번역\n요약 + 주의사항 + 성분"]

    S7["Step 7: 관련성 필터링"]
    S7_CHECK{"relevant=true\n2개 이상?"}
    S7_A["관련 논문만 반환"]
    S7_B["상위 5개 반환"]

    S8["Step 8: 캐시 저장\nsearch_cache 48시간"]

    RESULT(["결과 표시\n논문요약 + 주의사항 + 성분"])

    START --> S1
    S1 --> S1_MAP
    S1_MAP -->|Yes| S2
    S1_MAP -->|No| S1_GPT
    S1_GPT --> S1_BAN
    S1_BAN -->|금지어| S1_FAIL
    S1_BAN -->|통과| S2

    S2 --> S2_CHECK
    S2_CHECK -->|초과| S2_FAIL
    S2_CHECK -->|OK| S2_LOG
    S2_LOG --> S3

    S3 --> S3_CHECK
    S3_CHECK -->|Hit| S3_HIT
    S3_CHECK -->|Miss| S4

    S4 --> S4_DETAIL
    S4_DETAIL --> S5
    S5 --> S5A
    S5 --> S5B
    S5A --> S6
    S5B --> S6

    S6 --> S6_BATCH
    S6_BATCH --> S6_RESULT
    S6_RESULT --> S7

    S7 --> S7_CHECK
    S7_CHECK -->|Yes| S7_A
    S7_CHECK -->|No| S7_B
    S7_A --> S8
    S7_B --> S8
    S8 --> RESULT

    style START fill:#4CAF50,color:#fff,stroke:#388E3C
    style RESULT fill:#4CAF50,color:#fff,stroke:#388E3C
    style S1_FAIL fill:#F44336,color:#fff,stroke:#D32F2F
    style S2_FAIL fill:#F44336,color:#fff,stroke:#D32F2F
    style S3_HIT fill:#FF9800,color:#fff,stroke:#F57C00
    style S6_BATCH fill:#9C27B0,color:#fff,stroke:#7B1FA2
```

---

## 3. 인증 흐름

```mermaid
flowchart TD
    START(["사용자"])

    subgraph LOGIN["로그인 방식 선택"]
        EMAIL["이메일 로그인"]
        GOOGLE["Google OAuth"]
        KAKAO["카카오 OAuth"]
    end

    EMAIL --> EMAIL_AUTH["Supabase\nsignInWithPassword"]
    GOOGLE --> GOOGLE_AUTH["Supabase\nsignInWithOAuth\nPKCE flow"]
    KAKAO --> KAKAO_AUTH["Supabase\nsignInWithOAuth\nPKCE flow"]

    INAPP{"인앱 브라우저\n감지?"}
    GOOGLE_AUTH --> INAPP
    INAPP -->|Yes| INAPP_WARN["외부 브라우저\n이용 안내"]
    INAPP -->|No| CALLBACK

    EMAIL_AUTH --> SESSION
    KAKAO_AUTH --> CALLBACK

    CALLBACK["/auth/callback\n코드 교환"]
    CALLBACK --> SESSION

    SESSION["Supabase 세션 생성\nJWT 토큰 발급"]

    SESSION --> PROFILE_CHECK{"profiles 테이블\n존재?"}
    PROFILE_CHECK -->|No| ENSURE["ensureProfile\n프로필 자동 생성"]
    PROFILE_CHECK -->|Yes| AVATAR
    ENSURE --> AVATAR

    AVATAR["아바타 URL\nHTTP to HTTPS 변환"]
    AVATAR --> DONE(["메인 페이지\n리다이렉트"])

    START --> LOGIN

    style START fill:#2196F3,color:#fff
    style DONE fill:#4CAF50,color:#fff
    style INAPP_WARN fill:#FF9800,color:#fff
    style SESSION fill:#9C27B0,color:#fff
```

---

## 4. 결제 흐름

```mermaid
flowchart TD
    START(["사용자"])

    PRICING["/pricing 페이지\n요금제 비교"]

    subgraph PLANS["요금제 3종"]
        FREE["Free\n무료\n검색 3회"]
        BASIC["Basic\n2900원/월\n검색 10회"]
        PREMIUM["Premium\n4900원/월\n검색 30회"]
    end

    SELECT["요금제 선택"]
    PAYMENT["/payment 페이지"]

    TOSS_WIDGET["Toss Payments\n결제 위젯 로드"]
    CARD["카드 정보 입력"]
    TOSS_APPROVE["Toss 서버\n결제 승인"]

    SUCCESS{"/payment/success"}
    FAIL_PAGE["/payment/fail\n결제 실패"]

    CONFIRM["POST /api/payments/confirm"]

    subgraph VERIFY["서버 검증 3단계"]
        V1["1. orderId에서 plan 추출"]
        V2["2. 금액 검증 - 변조 방지"]
        V3["3. Toss API 최종 승인"]
    end

    subgraph DB_UPDATE["DB 업데이트"]
        D1["payment_history 기록"]
        D2["subscriptions upsert\n30일 구독 활성화"]
        D3["profiles.plan 변경"]
    end

    DONE(["구독 활성화 완료\n기능 해제"])

    START --> PRICING
    PRICING --> PLANS
    PLANS --> SELECT
    SELECT --> PAYMENT
    PAYMENT --> TOSS_WIDGET
    TOSS_WIDGET --> CARD
    CARD --> TOSS_APPROVE
    TOSS_APPROVE -->|성공| SUCCESS
    TOSS_APPROVE -->|실패| FAIL_PAGE
    SUCCESS --> CONFIRM
    CONFIRM --> VERIFY
    V1 --> V2 --> V3
    VERIFY --> DB_UPDATE
    D1 --> D2 --> D3
    DB_UPDATE --> DONE

    style START fill:#2196F3,color:#fff
    style DONE fill:#4CAF50,color:#fff
    style FAIL_PAGE fill:#F44336,color:#fff
    style VERIFY fill:#FFF9C4,stroke:#FBC02D
    style DB_UPDATE fill:#E8F5E9,stroke:#4CAF50
```

---

## 5. DB 스키마 (ER 다이어그램)

```mermaid
erDiagram
    profiles ||--o{ pets : "1:N"
    profiles ||--o{ health_records : "1:N"
    profiles ||--o{ search_logs : "1:N"
    profiles ||--o{ saved_analyses : "1:N"
    profiles ||--o| subscriptions : "1:1"
    profiles ||--o{ payment_history : "1:N"
    profiles ||--o{ activity_logs : "1:N"

    pets ||--o{ health_records : "1:N"

    health_records ||--o{ medications : "1:N"
    health_records ||--o{ record_files : "1:N"

    medications ||--o{ medication_checks : "1:N"

    profiles {
        uuid id PK
        text email UK
        text nickname
        text avatar_url
        text plan
        timestamp created_at
    }

    pets {
        uuid id PK
        uuid user_id FK
        text name
        text type
        text breed
        date birth_date
    }

    health_records {
        uuid id PK
        uuid user_id FK
        uuid pet_id FK
        text record_type
        text title
        text hospital_name
        date visit_date
        int cost
    }

    medications {
        uuid id PK
        uuid record_id FK
        text name
        text dosage
        date start_date
        date end_date
        text frequency
    }

    medication_checks {
        uuid id PK
        uuid medication_id FK
        date check_date
        boolean checked
        int dose_number
    }

    record_files {
        uuid id PK
        uuid record_id FK
        text file_name
        text file_path
    }

    subscriptions {
        uuid id PK
        uuid user_id FK
        text plan
        text status
        timestamp period_start
        timestamp period_end
    }

    payment_history {
        uuid id PK
        uuid user_id FK
        text toss_payment_key UK
        int amount
        text status
    }

    search_logs {
        uuid id PK
        uuid user_id FK
        text query
        text pet_type
        timestamp created_at
    }

    search_cache {
        uuid id PK
        text cache_key UK
        jsonb articles
        jsonb analysis
    }

    saved_analyses {
        uuid id PK
        uuid user_id FK
        text query
        jsonb articles
        jsonb analysis
    }

    activity_logs {
        uuid id PK
        uuid user_id FK
        text action
        text resource_type
        jsonb details
    }
```

---

## 6. 요금제 비교

```mermaid
graph LR
    subgraph FREE["Free - 무료"]
        F1["검색 3회/일"]
        F2["기록 5개"]
        F3["AI분석 흐림처리"]
        F4["보관 불가"]
        F5["반려동물 1마리"]
    end

    subgraph BASIC["Basic - 2900원/월"]
        B1["검색 10회/일"]
        B2["기록 15개"]
        B3["AI분석 전체 공개"]
        B4["보관 10개"]
        B5["반려동물 3마리"]
    end

    subgraph PREMIUM["Premium - 4900원/월"]
        P1["검색 30회/일"]
        P2["기록 무제한"]
        P3["AI분석 전체 공개"]
        P4["보관 무제한"]
        P5["반려동물 무제한"]
    end

    FREE -.->|업그레이드| BASIC
    BASIC -.->|업그레이드| PREMIUM

    style FREE fill:#E8F5E9,stroke:#4CAF50,stroke-width:2px
    style BASIC fill:#E3F2FD,stroke:#2196F3,stroke-width:2px
    style PREMIUM fill:#FFF3E0,stroke:#FF9800,stroke-width:2px
```

---

## 7. 건강기록 관리 흐름

```mermaid
flowchart TD
    START(["건강기록장"])

    PET_SELECT["반려동물 선택"]

    subgraph TABS["탭 전환"]
        TAB_LIST["기록 탭"]
        TAB_CAL["캘린더 탭"]
    end

    subgraph FILTERS["필터"]
        F_ALL["전체"]
        F_SYMPTOM["증상"]
        F_VISIT["진료"]
        F_HOSPITAL["입퇴원"]
    end

    RECORD_LIST["기록 목록\n월별 의료비 통계"]
    CALENDAR["캘린더 뷰\n색상별 기록 표시"]

    ADD_BTN["기록 추가"]

    subgraph ADD_FORM["기록 추가 폼"]
        TYPE["기록 유형 선택\n증상 / 진료 / 입퇴원"]
        BASIC_INFO["기본 정보\n제목 날짜 설명"]
        VISIT_INFO["진료 정보\n병원명 비용 예약"]
        MED_INFO["투약 정보\n약명 용량 빈도\n시작일 종료일"]
        FILE_INFO["첨부파일\n최대 3개\n이미지 또는 PDF"]
    end

    MED_CHECK["투약 체크리스트\n일일 복용 확인"]
    STATS["의료비 통계\n월별 그래프"]

    DETAIL["기록 상세 보기"]
    EDIT["기록 수정"]

    START --> PET_SELECT
    PET_SELECT --> TABS
    TAB_LIST --> FILTERS
    TAB_CAL --> CALENDAR
    FILTERS --> RECORD_LIST
    CALENDAR --> MED_CHECK
    RECORD_LIST --> ADD_BTN
    RECORD_LIST --> DETAIL
    RECORD_LIST --> STATS
    ADD_BTN --> ADD_FORM
    TYPE --> BASIC_INFO
    BASIC_INFO --> VISIT_INFO
    VISIT_INFO --> MED_INFO
    MED_INFO --> FILE_INFO
    DETAIL --> EDIT

    style START fill:#2196F3,color:#fff
    style ADD_FORM fill:#FFF9C4,stroke:#FBC02D
    style MED_CHECK fill:#E8F5E9,stroke:#4CAF50
    style STATS fill:#F3E5F5,stroke:#9C27B0
```

---

## 사용법

1. https://mermaid.live 접속
2. 왼쪽 에디터에 코드 블록 내용 붙여넣기 (백틱mermaid 와 백틱 제외)
3. 오른쪽 미리보기 확인
4. 상단 메뉴 Actions - PNG 또는 SVG 다운로드
5. PPT에 이미지 삽입

### 팁
- 배경 투명: Actions - PNG transparent 선택
- 크기 조절: 다운로드 후 PPT에서 자유롭게 리사이즈
- 테마 변경: Config 탭에서 theme를 dark 또는 forest 등으로 변경 가능
