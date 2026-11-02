'use client';
import {useState} from 'react';
import FinanceMemberView from '../../components/finance/FinanceMemberView';
const end=Date.now()+86400000;
const session={id:'qa',status:'running',start_amount:6170000,current_amount:46813484,started_at:new Date(end-30*86400000).toISOString(),ends_at:new Date(end).toISOString(),updated_at:new Date().toISOString()};
const rows=Array.from({length:20},(_,i)=>({at:new Date(Date.now()-i*180000).toISOString(),name:i%2?'Bitcoin':'NVIDIA',symbol:i%2?'BTC/USD':'NVDA',type:i%2?'crypto':'stock',intervalPct:i%4?1.3:-.4,intervalProfit:i%4?128400:-32700,portfolioValue:46813484-i*120000,resultType:i%4?'profit':'loss'}));
export default function QA(){const[tab,setTab]=useState('home');return <FinanceMemberView tab={tab} profile={{nickname:'검수용',real_name:'테스트',approval_status:'approved'}} session={session} sessions={[session]} sim={{updatedAt:session.updated_at,history:[...rows].reverse().map(r=>({at:r.at,value:r.portfolioValue})),resultHistory:rows,marketRows:[{name:'NVIDIA',symbol:'NVDA',type:'stock',price:183.23,changePct:1.3},{name:'Bitcoin',symbol:'BTC/USD',type:'crypto',price:113503.1,changePct:-.4}]}} onNavigate={setTab} onSelectProcess={()=>{}} onNotifications={()=>{}} onLogout={()=>{}} onProfileEdit={()=>{}} onRetry={()=>{}} onDemoInfo={()=>{}} countdown="02:48" events={[]} rewards={[]} publicSessions={[]} />}
