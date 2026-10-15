import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // 결석계 증빙(파일당 10MB, 최대 3개) 업로드를 서버 액션으로 받기 위해
    serverActions: { bodySizeLimit: "32mb" },
  },
};

export default nextConfig;
