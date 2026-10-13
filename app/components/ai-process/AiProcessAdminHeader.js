import { aiKrw, aiSignedKrw } from "../../lib/ai-process-utils";

export default function AiProcessAdminHeader({ sessions = [] }) {
  const runningSessions = sessions.filter((item) => item.status === "running");
  const totalOperatingAmount = runningSessions.reduce(
    (sum, item) => sum + Number(item.current_amount || 0),
    0,
  );
  const totalProfit = sessions.reduce(
    (sum, item) => sum + Number(item.total_profit || 0),
    0,
  );

  return (
    <section className="ai-v51-admin-hero">
      <div className="ai-v51-admin-hero-copy">
        <span className="ai-v51-kicker">AI PROCESS ADMIN</span>
        <h2>AI PROCESS 운영</h2>
        <p>회원별 운용 상태와 금액을 한 화면에서 관리합니다.</p>
      </div>
      <div className="ai-v51-admin-overview">
        <div><span>진행 중</span><strong>{runningSessions.length}</strong><small>명</small></div>
        <div><span>총 운용금액</span><strong>{aiKrw(totalOperatingAmount)}</strong></div>
        <div><span>누적 손익</span><strong className={totalProfit >= 0 ? "is-profit" : "is-loss"}>{aiSignedKrw(totalProfit)}</strong></div>
      </div>
    </section>
  );
}
