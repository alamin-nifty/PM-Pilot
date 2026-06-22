import "./globals.css";

export const metadata = {
  title: "Keystone — PM Pilot",
  description: "What needs you today.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. ColorZilla adds
          `cz-shortcut-listen`, Grammarly, etc.) inject attributes onto <body>
          before React hydrates. This silences that benign mismatch only for
          <body>'s own attributes — it does not affect app content. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
