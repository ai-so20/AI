import Link from "next/link";
import styles from "./PageLinks.module.css";

function ArrowLeft(){
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14.5 5.5-6.5 6.5 6.5 6.5"/></svg>;
}
function ActionIcon({type}){
  if(type==="calendar")return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M8 3v4m8-4v4M3.5 10h17m-12 6 2.5 2.5 4.8-5"/></svg>;
  if(type==="event")return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v5a2 2 0 0 0 0 4v5H4v-5a2 2 0 0 0 0-4V5Z"/><path d="M12 5v14" strokeDasharray="2 3"/></svg>;
  if(type==="gift")return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M2.5 7h19v5h-19zM12 7v14M12 7c-6-1-6-6-3-6 2 0 3 3 3 6Zm0 0c6-1 6-6 3-6-2 0-3 3-3 6Z"/></svg>;
  if(type==="admin")return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 4 7v5c0 5 3 8.5 8 10 5-1.5 8-5 8-10V7z"/><path d="m9 12 2 2 4-4"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8 12h8m-3-3 3 3-3 3"/></svg>;
}

export function HomeReturnLink({label="홈",href="/design-home"}){
  return <Link href={href} className={styles.home} aria-label="홈으로 돌아가기">
    <span className={styles.homeIcon}><ArrowLeft/></span>
    <span className={styles.homeLabel}>{label}</span>
  </Link>;
}
export function PageActionLink({href,label,detail,icon="arrow"}){
  return <Link href={href} className={styles.action}>
    <span className={styles.actionIcon}><ActionIcon type={icon}/></span>
    <span className={styles.actionCopy}><strong>{label}</strong>{detail&&<small>{detail}</small>}</span>
    <span className={styles.actionChevron} aria-hidden="true">›</span>
  </Link>;
}
