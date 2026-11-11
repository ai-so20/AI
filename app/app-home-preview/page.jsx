"use client";

import {useState} from "react";
import Link from "next/link";
import styles from "./page.module.css";

const menu = [
  {key:"home",label:"홈",icon:"home"},
  {key:"event",label:"이벤트",icon:"gift"},
  {key:"attendance",label:"출석",icon:"calendar"},
  {key:"process",label:"AI PROCESS",icon:"activity"},
  {key:"reward",label:"상품 지급",icon:"package"}
];
const shortcuts = [
  {key:"process",label:"AI 상세",icon:"activity"},
  {key:"event",label:"이벤트",icon:"gift"},
  {key:"attendance",label:"출석 체크",icon:"calendar"},
  {key:"reward",label:"상품 지급",icon:"package"}
];
const markets = [
  {name:"비트코인",code:"BTC",icon:"/asset-icons/bitcoin.svg",price:"$71,842.20",rate:"+1.48%",tone:"up"},
  {name:"이더리움",code:"ETH",icon:"/asset-icons/ethereum.svg",price:"$3,420.81",rate:"-0.36%",tone:"down"},
  {name:"엔비디아",code:"NVDA",icon:"/asset-icons/nvidia.svg",price:"$184.50",rate:"+0.92%",tone:"up"},
  {name:"애플",code:"AAPL",icon:"/asset-icons/apple.svg",price:"$268.14",rate:"-0.42%",tone:"down"}
];
const chartLines = {
  "1주":"M0 134 C40 127 48 147 95 119 S149 139 191 108 S254 119 298 86 S353 102 402 72 S466 89 510 58 S568 61 640 22",
  "1개월":"M0 145 C38 145 50 130 90 136 S154 112 190 122 S256 98 290 113 S355 91 400 93 S472 58 513 74 S564 48 640 22",
  "3개월":"M0 149 C49 148 52 129 100 140 S177 116 214 120 S276 96 312 105 S385 85 412 76 S489 86 516 57 S590 47 640 17",
  "전체":"M0 157 C44 151 63 157 108 139 S176 147 216 123 S297 119 340 99 S402 102 462 71 S547 67 588 38 S616 38 640 18"
};

function Icon({name,size=23}){
  const parts = {
    home:<><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/></>,
    gift:<><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 9v12M3 13h18M12 9c-5 0-6-6-3-6 2 0 3 3 3 6Zm0 0c5 0 6-6 3-6-2 0-3 3-3 6Z"/></>,
    calendar:<><rect x="3.5" y="5" width="17" height="16" rx="2"/><path d="M8 3v4m8-4v4M3.5 10h17m-12 6 2.5 2.5 5-5"/></>,
    activity:<><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M7 12h2.5l2-4 2.5 8 2-4H18"/></>,
    package:<><path d="M4 5h16v12H9l-5 4V5Z"/><path d="m8 10 3 3 5-5"/></>,
    arrow:<><path d="m9 5 7 7-7 7"/></>,
    check:<><path d="m5 12 4 4L19 6"/></>,
    chart:<><path d="M3 18h18M6 14l5-5 3 3 5-7"/></>
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{parts[name]}</svg>;
}

function Navigation({onPreviewNav,desktop=false}){
  return <nav className={desktop?styles.desktopNav:styles.mobileNav} aria-label={desktop?"PC 회원 메뉴":"하단 회원 메뉴"}>
    {menu.map(item=><button key={item.key} className={item.key==="home"?styles.navActive:styles.navItem}
      aria-current={item.key==="home"?"page":undefined} type="button"
      onClick={()=>item.key==="home"?window.scrollTo({top:0,behavior:"smooth"}):onPreviewNav(item.label)}>
      <Icon name={item.icon} size={desktop?22:23}/>
      <span>{item.label}</span>
    </button>)}
  </nav>;
}

export default function AppHomePreview(){
  const [mode,setMode]=useState("running");
  const [period,setPeriod]=useState("1개월");
  const [notice,setNotice]=useState("");

  const showMenuNotice=(label)=>setNotice(label+" 메뉴는 이번 홈 디자인 시안의 제작 범위에 포함되지 않습니다.");
  return <div className={styles.canvas}>
    <div className={styles.previewBar} role="region" aria-label="디자인 시안 설정">
      <div className={styles.previewBarContent}>
        <span><span className={styles.previewDot}/> 앱형 홈 1차 시안 <em>· 실제 계정·시세 미연동</em></span>
        <div className={styles.modeSwitch} role="group" aria-label="홈 상태 미리보기">
          <button type="button" aria-pressed={mode==="running"} className={mode==="running"?styles.modeSelected:""} onClick={()=>setMode("running")}>진행 중</button>
          <button type="button" aria-pressed={mode==="ready"} className={mode==="ready"?styles.modeSelected:""} onClick={()=>setMode("ready")}>진행 전</button>
        </div>
      </div>
    </div>

    <div className={styles.shell}>
      <aside className={styles.sidebar} aria-label="PC 내비게이션">
        <div className={styles.sidebarBrand}>AI PROCESS<span>MEMBER SERVICE</span></div>
        <Navigation desktop onPreviewNav={showMenuNotice}/>
        <p className={styles.sidebarFoot}>디자인 방향 확인용<br/>실제 회원 데이터와 연결되지 않습니다.</p>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.mobileHeader}>
          <strong>AI PROCESS</strong>
          <span>HOME</span>
        </header>
        <header className={styles.desktopHeader}>
          <div><small>AI PROCESS · MEMBER</small><h1>홈</h1></div>
          <span className={styles.desktopContext}><span/> 앱형 디자인 시안</span>
        </header>
        <main className={styles.main}>
          <div className={styles.mainColumn}>
            {mode==="running"?
              <section className={styles.balance} aria-label="자산 요약 예시">
                <p className={styles.overline}>나의 자산</p>
                <h1 className={styles.balanceTitle}>총 평가금액</h1>
                <div className={styles.balanceFigure}><span>12,480,000</span><small>원</small></div>
                <p className={styles.invested}>투자금 <strong>10,000,000원</strong></p>
                <div className={styles.profitRow}>
                  <div><span>누적 손익</span><strong>+2,480,000원</strong></div>
                  <div><span>수익률</span><strong>+24.80%</strong></div>
                </div>
                <p className={styles.sampleFoot}>화면 배치 확인용 예시 수치입니다.</p>
              </section>:
              <section className={styles.readyBalance} aria-label="진행 전 안내">
                <p className={styles.overline}>나의 자산</p>
                <h1>아직 진행 중인<br/>AI PROCESS가 없어요</h1>
                <p>진행 상태와 운용 내역은 시작 후<br/>이곳에서 한눈에 확인할 수 있습니다.</p>
                <Link href="/design-ai-process" className={styles.readyLink}>AI PROCESS 알아보기 <Icon name="arrow" size={17}/></Link>
              </section>
            }

            <section className={styles.shortcuts} aria-label="바로가기">
              {shortcuts.map(item=><button type="button" key={item.key} onClick={()=>showMenuNotice(item.label)} className={styles.shortcut}>
                <span className={styles.shortcutIcon}><Icon name={item.icon} size={26}/></span>
                <span>{item.label}</span>
              </button>)}
            </section>

            <section className={styles.process} aria-label="AI PROCESS 상태">
              <div className={styles.processMark}><Icon name="activity" size={22}/></div>
              <div className={styles.processContent}>
                <h2>AI PROCESS</h2>
                <p><span className={mode==="running"?styles.runningDot:styles.readyDot}/>{mode==="running"?"진행 중 · 운용 현황 확인":"진행 전 · 이용 안내 확인"}</p>
              </div>
              <Link href="/design-ai-process" aria-label="AI PROCESS 상세 보기" className={styles.chevron}><Icon name="arrow" size={20}/></Link>
            </section>

            <section className={styles.trends} aria-labelledby="app-trend-title">
              <div className={styles.sectionHeading}>
                <h2 id="app-trend-title">자산 추이</h2>
                {mode==="running"&&<span className={styles.positive}>+24.80%</span>}
              </div>
              <div className={styles.chartTabs} role="group" aria-label="기간 선택">
                {Object.keys(chartLines).map(x=><button type="button" key={x} aria-pressed={period===x} className={period===x?styles.chartSelected:""} onClick={()=>setPeriod(x)}>{x}</button>)}
              </div>
              {mode==="running"?<>
                <div className={styles.chartMeta}><strong>12,480,000원</strong><span>{period} 기준</span></div>
                <svg className={styles.chart} viewBox="0 0 640 182" preserveAspectRatio="none" role="img" aria-label={period+" 자산 추이 예시 그래프"}>
                  <defs><linearGradient id="appPreviewChartFill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#3182f6" stopOpacity=".11"/><stop offset="1" stopColor="#3182f6" stopOpacity="0"/></linearGradient></defs>
                  <path d="M0 46H640 M0 94H640 M0 142H640" stroke="#eff1f4" strokeDasharray="3 6" fill="none"/>
                  <path d={chartLines[period]+" L640 182 L0 182Z"} fill="url(#appPreviewChartFill)"/>
                  <path d={chartLines[period]} fill="none" stroke="#3182f6" strokeWidth="3" strokeLinecap="round"/>
                  <circle cx="640" cy={period==="전체"?18:period==="3개월"?17:22} r="5" fill="#3182f6" stroke="white" strokeWidth="3"/>
                </svg>
                <div className={styles.chartAxis}><span>기간 시작</span><span>최근</span></div>
                <p className={styles.chartNote}>예시 그래프 · 실제 운용 기록이 아닙니다.</p>
              </>:<div className={styles.emptyTrend}><Icon name="chart" size={27}/><strong>운용 기록이 표시될 자리입니다.</strong><span>AI PROCESS 시작 후 실제 반영 내역과 연결됩니다.</span></div>}
            </section>
          </div>

          <div className={styles.sideColumn}>
            <section className={styles.market} aria-labelledby="app-market-title">
              <div className={styles.sectionHeading}>
                <div><h2 id="app-market-title">시장 현황</h2><p>주식·코인</p></div>
                <span className={styles.marketUnit}>USD · 예시 시세</span>
              </div>
              <div className={styles.marketList}>
                {markets.map(item=><div className={styles.marketRow} key={item.code}>
                  <span className={styles.assetIcon}><img src={item.icon} alt=""/></span>
                  <div className={styles.assetName}><strong>{item.name}</strong><small>{item.code}</small></div>
                  <div className={styles.marketNumber}><strong>{item.price}</strong><small className={item.tone==="up"?styles.positive:styles.negative}>{item.rate}</small></div>
                </div>)}
              </div>
              <p className={styles.marketFoot}>시세와 등락률은 디자인 검토용 가상 수치입니다.</p>
            </section>
            <section className={styles.support} aria-label="서비스 안내">
              <h2>필요한 내용만, 한눈에</h2>
              <p>자산·진행 상태·시장 흐름을 복잡한 카드 없이 간결하게 확인할 수 있도록 구성했습니다.</p>
            </section>
          </div>
        </main>
      </div>
    </div>
    <Navigation onPreviewNav={showMenuNotice}/>
    {notice&&<div className={styles.notice} role="status"><span>{notice}</span><button type="button" aria-label="안내 닫기" onClick={()=>setNotice("")}>닫기</button></div>}
  </div>;
}
