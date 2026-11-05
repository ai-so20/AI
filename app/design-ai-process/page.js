"use client";
import {useState} from 'react';
export default function Page(){const [state,setState]=useState('ready');return <main style={{maxWidth:480,margin:'auto',padding:24,fontFamily:'sans-serif'}}><h1>AI PROCESS</h1><nav>{[['ready','진행 전'],['running','진행 중'],['completed','완료']].map(([v,t])=><button key={v} onClick={()=>setState(v)} style={{padding:12,marginRight:8,background:state===v?'#d9eaff':'white',border:'1px solid #cbd5e1'}}>{t}</button>)}</nav><p>{state==='ready'?'AI 프로세스 소개 및 이용 안내':state==='running'?'진행 현황 및 시장 탐색':'완료 결과'}</p></main>}
