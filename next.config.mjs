/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 부모 폴더의 떠도는 package-lock.json 때문에 워크스페이스 루트가
  // 잘못 추론되는 것을 막는다.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
