import fs from 'node:fs';

let page = fs.readFileSync('app/page.js','utf8');

function replaceOnce(from,to,label){
  const next = page.replace(from,to);
  if(next === page) throw new Error('anchor not found: '+label);
  page = next;
}

const duplicateFeatured = `{featuredEvent && <button type="button" onClick={()=>changeTab("event")} style={{width:"100%",marginTop:"10px",padding:"13px 14px",border:"1px solid #dde3e0",borderRadius:"16px",background:"#fff",display:"flex",alignItems:"center",gap:"11px",textAlign:"left",cursor:"pointer",color:"#293633"}}><div style={{fontSize:"24px"}}>{eventIcon(featuredEvent.event_type)}</div><div style={{flex:1,minWidth:0}}><span style={{display:"block",fontSize:"9px",fontWeight:900,color:"#6b7d77"}}>{activeEvent ? "진행 중 이벤트" : "다음 이벤트"}</span><strong style={{display:"block",marginTop:"3px",fontSize:"13px"}}>{featuredEvent.title}</strong><small style={{display:"block",marginTop:"3px",color:"#7b8884"}}>{activeEvent ? (featuredEvent.participated ? "참여 완료" : "지금 참여 가능") : formatEventTime(featuredEvent.starts_at) + " ~ " + formatEventTime(featuredEvent.ends_at)}</small></div><b>›</b></button>}`;
if (!page.includes(duplicateFeatured)) throw new Error('duplicate featured event card not found');
page = page.replace(duplicateFeatured,'');

const alertsBlock = /\s*<section className="vip-home-v20-alerts">[\s\S]*?<\/section>/m;
const alertsMatch = page.match(alertsBlock);
if (!alertsMatch) throw new Error('home alerts block not found');
const cleanAlerts = `
                {unreadPrivate > 0 && (
                  <section className="vip-home-v20-alerts">
                    <button type="button" onClick={() => changeTab("private")}>
                      <i>🎧</i><span><b>1:1 새 답변 {unreadPrivate}</b><small>관리자 답변을 확인하세요</small></span><em>›</em>
                    </button>
                  </section>
                )}`;
page = page.replace(alertsBlock, cleanAlerts);

fs.writeFileSync('app/page.js',page);
console.log('V49 home dedupe applied');
