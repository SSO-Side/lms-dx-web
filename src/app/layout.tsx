// 최상위 레이아웃: 모든 화면이 공유하는 <html>·폰트·기본 메타데이터.
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/** Pretendard 가변 폰트 한글 서브셋(약 360KB, SIL OFL, 만드는 법·라이선스는 fonts/ 폴더). 굵기 400~700, 서브셋에 없는 글자는 폰트 스택의 다음 글꼴로 표시된다. */
const pretendard = localFont({
  src: "./fonts/PretendardVariable.subset.woff2",
  weight: "400 700",
  display: "swap",
  variable: "--font-pretendard",
});

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
    <html lang="ko" className={pretendard.variable}>
      <body>{children}</body>
    </html>
  );
}
