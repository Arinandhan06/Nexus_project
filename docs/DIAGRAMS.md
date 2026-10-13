# NEXUS Architectural & System Diagrams (Phase 10)

These six Mermaid diagrams reflect the actual implementation and code patterns present throughout the NEXUS codebase.

---

## 1. Data Flow Diagram (DFD)

Traces the ingestion, evaluation, scoring, and telemetry broadcast of a cadet submission.

```mermaid
flowchart TD
    Cadet[("Cadet Browser")] -->|POST /chambers/{n}/submit| MainAPI["FastAPI Gateway (backend/main.py)"]
    MainAPI -->|Security Headers & Token Auth| AuthSec["Auth Scoping & Rate Limiter"]
    AuthSec -->|Code payload <= 20 KB| Engine["Chamber Engine (backend/chamber_engine.py)"]

    subgraph EvaluationPipeline ["Evaluation Pipeline"]
        Engine -->|AST Analysis| AST["AST Evaluator (evaluator.py)"]
        AST -->|Complexity & Cleanliness| ASTScores["Complexity Estimate & Cleanliness Score"]

        Engine -->|Harness Injection| Harn["Test Harness (harness.py)"]
        Harn -->|Prepare JSON Stdin| JudgeBatch["Judge0 Batch Payload"]
        JudgeBatch -->|HTTP Execution| J0[("Judge0 Sandbox / Mock")]
        J0 -->|Raw Stdout with Marker| ParseHarn["Marker Parser (__NEXUS_EVAL__:)"]
        ParseHarn --> TestVerification{"All Hidden Tests Passed?"}
    end

    TestVerification -->|Yes| PassedPath["Target State: PASSED"]
    TestVerification -->|No| FailedPath["Target State: FAILED"]

    PassedPath --> NXPCalc["NXP Engine (nxp.py)"]
    PassedPath --> MatrixCalc["Matrix Telemetry Engine (matrix.py)"]

    NXPCalc -->|Idempotent Insert| LedgerDB[("nxp_ledger Table")]
    MatrixCalc -->|Updated DSA / SysDesign / Cleanliness| MatrixDB[("matrix_history & player_profile")]
    Engine -->|Update State & Attempt| StateDB[("chamber_state & chamber_attempts")]

    StateDB --> WSBroadcaster["WebSocket Manager (backend/ws.py)"]
    WSBroadcaster -->|WSS Event: state & progress| Cadet
```

---

## 2. Use Case Diagram

Captures cadet interactions across the six Jira epic workflows.

```mermaid
flowchart LR
    Cadet((Cadet / Player))

    subgraph Authentication_Onboarding ["Epic 1: Onboarding"]
        UC1["Login via GitHub OAuth"]
        UC2["Upload Resume (PDF/DOCX)"]
        UC3["View 30-Day Training Calendar"]
    end

    subgraph Arena_Chambers ["Epics 2 & 3: Arena & Dual AI"]
        UC4["Enter Chamber & Start Countdown"]
        UC5["Request Progressive Hint from ARIA"]
        UC6["Receive Contextual Taunt from NEXUS"]
        UC7["Experience Pressure Feedback (Audio/Shake)"]
    end

    subgraph Evaluation_Scoring ["Epics 4 & 5: Judging & Telemetry"]
        UC8["Submit Code in Monaco Editor"]
        UC9["Inspect AST Cleanliness & Complexity"]
        UC10["Earn NXP & Maintain Daily Streak"]
        UC11["View Radar Matrix Telemetry"]
    end

    subgraph Finale_Career ["Epic 6: Finale & Bids"]
        UC12["Complete 3-Round Live Interview"]
        UC13["Receive Fictional Corporate Offers"]
        UC14["Commit Verified Trophy to GitHub README"]
    end

    Cadet --> UC1
    Cadet --> UC2
    Cadet --> UC3
    Cadet --> UC4
    Cadet --> UC5
    Cadet --> UC6
    Cadet --> UC7
    Cadet --> UC8
    Cadet --> UC9
    Cadet --> UC10
    Cadet --> UC11
    Cadet --> UC12
    Cadet --> UC13
    Cadet --> UC14
```

---

## 3. Activity Diagram (Submission Pipeline)

Models the execution steps inside `chamber_engine.process_chamber_submission_pipeline`.

```mermaid
stateDiagram-v2
    [*] --> IngestSubmission
    IngestSubmission --> CheckInputLimits: Validate Size <= 20 KB
    CheckInputLimits --> CheckActiveState: Chamber is in EVALUATING state

    CheckActiveState --> RunASTAnalysis: AST parse player code
    state RunASTAnalysis {
        CheckSecurityBlacklist --> DetectLoopDepths
        DetectLoopDepths --> CalculateCleanliness
        CalculateCleanliness --> EstimateBigO
    }

    RunASTAnalysis --> BuildTestHarness: Append __NEXUS_EVAL__ harness
    BuildTestHarness --> DispatchJudge0: Send batch to Judge0 container
    DispatchJudge0 --> AwaitBatchResults: Async HTTP poll / mock batch

    AwaitBatchResults --> ParseHarnessMarker: Extract __NEXUS_EVAL__ JSON
    ParseHarnessMarker --> CompareOutputs: Compare actual vs hidden test expectations

    state DecisionFork <<choice>>
    CompareOutputs --> DecisionFork

    DecisionFork --> HandlePass: All Tests Passed
    DecisionFork --> HandleFail: >= 1 Test Failed

    state HandlePass {
        CalculateNXP --> RecordLedgerRow
        RecordLedgerRow --> IncrementStreak
        IncrementStreak --> RecalculateMatrixAxes
        RecalculateMatrixAxes --> UnlockNextChamber
    }

    state HandleFail {
        ResetStreak --> RecordFailedAttempt
    }

    HandlePass --> BroadcastWebSocket
    HandleFail --> BroadcastWebSocket
    BroadcastWebSocket --> [*]
```

---

## 4. State Diagram (Chamber Lifecycle)

Illustrates the server-controlled lifecycle states for Chambers 1 through 6.

```mermaid
stateDiagram-v2
    [*] --> LOCKED: On cadet initialization (Chambers 2-6)
    [*] --> UNLOCKED: Initial state for Chamber 1

    LOCKED --> UNLOCKED: Previous Chamber transitions to PASSED

    UNLOCKED --> PREPARING: POST /chambers/{n}/prepare
    PREPARING --> ACTIVE: POST /chambers/{n}/enter (Starts countdown)
    UNLOCKED --> ACTIVE: Direct entry allowed

    ACTIVE --> EVALUATING: POST /chambers/{n}/submit
    ACTIVE --> FAILED: Timer expires (Deadline passed)

    EVALUATING --> PASSED: All hidden test vectors pass
    EVALUATING --> FAILED: Test assertion failure or runtime exception

    FAILED --> ACTIVE: Re-enter chamber (Retry allowed)

    state Chamber6_Finale {
        PASSED --> ROUND_1_CODING: Coding challenge
        ROUND_1_CODING --> ROUND_2_QUIZ: Pass coding
        ROUND_2_QUIZ --> ROUND_3_DESIGN: Complete 5 complexity MCQs
        ROUND_3_DESIGN --> COMPLETED: Score >= 70 overall
    }

    COMPLETED --> [*]: Bids unlocked & Trophy claimable
```

---

## 5. Sequence Diagram (Single Chamber Attempt)

Chronological message flow from cadet submission through evaluation, database persistence, and WebSocket push notification.

```mermaid
sequenceDiagram
    autonumber
    actor Cadet as Cadet (Frontend)
    participant API as FastAPI (main.py)
    participant Engine as chamber_engine.py
    participant Evaluator as evaluator.py
    participant Judge as judge0.py
    participant NXP as nxp.py
    participant DB as SQLite (database.py)
    participant WS as WebSocket Hub (ws.py)

    Cadet->>API: POST /chambers/1/submit {code, language}
    API->>API: Verify Auth & Rate Limit
    API->>Engine: record_chamber_submission(user_id, 1, code)
    Engine->>DB: Set state = EVALUATING
    Engine->>WS: Broadcast {type: "state", state: "EVALUATING"}
    WS-->>Cadet: Render spinner / evaluate status
    API-->>Cadet: 202 Accepted {state: "EVALUATING"}

    rect rgb(20, 25, 35)
        Note over Engine,Judge: Async Pipeline Execution
        Engine->>Evaluator: evaluate_code_ast(code, expected="O(n)")
        Evaluator-->>Engine: {complexity: "O(n)", cleanliness: 92, inefficient: false}

        Engine->>Judge: execute_batch(submissions)
        Judge-->>Engine: [{stdout: "__NEXUS_EVAL__:{\"result\": 2}"}, ...]

        Engine->>Engine: Compare outputs against hidden_tests
        Note over Engine: All tests PASSED
        Engine->>NXP: calculate_nxp(chamber=1, clean=92, first_try=True, streak=0)
        NXP-->>Engine: points = 143

        Engine->>DB: record_nxp_ledger(points=143, streak=1)
        Engine->>DB: update_matrix_history(dsa=75, sys=60, clean=92)
        Engine->>DB: set_chamber_state(1, "PASSED")
        Engine->>DB: set_chamber_state(2, "UNLOCKED")
    end

    Engine->>WS: Broadcast {type: "progress", state: "PASSED", nxp: 143}
    WS-->>Cadet: Receive progress event (Play victory SFX, show Matrix delta)
```

---

## 6. Class Diagram

Object hierarchy, model relationships, and domain contracts implemented in the system.

```mermaid
classDiagram
    class UserProfile {
        +int id
        +string github_username
        +string avatar_url
        +int current_chamber
        +int total_nxp
        +int current_streak
        +int best_streak
        +int dsa_score
        +int system_design_score
        +int cleanliness_score
        +bool intro_seen
        +bool onboarding_complete
    }

    class ChamberAttempt {
        +int id
        +int user_id
        +int chamber_no
        +string challenge_id
        +string code
        +bool passed
        +float runtime_ms
        +string complexity_label
        +int cleanliness_score
        +datetime created_at
    }

    class NxpLedgerEntry {
        +int id
        +int user_id
        +int chamber_no
        +int attempt_id
        +int points
        +int streak_after
        +string reason
        +datetime created_at
    }

    class MatrixHistoryEntry {
        +int id
        +int user_id
        +int dsa
        +int system_design
        +int cleanliness
        +int total_nxp
        +datetime recorded_at
    }

    class GitHubTrophyClient {
        -string token
        -string username
        +get_profile_readme() dict
        +generate_trophy_markdown(tier, nxp) string
        +commit_trophy_badge(branch) dict
    }

    class ASTEvaluator {
        +evaluate_code_ast(code, expected) dict
        -estimate_complexity(tree) string
        -calculate_cleanliness(code) int
        -check_forbidden_syntax(tree) list
    }

    class BidsEngine {
        +calculate_cadet_metrics(history) dict
        +classify_coding_style(metrics) string
        +generate_company_bids(style, metrics) list
    }

    UserProfile "1" --> "*" ChamberAttempt : has
    UserProfile "1" --> "*" NxpLedgerEntry : earns
    UserProfile "1" --> "*" MatrixHistoryEntry : tracks
    ChamberAttempt ..> ASTEvaluator : inspected by
    NxpLedgerEntry ..> ChamberAttempt : awarded for
    UserProfile ..> BidsEngine : analyzed by
    UserProfile ..> GitHubTrophyClient : claims badge with
```
