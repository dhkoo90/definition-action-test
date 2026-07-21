import type { Metadata, Viewport } from "next";
import "./globals.css";

const [githubOwner, githubRepository] = process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ??
  (githubOwner && githubRepository
    ? `https://${githubOwner}.github.io/${githubRepository}/`
    : "http://localhost:3000/");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "행위 정의 판별 테스트",
    template: "%s | 행위 정의 판별 테스트",
  },
  description:
    "상황 사례를 읽고 가장 잘 표현하는 행위를 선택해 정의 기준의 명확성을 점검합니다.",
  openGraph: {
    type: "website",
    title: "행위 정의 판별 테스트",
    description: "상황을 읽고 가장 적합한 행위를 선택하세요.",
    images: [
      {
        url: "./og.png",
        width: 1792,
        height: 896,
        alt: "행위 정의 판별 테스트",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "행위 정의 판별 테스트",
    description: "상황을 읽고 가장 적합한 행위를 선택하세요.",
    images: ["./og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f0e8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
