import "./globals.css";

export const metadata = {
  title: "VIP 이벤트 혜택방",
  description: "회원들과 함께하는 실시간 VIP 이벤트 커뮤니티",
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
