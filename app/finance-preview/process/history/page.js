import styles from './history-preview.module.css';

const rows=[
['10:42','AI 분석 반영','평가금액 반영','+128,400원','46,813,484원'],
['10:39','매수 구간 탐색','NVIDIA · STOCK','+74,200원','46,685,084원'],
['10:36','포지션 관리','Bitcoin · COIN','+96,800원','46,610,884원'],
['10:33','AI 분석 반영','평가금액 반영','-21,300원','46,514,084원'],
['10:30','매수 조건 확인','NVIDIA · STOCK','+82,600원','46,535,384원'],
['10:27','가격 구간 분석','Bitcoin · COIN','+61,200원','46,452,784원'],
];

export default function HistoryPreview(){return <main className={styles.page}><div className={styles.phone}>
<header className={styles.header}><span>‹</span><b>반영 내역</b><i/></header>
<section className={styles.top}><h1>최근 반영 내역</h1><p>AI PROCESS 진행 중 평가금액에 반영된 내역입니다.</p><div className={styles.filters}><b>전체</b><span>수익</span><span>손실</span></div></section>
<section className={styles.list}>{rows.map(([time,title,detail,delta,total])=><article className={styles.row} key={time}><time>{time}</time><div className={styles.info}><b>{title}</b><small>{detail}</small><em>반영 후 {total}</em></div><strong className={delta.startsWith('-')?styles.loss:''}>{delta}</strong></article>)}</section>
</div></main>}
