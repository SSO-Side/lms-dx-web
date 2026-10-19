// 최상위 레이아웃: 모든 화면이 공유하는 <html>·폰트·기본 메타데이터.
import type { Metadata, Viewport } from "next";
import "./globals.css";

/** 브라우저 탭 제목·설명 */
export const metadata: Metadata = {
  title: "lms_kdt",
  description: "KDT 학원 반 단위 학습·행정 관리",
};

/** 모바일에서 화면 너비에 맞춰 보이게 하는 설정 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

/** 모든 페이지를 감싸는 최상위 틀 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
