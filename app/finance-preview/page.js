import styles from './finance-preview.module.css';

const recent = [
  ['10:42','AI 분석 반영','+128,400원'],
  ['10:39','매수 구간 탐색','+74,200원'],
  ['10:36','포지션 관리','+96,800원'],
];

export default function FinancePreview(){
  return <main className={styles.page}>
    <div className={styles.phone}>
      <header className={styles.header}>
        <div><small>VIP MEMBER</small><b>AI PROCESS</b></div>
        <button aria-label="내 정보">○</button>
      </header>

      <section className={styles.balance}>
        <div className={styles.label}>총 평가금액 <span>RUNNING</span></div>
        <strong>46,813,484원</strong>
        <p><b>+40,643,484원</b><span>+658.73%</span></p>
      </section>

      <section className={styles.process}>
        <div className={styles.sectionHead}><div><small>AI PROCESS</small><h2>자산 운용 진행 중</h2></div><b>72%</b></div>
        <div className={styles.progress}><i /></div>
        <div className={styles.meta}><span>투자금 <b>6,170,000원</b></span><span>남은 시간 <b>8일 4시간</b></span></div>
      </section>

      <section className={styles.chartSection}>
        <div className={styles.sectionHead}><h2>평가금액 추이</h2><button>전체</button></div>
        <div className={styles.chart} aria-label="평가금액 추이 예시 그래프">
          <svg viewBox="0 0 360 140" preserveAspectRatio="none"><polyline points="0,124 28,119 55,121 82,106 110,110 137,92 165,96 192,76 220,82 247,55 275,61 302,38 330,43 360,17" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke"/></svg>
        </div>
        <div className={styles.axis}><span>시작</span><span>현재</span></div>
      </section>

      <section className={styles.activity}>
        <div className={styles.sectionHead}><h2>최근 반영</h2><button>전체보기</button></div>
        {recent.map(([time,title,amount])=><div className={styles.row} key={time}><time>{time}</time><span>{title}</span><b>{amount}</b></div>)}
      </section>

      <section className={styles.market}>
        <div className={styles.sectionHead}><h2>AI 트레이딩 현황</h2><span>실시간 분석</span></div>
        <div className={styles.marketRow}><div><small>STOCK</small><b>NVIDIA</b></div><span>포지션 관리</span></div>
        <div className={styles.marketRow}><div><small>COIN</small><b>Bitcoin</b></div><span>매수 구간 탐색</span></div>
      </section>

      <nav className={styles.nav}><b>홈</b><span>이벤트</span><span>AI PROCESS</span><span>지급센터</span><span>내 정보</span></nav>
    </div>
  </main>
}
