/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 부모 폴더의 떠도는 package-lock.json 때문에 워크스페이스 루트가
  // 잘못 추론되는 것을 막는다.
  turbopack: {
    root: import.meta.dirname,
  },
  // /api/flow 가 런타임에 design-system/card-flow.md(생성 규칙 단일 원본)를
  // fs 로 읽으므로, 서버리스 번들에 이 파일이 포함되도록 추적에 명시한다.
  outputFileTracingIncludes: {
    '/api/flow': ['./design-system/card-flow.md'],
  },
};

export default nextConfig;
