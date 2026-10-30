import type { NextConfig } from "next";

// 모든 응답에 붙이는 기본 보안 헤더. HSTS는 TLS를 처리하는 Nginx에서 붙인다.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // 결석계 증빙(파일당 10MB, 최대 3개) 업로드를 서버 액션으로 받기 위해
    serverActions: { bodySizeLimit: "32mb" },
  },
};

export default nextConfig;
