"use client";
import Link from "next/link";
import styles from "./MemberNav.module.css";

const links=[
  {key:"home",label:"홈",href:"/design-home"},
  {key:"event",label:"이벤트",href:"/design-event"},
  {key:"attendance",label:"출석",href:"/design-attendance"},
  {key:"ai",label:"AI PROCESS",href:"/design-ai-process"},
  {key:"reward",label:"상품 지급 센터",href:"/design-reward"},
];
const icons={
home:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
event:<><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M12 8C6 8 7 2 9 3c2 0 3 3 3 5Zm0 0c6 0 5-6 3-5-2 0-3 3-3 5Z"/></>,
attendance:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18m-12 5 2 2 4-4"/></>,
ai:<><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/><text x="8" y="15" stroke="none" fill="currentColor" fontSize="8">AI</text></>,
reward:<><path d="M4 5h16v11H9l-5 4V5Z"/><path d="m8 10 3 3 5-5"/></>
};
export default function MemberNav({current}){
  return <nav className={`${styles.nav} member-app-nav`} aria-label="하단 메뉴">
    {links.map(link=><Link key={link.key} href={link.href} aria-current={current===link.key?"page":undefined} className={styles.item}>
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[link.key]}</svg>
      <span className={styles.label}>{link.label}</span>
    </Link>)}
  </nav>
}
