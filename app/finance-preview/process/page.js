import styles from './process-preview.module.css';

const history = [
  ['10:42','AI 분석 반영','평가금액 반영','+128,400원'],
  ['10:39','매수 구간 탐색','NVIDIA · STOCK','+74,200원'],
  ['10:36','포지션 관리','Bitcoin · COIN','+96,800원'],
];

export default function ProcessPreview(){
  return <main className={styles.page}>
    <div className={styles.phone}>
      <header className={styles.header}><span>‹</span><b>AI PROCESS</b><i /></header>

      <section className={styles.hero}>
        <div className={styles.status}><span>RUNNING</span></div>
        <div className={styles.heroLabel}>현재 평가금액</div>
        <strong>46,813,484<span>원</span></strong>
        <div className={styles.profit}><b>+40,643,484원</b><span>+658.73%</span></div>
        <div className={styles.progress}><i /></div>
        <div className={styles.progressMeta}><span>진행률 <b>72%</b></span><span>남은 시간 <b>8일 4시간</b></span></div>
      </section>

      <section className={styles.summary}>
        <div><span>투자금</span><b>6,170,000원</b></div>
        <div><span>시작일</span><b>2026.10.05</b></div>
        <div><span>종료 예정</span><b>2026.11.10</b></div>
      </section>

      <section className={styles.section}>
        <div className={styles.head}><h2>PROCESS 진행</h2><em>관리 단계</em></div>
        <div className={styles.processLine}><div><b>AI 자산 관리</b><span>분석과 매수 판단 이후 포지션 관리가 진행 중입니다.</span></div><strong>진행 중</strong></div>
      </section>

      <section className={styles.section}>
        <div className={styles.head}><h2>평가금액 추이</h2><span>전체 기간</span></div>
        <div className={styles.chartValue}><b>46,813,484원</b><span>+658.73%</span></div>
        <div className={styles.chart}><svg viewBox="0 0 360 140" preserveAspectRatio="none"><polyline points="0,124 28,119 55,121 82,106 110,110 137,92 165,96 192,76 220,82 247,55 275,61 302,38 330,43 360,17" fill="none" stroke="currentColor" strokeWidth="2.2" vectorEffect="non-scaling-stroke"/></svg></div>
        <div className={styles.axis}><span>시작</span><span>현재</span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.head}><h2>AI 트레이딩 현황</h2><em>실시간 분석</em></div>
        <div className={styles.asset}><div><small>STOCK</small><b>NVIDIA</b><p>시장 흐름 분석 · 포지션 관리</p></div><span>포지션 관리</span></div>
        <div className={styles.asset}><div><small>COIN</small><b>Bitcoin</b><p>가격 구간 분석 · 매수 조건 탐색</p></div><span>매수 구간 탐색</span></div>
      </section>

      <section className={styles.section}>
        <div className={styles.head}><h2>최근 반영</h2><span>전체보기</span></div>
        <div className={styles.history}>{history.map(([time,title,detail,amount])=><div className={styles.row} key={time}><time>{time}</time><div><b>{title}</b><small>{detail}</small></div><strong>{amount}</strong></div>)}</div>
      </section>
    </div>
  </main>
}
