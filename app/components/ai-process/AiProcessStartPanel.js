"use client";

export default function AiProcessStartPanel({
  members = [],
  memberId,
  setMemberId,
  amount,
  setAmount,
  durationHours,
  setDurationHours,
  indefinite,
  setIndefinite,
  working,
  onStart,
}) {
  return (
    <section className="ai-v2-admin-console ai-v51-admin-console">
      <div className="ai-v2-admin-head">
        <div>
          <span>NEW PROCESS</span>
          <strong>새 AI PROCESS 시작</strong>
          <p>회원과 운용금액, 진행기간을 지정하면 즉시 시작됩니다.</p>
        </div>
        <small>최소 1시간 · 최대 30일</small>
      </div>

      <div className="ai-v2-admin-form">
        <select value={memberId} onChange={(e) => setMemberId(e.target.value)}>
          <option value="">회원 선택</option>
          {members.map((member) => (
            <option key={member.member_id} value={member.member_id}>
              {member.nickname}
              {member.account_type === "ai_character"
                ? " · AI"
                : member.account_type === "managed"
                  ? " · 가라"
                  : ""}
            </option>
          ))}
        </select>

        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))}
          inputMode="numeric"
          placeholder="운용금액"
        />

        <div className="ai-v2-duration-control">
          <div className="ai-v2-duration-tabs">
            <button
              type="button"
              className={!indefinite ? "is-active" : ""}
              onClick={() => setIndefinite(false)}
            >
              시간 지정
            </button>
            <button
              type="button"
              className={indefinite ? "is-active" : ""}
              onClick={() => setIndefinite(true)}
            >
              기간 미정
            </button>
          </div>

          {!indefinite ? (
            <input
              value={durationHours}
              onChange={(e) => setDurationHours(e.target.value.replace(/[^0-9]/g, ""))}
              inputMode="numeric"
              placeholder="진행 시간"
            />
          ) : (
            <div className="ai-v2-indefinite-label">
              <b>∞ 기간 미정</b>
              <span>관리자가 종료할 때까지 진행</span>
            </div>
          )}
        </div>

        <button type="button" onClick={onStart} disabled={working || !memberId}>
          {working ? "처리 중" : "PROCESS START"}
        </button>
      </div>
    </section>
  );
}
