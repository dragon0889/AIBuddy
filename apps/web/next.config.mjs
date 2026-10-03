/** @type {import('next').NextConfig} */
export default {
  transpilePackages: ["@aibuddy/shared", "@aibuddy/ml-core", "@aibuddy/ui"],
  reactStrictMode: true,
  async headers() {
    // Nền tảng cho ADR-0002: ràng buộc nơi trang được phép kết nối (chỉ cùng origin).
    return [
      {
        source: "/spike/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' blob: data:; worker-src 'self' blob:" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self)" },
        ],
      },
    ];
  },
};
