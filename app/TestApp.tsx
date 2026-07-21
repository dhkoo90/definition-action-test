"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import testData from "./data/test-data.json";

type TestMode = "preview" | "full";
type Screen = "intro" | "test" | "result";

type ResponseValue = {
  actionId: string;
  uncertain: boolean;
  note: string;
};

type Session = {
  version: string;
  mode: TestMode;
  order: string[];
  responses: Record<string, ResponseValue>;
  currentIndex: number;
  submittedAt?: string;
};

type ActionOption = {
  id: string;
  name: string;
  definition: string;
  subjects: string[];
  keyTerms: string[];
  criteriaStatus?: string;
};

const STORAGE_KEY = `definition-action-test:${testData.meta.version}`;
const PREVIEW_QUESTION_COUNT = 12;

const questionById = new Map(testData.questions.map((question) => [question.id, question]));

const actionOptions: ActionOption[] = [
  ...testData.actions.map((action) => ({
    id: action.id,
    name: action.name,
    definition: action.definition,
    subjects: action.subjects,
    keyTerms: action.keyTerms,
    criteriaStatus: action.criteriaStatus,
  })),
  ...testData.specialChoices.map((action) => ({
    id: action.id,
    name: action.name,
    definition: action.definition,
    subjects: [] as string[],
    keyTerms: [] as string[],
    criteriaStatus: "메타 선택",
  })),
].sort((a, b) => a.name.localeCompare(b.name, "ko"));

const actionById = new Map(actionOptions.map((action) => [action.id, action]));
const sourceActionById = new Map(testData.actions.map((action) => [action.id, action]));

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function isComplete(response?: ResponseValue) {
  return Boolean(response?.actionId);
}

function normalizeSession(session: Session): Session {
  return {
    ...session,
    responses: Object.fromEntries(
      Object.entries(session.responses ?? {}).map(([questionId, response]) => [
        questionId,
        {
          actionId: response?.actionId ?? "",
          uncertain: Boolean(response?.uncertain),
          note: response?.note ?? "",
        },
      ]),
    ),
  };
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function escapeCsv(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function TestApp() {
  const [screen, setScreen] = useState<Screen>("intro");
  const [session, setSession] = useState<Session | null>(null);
  const [savedSession, setSavedSession] = useState<Session | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeOptionIndex, setActiveOptionIndex] = useState(0);
  const [notice, setNotice] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Session;
      if (parsed.version === testData.meta.version && parsed.order.length > 0) {
        setSavedSession(normalizeSession(parsed));
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    setSavedSession(session);
  }, [session]);

  useEffect(() => {
    if (!pickerOpen) return;
    setSearchTerm("");
    setActiveOptionIndex(0);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  }, [pickerOpen]);

  const normalizedSearch = searchTerm.trim().normalize("NFKC").toLocaleLowerCase("ko");
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return actionOptions;
    return actionOptions.filter((action) => {
      const searchable = [
        action.name,
        action.definition,
        ...action.subjects,
        ...action.keyTerms,
      ]
        .join(" ")
        .normalize("NFKC")
        .toLocaleLowerCase("ko");
      return searchable.includes(normalizedSearch);
    });
  }, [normalizedSearch]);

  useEffect(() => {
    setActiveOptionIndex(0);
  }, [normalizedSearch]);

  const currentQuestion = session
    ? questionById.get(session.order[session.currentIndex])
    : undefined;
  const currentResponse = currentQuestion ? session?.responses[currentQuestion.id] : undefined;
  const answeredCount = session
    ? session.order.filter((questionId) => isComplete(session.responses[questionId])).length
    : 0;
  const progress = session ? answeredCount / session.order.length : 0;
  const selectedAction = currentResponse?.actionId
    ? actionById.get(currentResponse.actionId)
    : undefined;

  const results = useMemo(() => {
    if (!session) return null;
    const rows = session.order.map((questionId) => {
      const question = questionById.get(questionId)!;
      const response = session.responses[questionId];
      return {
        question,
        response,
        correct: response?.actionId === question.answerActionId,
      };
    });
    const correctCount = rows.filter((row) => row.correct).length;
    const uncertainCount = rows.filter((row) => row.response?.uncertain).length;
    const byAction = testData.actions
      .map((action) => {
        const actionRows = rows.filter((row) => row.question.sourceActionId === action.id);
        const actionCorrect = actionRows.filter((row) => row.correct).length;
        return {
          id: action.id,
          name: action.name,
          total: actionRows.length,
          correct: actionCorrect,
          accuracy: actionRows.length ? actionCorrect / actionRows.length : 0,
        };
      })
      .filter((action) => action.total > 0)
      .sort((a, b) => a.accuracy - b.accuracy || a.name.localeCompare(b.name, "ko"));
    return {
      rows,
      correctCount,
      accuracy: rows.length ? correctCount / rows.length : 0,
      uncertainCount,
      byAction,
      passed:
        session.mode === "full" &&
        rows.every((row) => isComplete(row.response)) &&
        correctCount / rows.length >= testData.meta.passThreshold,
    };
  }, [session]);

  function startTest(mode: TestMode) {
    const shuffledIds = shuffle(testData.questions.map((question) => question.id));
    const order = mode === "preview" ? shuffledIds.slice(0, PREVIEW_QUESTION_COUNT) : shuffledIds;
    const nextSession: Session = {
      version: testData.meta.version,
      mode,
      order,
      responses: {},
      currentIndex: 0,
    };
    setSession(nextSession);
    setScreen("test");
    setNotice("");
  }

  function continueSavedTest() {
    if (!savedSession) return;
    setSession(savedSession);
    setScreen(savedSession.submittedAt ? "result" : "test");
  }

  function updateCurrentResponse(patch: Partial<ResponseValue>) {
    if (!session || !currentQuestion) return;
    const previous = session.responses[currentQuestion.id] ?? {
      actionId: "",
      uncertain: false,
      note: "",
    };
    setSession({
      ...session,
      responses: {
        ...session.responses,
        [currentQuestion.id]: { ...previous, ...patch },
      },
    });
  }

  function chooseAction(action: ActionOption) {
    updateCurrentResponse({ actionId: action.id });
    setPickerOpen(false);
    setNotice("");
  }

  function goToQuestion(index: number) {
    if (!session) return;
    setSession({
      ...session,
      currentIndex: Math.max(0, Math.min(index, session.order.length - 1)),
    });
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goToFirstIncomplete() {
    if (!session) return;
    const index = session.order.findIndex((questionId) => !isComplete(session.responses[questionId]));
    if (index >= 0) goToQuestion(index);
  }

  function submitTest() {
    if (!session) return;
    const firstIncomplete = session.order.findIndex(
      (questionId) => !isComplete(session.responses[questionId]),
    );
    if (firstIncomplete >= 0) {
      goToQuestion(firstIncomplete);
      setNotice("행위를 선택하지 않은 문항이 있어 해당 문항으로 이동했습니다.");
      return;
    }
    const completedSession = { ...session, submittedAt: new Date().toISOString() };
    setSession(completedSession);
    setScreen("result");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetTest() {
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    setSavedSession(null);
    setScreen("intro");
    setNotice("");
  }

  function downloadResults() {
    if (!session || !results) return;
    const headers = [
      "문항 ID",
      "상황 사례",
      "내 답",
      "정답",
      "결과",
      "헷갈림 표시",
      "판단 근거",
      "메모",
    ];
    const lines = [headers.map(escapeCsv).join(",")];
    for (const row of results.rows) {
      lines.push(
        [
          row.question.id,
          row.question.scenario,
          actionById.get(row.response?.actionId ?? "")?.name ?? "",
          actionById.get(row.question.answerActionId)?.name ?? "",
          row.correct ? "정답" : "오답",
          row.response?.uncertain ? "예" : "",
          row.question.rationale,
          row.response?.note ?? "",
        ]
          .map(escapeCsv)
          .join(","),
      );
    }
    const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `행위-정의-판별-결과-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handlePickerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!filteredOptions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveOptionIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveOptionIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      chooseAction(filteredOptions[activeOptionIndex]);
    } else if (event.key === "Escape") {
      setPickerOpen(false);
    }
  }

  if (screen === "intro") {
    return (
      <main className="intro-shell">
        <header className="site-header">
          <a className="brand" href="#top" aria-label="행위 정의 판별 테스트 홈">
            <span className="brand-mark">기준</span>
            <span>Definition Check</span>
          </a>
          <span className="version-badge">초안 · {testData.meta.version}</span>
        </header>

        <section className="hero" id="top">
          <div className="hero-copy">
            <p className="eyebrow">정의 기준을 사례로 검증하는 블라인드 테스트</p>
            <h1>
              이 상황을 가장 잘 표현하는
              <br />
              행위는 무엇인가요?
            </h1>
            <p className="hero-description">
              상황 사례만 읽고 전체 행위 목록에서 하나를 선택합니다. 결과를 통해 내가 가진 정의
              기준이 실제 사례에서도 일관되게 작동하는지 확인할 수 있습니다.
            </p>

            <div className="hero-actions">
              <button className="button button-primary" onClick={() => startTest("preview")}>
                빠른 체험 시작
                <span>12문항</span>
              </button>
              <button className="button button-secondary" onClick={() => startTest("full")}>
                전체 테스트 시작
                <span>216문항</span>
              </button>
            </div>

            {savedSession && (
              <div className="resume-card">
                <div>
                  <strong>{savedSession.submittedAt ? "완료한 결과가 있습니다" : "진행 중인 테스트가 있습니다"}</strong>
                  <span>
                    {savedSession.mode === "full" ? "전체 테스트" : "빠른 체험"} ·{" "}
                    {savedSession.order.filter((id) => isComplete(savedSession.responses[id])).length}/
                    {savedSession.order.length} 응답
                  </span>
                </div>
                <button className="text-button" onClick={continueSavedTest}>
                  {savedSession.submittedAt ? "결과 보기" : "이어서 하기"} →
                </button>
              </div>
            )}
          </div>

          <aside className="hero-panel" aria-label="테스트 구성">
            <div className="panel-kicker">TEST STRUCTURE</div>
            <div className="stat-row">
              <strong>{testData.meta.actionCount}</strong>
              <span>검증 대상 행위</span>
            </div>
            <div className="stat-row">
              <strong>{testData.meta.questionCount}</strong>
              <span>혼합된 상황 사례</span>
            </div>
            <div className="stat-row">
              <strong>{percent(testData.meta.passThreshold)}</strong>
              <span>전체 테스트 통과 기준</span>
            </div>
            <div className="panel-note">
              <span className="note-dot" />
              정답과 판단 근거는 제출 후 공개됩니다.
            </div>
          </aside>
        </section>

        <section className="how-section" aria-labelledby="how-title">
          <div>
            <p className="eyebrow">HOW IT WORKS</p>
            <h2 id="how-title">선택은 넓게, 판단은 선명하게</h2>
          </div>
          <ol className="step-list">
            <li><span>01</span><div><strong>상황을 읽습니다</strong><p>행위명에 대한 단서 없이 사례 자체에 집중합니다.</p></div></li>
            <li><span>02</span><div><strong>행위를 검색합니다</strong><p>행위명이나 정의에 포함된 말로 전체 목록을 빠르게 좁힙니다.</p></div></li>
            <li><span>03</span><div><strong>결과를 검토합니다</strong><p>행위별 정확도와 헷갈렸다고 표시한 문제부터 확인합니다.</p></div></li>
          </ol>
        </section>

        <footer className="site-footer">
          <span>Definition Check · 공개 초안</span>
          <a href="./data/test-data.json" download>테스트 데이터 JSON 받기</a>
        </footer>
      </main>
    );
  }

  if (!session || !currentQuestion) return null;

  if (screen === "result" && results) {
    const wrongRows = results.rows
      .filter((row) => !row.correct)
      .sort((a, b) => Number(Boolean(b.response?.uncertain)) - Number(Boolean(a.response?.uncertain)));
    return (
      <main className="result-shell">
        <header className="compact-header">
          <div className="brand"><span className="brand-mark">기준</span><span>Definition Check</span></div>
          <button className="text-button" onClick={() => setScreen("test")}>내 응답 다시 보기</button>
        </header>

        <section className={`result-hero ${results.passed ? "is-passed" : ""}`}>
          <p className="eyebrow">{session.mode === "full" ? "전체 테스트 결과" : "빠른 체험 결과"}</p>
          <div className="score-line">
            <strong>{percent(results.accuracy)}</strong>
            <span>{results.correctCount} / {session.order.length} 정답</span>
          </div>
          <h1>
            {session.mode === "preview"
              ? "화면과 선택 방식을 체험했습니다."
              : results.passed
                ? "통과 기준을 충족했습니다."
                : "정의 기준을 조금 더 보완해보세요."}
          </h1>
          <p>
            {session.mode === "preview"
              ? "빠른 체험 점수는 참고용입니다. 전체 테스트를 완료해야 단계 진입 기준을 판정합니다."
              : `통과 기준은 ${percent(testData.meta.passThreshold)}이며, 헷갈렸다고 표시한 오답부터 검토하는 것을 권장합니다.`}
          </p>
        </section>

        <section className="result-metrics" aria-label="결과 요약">
          <article><span>전체 정확도</span><strong>{percent(results.accuracy)}</strong></article>
          <article><span>오답 문항</span><strong>{wrongRows.length}</strong></article>
          <article>
            <span>{session.mode === "preview" ? "응답 완료" : "헷갈린 문항"}</span>
            <strong>{session.mode === "preview" ? `${answeredCount}/${session.order.length}` : results.uncertainCount}</strong>
          </article>
          <article><span>판정</span><strong>{session.mode === "preview" ? "참고용" : results.passed ? "통과" : "보완 필요"}</strong></article>
        </section>

        <div className="result-grid">
          <section className="result-card" aria-labelledby="action-result-title">
            <div className="section-heading">
              <div><p className="eyebrow">BY ACTION</p><h2 id="action-result-title">행위별 정확도</h2></div>
              <span>낮은 정확도 순</span>
            </div>
            <div className="action-result-list">
              {results.byAction.map((action) => (
                <div className="action-result-row" key={action.id}>
                  <div><strong>{action.name}</strong><span>{action.correct}/{action.total} 정답</span></div>
                  <div className="mini-progress" aria-label={`${action.name} 정확도 ${percent(action.accuracy)}`}>
                    <span style={{ width: percent(action.accuracy) }} />
                  </div>
                  <strong>{percent(action.accuracy)}</strong>
                </div>
              ))}
            </div>
          </section>

          <section className="result-card" aria-labelledby="wrong-title">
            <div className="section-heading">
              <div><p className="eyebrow">REVIEW</p><h2 id="wrong-title">오답 검토</h2></div>
              <span>{wrongRows.length}개</span>
            </div>
            {wrongRows.length === 0 ? (
              <div className="empty-result">모든 문항에 정답을 선택했습니다.</div>
            ) : (
              <div className="wrong-list">
                {wrongRows.map((row) => (
                  <details key={row.question.id}>
                    <summary>
                      <span>{row.question.id}</span>
                      <strong>{row.question.scenario}</strong>
                    </summary>
                    <div className="wrong-detail">
                      <dl>
                        <div><dt>내 답</dt><dd>{actionById.get(row.response?.actionId ?? "")?.name ?? "미응답"}</dd></div>
                        <div><dt>정답</dt><dd>{actionById.get(row.question.answerActionId)?.name}</dd></div>
                        {session.mode === "full" && (
                          <div><dt>헷갈림</dt><dd>{row.response?.uncertain ? "표시함" : "-"}</dd></div>
                        )}
                      </dl>
                      <p><strong>판단 근거</strong>{row.question.rationale}</p>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="result-actions">
          <button className="button button-primary" onClick={() => startTest("full")}>전체 테스트 새로 시작</button>
          <button className="button button-secondary" onClick={downloadResults}>결과 CSV 받기</button>
          <button className="text-button danger" onClick={resetTest}>저장된 기록 지우기</button>
        </section>
      </main>
    );
  }

  return (
    <main className="test-shell">
      <header className="test-header">
        <div className="brand"><span className="brand-mark">기준</span><span>Definition Check</span></div>
        <div className="header-progress">
          <span>{session.mode === "full" ? "전체 테스트" : "빠른 체험"}</span>
          <strong>{answeredCount} / {session.order.length} 응답</strong>
        </div>
        <button className="text-button" onClick={() => setScreen("intro")}>나가기</button>
      </header>

      <div className="global-progress" aria-hidden="true"><span style={{ width: percent(progress) }} /></div>

      <div className="test-layout">
        <aside className="test-sidebar">
          <p className="eyebrow">PROGRESS</p>
          <strong className="progress-number">{percent(progress)}</strong>
          <span className="progress-copy">{answeredCount}개 응답 완료</span>
          <button className="sidebar-button" onClick={goToFirstIncomplete} disabled={answeredCount === session.order.length}>
            첫 미응답으로 이동
          </button>
          <details className="question-map">
            <summary>문항 목록 펼치기</summary>
            <div className="question-grid">
              {session.order.map((questionId, index) => (
                <button
                  key={questionId}
                  className={`${index === session.currentIndex ? "is-current" : ""} ${isComplete(session.responses[questionId]) ? "is-complete" : ""}`}
                  onClick={() => goToQuestion(index)}
                  aria-label={`${index + 1}번 문항${isComplete(session.responses[questionId]) ? " 응답 완료" : " 미응답"}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </details>
          <div className="sidebar-note"><span>자동 저장 중</span><p>이 브라우저에서는 페이지를 닫아도 이어서 할 수 있습니다.</p></div>
        </aside>

        <section className="question-area" aria-labelledby="question-title">
          {notice && <div className="notice" role="status">{notice}</div>}
          <div className="question-meta">
            <span>QUESTION {String(session.currentIndex + 1).padStart(3, "0")}</span>
            <span>{currentQuestion.id}</span>
          </div>
          <h1 id="question-title">{currentQuestion.scenario}</h1>
          <p className="question-prompt">이 상황을 가장 잘 표현하는 행위 하나를 선택하세요.</p>

          <div className="field-group">
            <label>행위 선택</label>
            <button
              className={`action-picker-trigger ${selectedAction ? "has-value" : ""}`}
              onClick={() => setPickerOpen(true)}
              aria-haspopup="dialog"
            >
              {selectedAction ? (
                <><span><strong>{selectedAction.name}</strong><small>{selectedAction.definition}</small></span><b>변경</b></>
              ) : (
                <><span><strong>행위명 또는 정의로 검색</strong><small>전체 54개 행위와 판정불가 중에서 선택</small></span><b>검색</b></>
              )}
            </button>
          </div>

          {session.mode === "full" && (
            <div className="uncertainty-field">
              <label className={`uncertainty-toggle ${currentResponse?.uncertain ? "is-selected" : ""}`}>
                <input
                  type="checkbox"
                  checked={Boolean(currentResponse?.uncertain)}
                  onChange={(event) => updateCurrentResponse({ uncertain: event.target.checked })}
                />
                <span>
                  <strong>헷갈렸음</strong>
                  <small>선택이 확실하지 않다면 표시해 두세요. 점수에는 영향을 주지 않습니다.</small>
                </span>
              </label>
            </div>
          )}

          <div className="field-group memo-field">
            <label htmlFor="memo">판단 메모 <span>선택 사항</span></label>
            <textarea
              id="memo"
              value={currentResponse?.note ?? ""}
              onChange={(event) => updateCurrentResponse({ note: event.target.value })}
              placeholder="헷갈렸던 지점이나 선택 근거를 남겨보세요."
              rows={3}
            />
          </div>

          <nav className="question-navigation" aria-label="문항 이동">
            <button className="button button-secondary" onClick={() => goToQuestion(session.currentIndex - 1)} disabled={session.currentIndex === 0}>← 이전</button>
            {session.currentIndex < session.order.length - 1 ? (
              <button className="button button-primary" onClick={() => goToQuestion(session.currentIndex + 1)} disabled={!selectedAction}>다음 문항 →</button>
            ) : (
              <button className="button button-primary" onClick={submitTest} disabled={!selectedAction}>테스트 제출</button>
            )}
          </nav>

          {session.currentIndex === session.order.length - 1 && answeredCount < session.order.length && (
            <p className="submit-hint">제출하려면 남은 {session.order.length - answeredCount}개 문항의 행위를 선택해야 합니다.</p>
          )}
        </section>
      </div>

      {pickerOpen && (
        <div className="picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerOpen(false); }}>
          <div className="picker-workspace">
            <aside className="picker-case-panel" aria-label="현재 문제 사례">
              <div className="picker-case-meta">
                <span>현재 사례</span>
                <span>{session.currentIndex + 1} / {session.order.length}</span>
              </div>
              <p>{currentQuestion.scenario}</p>
              <div className="picker-case-hint">
                <span />
                사례의 결과가 아니라, 수행된 행위 자체를 기준으로 선택하세요.
              </div>
            </aside>

            <section className="picker-dialog" role="dialog" aria-modal="true" aria-labelledby="picker-title">
              <header className="picker-header">
                <div><p className="eyebrow">ACTION FINDER</p><h2 id="picker-title">가장 적합한 행위를 찾아보세요</h2></div>
                <button className="close-button" onClick={() => setPickerOpen(false)} aria-label="행위 선택창 닫기">×</button>
              </header>
              <div className="search-wrap">
                <span aria-hidden="true">⌕</span>
                <input
                  ref={searchInputRef}
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={handlePickerKeyDown}
                  placeholder="예: 받음, 기록, 판단, 상태 변경"
                  aria-label="행위 검색"
                />
                <kbd>ESC</kbd>
              </div>
              <div className="picker-summary"><span>{filteredOptions.length}개 결과</span><span>↑ ↓ 이동 · Enter 선택</span></div>
              <div className="option-list" role="listbox" aria-label="행위 검색 결과">
                {filteredOptions.length ? filteredOptions.map((action, index) => (
                  <button
                    key={action.id}
                    className={`${index === activeOptionIndex ? "is-active" : ""} ${currentResponse?.actionId === action.id ? "is-selected" : ""}`}
                    onMouseEnter={() => setActiveOptionIndex(index)}
                    onClick={() => chooseAction(action)}
                    role="option"
                    aria-selected={currentResponse?.actionId === action.id}
                  >
                    <span className="option-name">{action.name}</span>
                    <span className="option-definition">{action.definition || "정의가 제공되지 않았습니다."}</span>
                    <span className="option-status">{action.criteriaStatus}</span>
                  </button>
                )) : (
                  <div className="empty-options"><strong>검색 결과가 없습니다.</strong><span>다른 단어나 더 짧은 표현으로 검색해보세요.</span></div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </main>
  );
}
