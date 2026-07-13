import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SerDaddy | Self-Hosted PaaS Dashboard",
  description: "Deploy and manage private/public repositories on custom servers with live logging and resource telemetry.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
