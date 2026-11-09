import Link from "next/link";

export const metadata = {
  title: "가상 기프티콘 테스트 | AI",
  robots: { index: false, follow: false },
};

export default function GiftTestPage() {
  return (
    <main style={{minHeight:"100vh",background:"#edf3fa",padding:"clamp(28px,7vw,75px) 18px",color:"#142b47",fontFamily:'Arial,"Noto Sans KR",sans-serif'}}>
      <section style={{maxWidth:480,margin:"0 auto",padding:"32px 24px",background:"#fff",border:"1px solid #dce7f5",borderRadius:12,boxShadow:"0 10px 30px #1d3a5b0d"}}>
        <p style={{fontSize:12,fontWeight:800,color:"#0870e9",letterSpacing:"0.08em"}}>AI · GIFT LINK TEST</p>
        <h1 style={{fontSize:26,lineHeight:1.35,margin:"13px 0 18px"}}>가상 기프티콘 링크가 정상적으로 열렸습니다.</h1>
        <p style={{fontSize:15,lineHeight:1.8,margin:0}}>상품지급센터에서 <strong>기프티콘 확인하기</strong>를 눌러 이 화면이 표시됐다면 링크 열기 테스트가 정상적으로 완료된 것입니다.</p>
        <div style={{marginTop:24,padding:"15px 16px",background:"#f2f6fc",borderLeft:"3px solid #0870e9",fontSize:13,lineHeight:1.8}}>
          <strong>테스트용 가상 상품</strong>
          <div>이 기프티콘은 실제 교환권이 아닙니다. 구매·사용·환불이 불가능하며, 실제 상품 지급을 의미하지 않습니다.</div>
        </div>
        <div style={{marginTop:24}}>
          <Link href="/design-reward" style={{display:"inline-block",textDecoration:"none",background:"#086ee5",borderRadius:8,padding:"12px 16px",fontWeight:700,color:"#fff",fontSize:13}}>AI 상품지급센터로 돌아가기</Link>
        </div>
      </section>
    </main>
  );
}
