import "./globals.css";
import "./ai-process-p3.css";
import "./ai-process-controls.css";
import "./ai-process-mobile.css";
import "./admin-console.css";
import "./ai-process-finance.css";

export const metadata = {
  title: "AI PROCESS",
  description: "AI PROCESS 회원 서비스 · 자산 현황, 이벤트, 출석, 상품 지급 안내",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          background: "#0c0d10",
        }}
      >
        {children}
      </body>
    </html>
  );
}
