/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 부모 폴더의 떠도는 package-lock.json 때문에 워크스페이스 루트가
  // 잘못 추론되는 것을 막는다.
  turbopack: {
    root: import.meta.dirname,
  },
  // 생성 규칙의 단일 원본 문서를 런타임에 fs 로 읽으므로, 서버리스 번들에
  // 해당 .md 가 포함되도록 추적에 명시한다(/api/flow=문구, /api/image=이미지 프롬프트).
  outputFileTracingIncludes: {
    '/api/flow': ['./design-system/card-flow.md'],
    '/api/image': ['./design-system/design.md'],
  },
};

export default nextConfig;
