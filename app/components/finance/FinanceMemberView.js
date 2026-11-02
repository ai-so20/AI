"use client";

import { useEffect, useRef, useState } from 'react';
import { aiKrw, aiSignedKrw, aiSignedPct, aiTime, aiFormatMarketPrice, buildAiChartModel } from '../../lib/ai-process-utils';
import { buildAiImpactSummary } from '../../lib/ai-process-impact';
import s from './finance.module.css';

const dateTime = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('ko-KR', { timeZone:'Asia/Seoul', month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false }).format(new Date(value)) : '—';
const stateName = session => !session ? 'READY' : session.status === 'running' ? 'RUNNING' : session.status === 'completed' ? 'COMPLETE' : session.status === 'stopped' ? 'STOPPED' : 'READY';
const signClass = value => Number(value) > 0 ? s.gain : Number(value) < 0 ? s.loss : s.neutral;
function Icon({name}) {
 const paths={home:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,ai:<><path d="M4 20V12M12 20V4M20 20V9"/><path d="M2 21h20"/></>,event:<><rect x="3" y="7" width="18" height="14" rx="1"/><path d="M3 11h18M12 7v14"/><path d="M12 7C4 8 4 1 8 3l4 4c8 1 8-6 4-4Z"/></>,group:<><path d="M3 4h18v13H9l-6 4Z"/><path d="M7 9h10M7 13h6"/></>,private:<><path d="M4 13v-1a8 8 0 0 1 16 0v1M4 12H2v6h4v-6ZM20 12h2v6h-4v-6ZM20 18c0 3-4 3-7 3"/></>,user:<><circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/></>,bell:<><path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4"/></>};
 return <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.ai}</svg>;
}
function SectionTitle({number,title,aside}) {return <div className={s.sectionTitle}><h2>{number && <small>{number}</small>}{title}</h2>{aside}</div>;}
function History({rows,compact,onAll,selected}) {
 return <section className={s.section} id="finance-history"><SectionTitle number={compact?null:'04'} title="최근 반영" aside={compact?<button onClick={onAll}>전체 내역 <span>↗</span></button>:<span>시간순 · 최근 {rows.length}건</span>}/>
 {!rows.length?<p className={s.empty}>아직 반영 내역이 없습니다.</p>:<div className={s.ledger}>{rows.map((r,i)=><div key={`${r.at}-${r.symbol}-${i}`} id={`finance-log-${i}`} className={`${s.entry} ${selected===r.at?s.selected:''}`}>
 <time dateTime={r.at}>{dateTime(r.at)}</time><div className={s.entryCopy}><b>{r.name || 'PROCESS 반영'}</b><span>{r.symbol} · {r.type==='crypto'?'COIN':'STOCK'} · 시장 {aiSignedPct(r.intervalPct)}</span></div><div className={s.entryAmount}><strong className={signClass(r.intervalProfit)}>{aiSignedKrw(r.intervalProfit)}</strong><span>반영 후 {aiKrw(r.portfolioValue)}</span></div></div>)}</div>}
 </section>;
}
function Chart({session,rows,amount,onSelect,selected}) {
 const model=buildAiChartModel(rows,Number(session?.start_amount??0));
 const node=selected || model.nodes.at(-1);
 return <section className={s.section}><SectionTitle number="02" title="자산 추이" aside={<span>최근 {model.nodes.length}개 기록</span>}/>
 {model.nodes.length>1?<><div className={s.chartReadout}><span>{selected?dateTime(selected.at):'최근 평가금액'}</span><b>{aiKrw(node?.value??amount)}</b></div>
 <svg className={s.chart} viewBox="0 0 900 300" role="img" aria-label="평가금액 추이. 아래 기록 선택으로 각 반영 금액을 확인할 수 있습니다.">
 {[80,160,240].map(y=><line key={y} x1="52" x2="848" y1={y} y2={y} stroke="#edf0f3"/>)}
 <line x1="52" x2="848" y1={model.baselineY} y2={model.baselineY} stroke="#c6cdd5" strokeDasharray="4 5"/>
 <polyline points={model.points} fill="none" stroke="#3182f6" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/>
 {node&&<><line x1={node.x} x2={node.x} y1="24" y2="275" stroke="#d5dce5"/><circle cx={node.x} cy={node.y} r="6" fill="#3182f6" stroke="white" strokeWidth="3"/></>}
 </svg><div className={s.chartAxis}><span>{dateTime(model.nodes[0]?.at)}</span><span>시작금액 {aiKrw(session?.start_amount)}</span><span>{dateTime(model.nodes.at(-1)?.at)}</span></div>
 <label className={s.recordSelect}>기록 선택<select aria-label="그래프 반영 기록 선택" value={selected?.at||''} onChange={e=>onSelect(model.nodes.find(n=>n.at===e.target.value)||null)}><option value="">가장 최근</option>{model.nodes.map((n,i)=><option key={`${n.at}-${i}`} value={n.at}>{dateTime(n.at)} · {aiKrw(n.value)}</option>)}</select></label></>:<p className={s.empty}>{session?'그래프를 표시할 반영 기록을 기다리고 있습니다.':'PROCESS가 시작되면 자산 추이가 표시됩니다.'}</p>}
 </section>;
}

export default function FinanceMemberView({tab,profile,session,sessions=[],sim,stateLoading,stateError,simLoading,error,countdown,onNavigate,onSelectProcess,onRetry,onLogout,onNotifications,onProfileEdit,pushEnabled,unread=0,events=[],rewards=[],homeNotice,demo,onDemoInfo,onClaimDemo,claimWorking,publicSessions=[],publicLoading,notice}) {
 const [now,setNow]=useState(null);
 const [profileOpen,setProfileOpen]=useState(false);
 const [selected,setSelected]=useState(null);
 const [marketTab,setMarketTab]=useState('stock');
 const [allHistory,setAllHistory]=useState(false);
 const dialogRef=useRef(null);
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();const id=setInterval(tick,1000);return()=>clearInterval(id);},[]);
 useEffect(()=>{setSelected(null);setAllHistory(false);},[session?.id]);
 useEffect(()=>{if(profileOpen)dialogRef.current?.showModal();else dialogRef.current?.close();},[profileOpen]);
 const running=session?.status==='running';
 const amount=session?Number(session.current_amount??session.start_amount??0):null;
 const principal=session?Number(session.start_amount??0):null;
 const profit=session?amount-principal:null;
 const rate=principal>0?profit/principal*100:0;
 const records=Array.isArray(sim?.resultHistory)?sim.resultHistory:[];
 const chartRows=Array.isArray(sim?.history)?[...sim.history]:[];
 // A snapshot belongs to the selected PROCESS only; the database session is the amount source.
 if(session&&(!chartRows.length||chartRows.at(-1)?.value!==amount)) chartRows.push({at:session.last_tick_at||session.updated_at||session.started_at,value:amount,delta:Number(session.last_delta??0),name:session.last_asset_name});
 const started=Date.parse(session?.started_at),ends=Date.parse(session?.ends_at);
 const remain=now&&Number.isFinite(ends)?Math.max(0,ends-now):null;
 const remaining=remain===null?'종료일 미정':remain===0?'종료 시각 도달':remain>=86400000?`${Math.floor(remain/86400000)}일 ${Math.floor(remain%86400000/3600000)}시간`:`${Math.floor(remain/3600000)}시간 ${Math.floor(remain%3600000/60000)}분`;
 const progress=now&&Number.isFinite(started)&&ends>started?Math.max(0,Math.min(100,(now-started)/(ends-started)*100)):null;
 const status=stateName(session);
 const activeEvent=events.find(e=>e.status==='active');
 const featured=activeEvent||events.find(e=>e.status==='scheduled');
 const attendance=events.find(e=>e.event_type==='attendance'&&e.status==='active')||events.find(e=>e.event_type==='attendance');
 const impact=buildAiImpactSummary(records,{contributorLimit:3,recentLimit:5});
 const offer=rewards.find(r=>r.reward_type==='ai_process'&&r.status!=='delivered');
 const nav=[['home','홈'],['ai','AI PROCESS'],['event','이벤트'],['group','라운지'],['private','1:1 문의']];
 return <main className={s.root}>
 <div className={s.frame}>
 <header className={s.header}><button className={s.wordmark} onClick={()=>onNavigate('home')}>AI<span>PROCESS</span></button><div className={s.headerActions}><button aria-label={pushEnabled?'알림 설정 켜짐':'알림 켜기'} onClick={onNotifications}><Icon name="bell"/>{unread>0&&<i>{unread}</i>}</button><button aria-label="내 정보" onClick={()=>setProfileOpen(true)}><Icon name="user"/></button></div></header>
 <div className={s.content}>
 <div className={s.pageLabel}><span>{tab==='home'?`${profile.nickname}님의 자산`:'내 AI PROCESS'}</span><span>VIP MEMBER</span></div>
 {stateLoading&&!session?<div className={s.loading} role="status">자산 정보를 불러오고 있습니다.</div>:<>
 <section className={s.balance}>
 <div className={s.balanceTop}><h1>{session&&!running?'최종 평가금액':'현재 평가금액'}</h1><span className={running?s.running:s.status}>{status}</span></div>
 <div className={s.amount}>{amount===null?<strong className={s.noAmount}>시작을 기다리고 있어요</strong>:<><strong>{Math.round(amount).toLocaleString('ko-KR')}</strong><span>원</span></>}</div>
 {session?<div className={`${s.profit} ${signClass(profit)}`}><span>누적 손익</span><b>{aiSignedKrw(profit)}</b><b>{aiSignedPct(rate,2)}</b></div>:<p className={s.subtext}>PROCESS가 시작되면 평가금액과 손익을 확인할 수 있습니다.</p>}
 <div className={s.balanceFoot}><span>투자금 <b>{session?aiKrw(principal):'—'}</b></span><span>{session?`최근 반영 ${aiTime(session.last_tick_at||session.updated_at)}`:'등록된 PROCESS 없음'}</span></div>
 </section>
 {stateError&&<div className={s.error} role="alert">{stateError}<button onClick={onRetry}>다시 불러오기</button></div>}
 {tab==='home'?<>
 <button className={s.processLink} onClick={()=>onNavigate('ai')}><div><span className={s.eyebrow}>AI PROCESS</span><strong>{running?'자산 운용 진행 중':session?'운용 결과 확인':'PROCESS 현황 확인'}</strong><small>{running?`남은 시간 ${remaining}`:session?'확정된 금액과 반영 기록을 확인하세요.':'시작 전 안내와 진행 현황을 확인하세요.'}</small></div><span className={s.arrow}>↗</span></button>
 <History rows={records.slice(0,3)} compact onAll={()=>onNavigate('ai')}/>
 <section className={s.section}><SectionTitle title="이용 서비스"/>
 {[['이벤트',featured?`${featured.title} · ${featured.participated?'참여 완료':activeEvent?'참여 가능':'예정'}`:'진행 예정인 이벤트를 확인하세요.','event'],['출석',attendance?`${attendance.title} · ${attendance.participated?'참여 완료':attendance.status==='active'?'출석 가능':'회차 확인'}`:'진행 중인 출석 회차가 없습니다.','event'],['상품 지급 내역',`받은 혜택 ${rewards.length}건 · 이벤트에서 수령 상태 확인`,'event'],['1:1 문의',unread?`새 안내 ${unread}건`:'상품 전달 및 관리자 안내 확인','private'],['회원 라운지','그룹 대화와 공지 확인','group']].map(([label,detail,target])=><button className={s.serviceRow} key={label} onClick={()=>onNavigate(target)}><div><b>{label}</b><span>{detail}</span></div><span>›</span></button>)}
 </section>
 {homeNotice?.is_active&&<section className={s.section}><SectionTitle title="공지사항"/><strong>{homeNotice.title}</strong><p className={s.noticeBody}>{homeNotice.body}</p></section>}
 </>:<>
 <section className={s.timing}><div><span>운용 상태</span><b>{running?'진행 중':session?'운용 종료':'대기 중'}</b></div><div><span>{running?'남은 시간':'종료 시각'}</span><b>{running?remaining:session?dateTime(session.completed_at||session.updated_at):'—'}</b></div>{progress!==null&&<><div className={s.progress} role="progressbar" aria-label="운용 기간 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><i style={{width:`${progress}%`}}/></div><small>기간 진행률 {progress.toFixed(1)}%</small></>}</section>
 {sessions.length>1&&<label className={s.processSelect}>운용 내역<select value={session?.id||''} onChange={e=>onSelectProcess(sessions.find(r=>r.id===e.target.value))}>{sessions.map((r,i)=><option key={r.id} value={r.id}>{dateTime(r.started_at)} · {stateName(r)} · {aiKrw(r.current_amount??r.start_amount)}</option>)}</select></label>}
 <dl className={s.meta}><div><dt>시작</dt><dd>{dateTime(session?.started_at)}</dd></div><div><dt>종료 예정</dt><dd>{session?(session.ends_at?dateTime(session.ends_at):'종료일 미정'):'—'}</dd></div><div><dt>최근 반영</dt><dd>{dateTime(session?.last_tick_at||session?.updated_at)}</dd></div><div><dt>다음 데이터 갱신</dt><dd>{running?countdown:'—'}</dd></div></dl>
 <section className={s.section}><SectionTitle number="01" title="PROCESS 진행" aside={<span>{simLoading?'데이터 갱신 중':running?'운용 중':session?'종료':'대기'}</span>}/><div className={s.stage}><i className={running?s.liveDot:s.idleDot}/><div><b>{running?'시장 분석 · 판단 · 반영':session?'운용 결과 확정':'PROCESS 시작 대기'}</b><p>{records[0]?`${records[0].name} · 최근 ${aiSignedKrw(records[0].intervalProfit)} 반영`:'새로운 반영 기록이 생기면 이곳에서 확인할 수 있습니다.'}</p></div></div></section>
 {error&&<div className={s.error} role="alert">{error}<button disabled={simLoading} onClick={onRetry}>다시 불러오기</button></div>}
 <Chart session={session} rows={chartRows} amount={amount} selected={selected} onSelect={setSelected}/>
 <section className={s.section}><SectionTitle number="03" title="AI 트레이딩 현황" aside={<span>{sim?.updatedAt?`${aiTime(sim.updatedAt)} 기준`:'데이터 대기'}</span>}/><div className={s.tabs} role="tablist" aria-label="자산 유형">{[['stock','STOCK'],['crypto','COIN']].map(([key,label])=><button role="tab" aria-selected={marketTab===key} key={key} onClick={()=>setMarketTab(key)}>{label}</button>)}</div>
 <div className={s.marketColumns}><span>종목 / 현재가</span><span>3분 변동 / 반영 기록</span></div>
 {(sim?.marketRows||[]).filter(r=>r.type===marketTab).map(r=>{const reflected=records.find(x=>x.symbol===r.symbol);return <div className={s.marketRow} key={r.symbol}><div><b>{r.name}</b><span>{r.symbol} <em>{aiFormatMarketPrice(r)}</em></span></div><div><b className={signClass(r.changePct)}>{aiSignedPct(r.changePct)}</b><span>{reflected?`${aiTime(reflected.at)} · ${aiSignedKrw(reflected.intervalProfit)}`:'반영 기록 없음'}</span></div></div>})}
 {!(sim?.marketRows||[]).length&&<p className={s.empty}>{simLoading?'시장 데이터를 불러오고 있습니다.':'표시할 시장 데이터가 없습니다.'}</p>}
 <details className={s.details}><summary>수익·손실 기여 자산</summary><dl className={s.impactTotals}><div><dt>수익 기여</dt><dd className={s.gain}>{aiSignedKrw(impact.profitTotal)}</dd></div><div><dt>손실 기여</dt><dd className={s.loss}>{aiSignedKrw(impact.lossTotal)}</dd></div><div><dt>조회 기록 순손익</dt><dd>{aiSignedKrw(impact.net)}</dd></div></dl><p className={s.subtext}>조회된 반영 기록 {impact.history.length}건 기준</p>{[['수익 기여 TOP 3',impact.profitContributors],['손실 기여 TOP 3',impact.lossContributors]].map(([label,items])=><div key={label}><h3 className={s.minorTitle}>{label}</h3>{items.length?items.map(r=><div className={s.simpleRow} key={r.symbol}><span>{r.name} · {r.count}회</span><b className={signClass(r.totalProfit)}>{aiSignedKrw(r.totalProfit)}</b></div>):<p className={s.empty}>반영 기록이 없습니다.</p>}</div>)}</details>
 </section>
 <History rows={allHistory?records:records.slice(0,14)} selected={selected?.at}/>{records.length>14&&<button className={s.more} onClick={()=>setAllHistory(v=>!v)}>{allHistory?'간단히 보기':`조회된 ${records.length}건 모두 보기`}</button>}
 <section className={s.section}><details className={s.details}><summary>함께 진행 중인 회원</summary>{publicLoading?<p className={s.empty}>불러오는 중입니다.</p>:publicSessions.length?publicSessions.map((r,i)=><div className={s.simpleRow} key={`${r.user_id}-${i}`}><span>{r.nickname}<small>{r.last_asset_name||'반영 대기'} · {aiTime(r.updated_at)}</small></span><b className={signClass(r.total_profit)}>{aiSignedKrw(r.total_profit)}<small>{aiSignedPct(r.total_return)}</small></b></div>):<p className={s.empty}>진행 중인 회원이 없습니다.</p>}</details></section>
 </>}
 {(tab==='home'||demo||offer)&&<section className={s.section}><SectionTitle title="AI PROCESS 체험"/>{demo&&<><div className={s.simpleRow}><span>{demo.status==='running'?'진행 중':'완료'} · 체험금</span><b>{aiKrw(demo.current_amount)}</b></div><p className={signClass(demo.total_profit)}>{aiSignedKrw(demo.total_profit)} · {aiSignedPct(demo.total_return)}</p><p className={s.subtext}>실제 자산 및 정산과 분리된 모의체험입니다.</p>{demo.last_asset_name&&<p className={s.subtext}>최근 연동 {demo.last_asset_name} · {aiSignedPct(demo.last_market_pct)}</p>}</>}{offer&&demo?.status!=='running'&&<><b>{offer.reward_name}</b><p className={s.subtext}>실제 잔액과 분리된 1회 모의체험입니다.</p><button className={s.primary} disabled={claimWorking} onClick={()=>onClaimDemo(offer.id)}>{claimWorking?'시작 중…':'체험 시작'}</button></>}<button className={s.textButton} onClick={onDemoInfo}>체험 안내</button></section>}
 {notice&&<p className={s.feedback} role="status">{notice}</p>}
 </>}
 <footer className={s.footer}>AI PROCESS <span>금액 · 시간 기준 KST</span></footer>
 </div>
 <nav className={s.nav} aria-label="주요 메뉴">{nav.map(([key,label])=><button key={key} aria-current={tab===key?'page':undefined} onClick={()=>onNavigate(key)}><Icon name={key}/><span>{label}{key==='private'&&unread>0?` (${unread})`:''}</span></button>)}</nav>
 <dialog ref={dialogRef} className={s.dialog} onCancel={()=>setProfileOpen(false)} onClose={()=>setProfileOpen(false)}><div className={s.dialogHead}><h2>내 정보</h2><button onClick={()=>setProfileOpen(false)} aria-label="내 정보 닫기">×</button></div><dl className={s.meta}><div><dt>닉네임</dt><dd>{profile.nickname}</dd></div><div><dt>성함</dt><dd>{profile.real_name}</dd></div><div><dt>회원 상태</dt><dd>{profile.approval_status==='approved'?'승인 완료':profile.approval_status}</dd></div></dl><button className={s.textButton} onClick={onProfileEdit}>프로필 변경</button><button className={s.primary} onClick={onLogout}>로그아웃</button></dialog>
 </div></main>;
}
