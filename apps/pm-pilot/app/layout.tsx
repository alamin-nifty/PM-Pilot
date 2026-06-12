import "./globals.css";

export const metadata = {
  title: "Keystone — PM Pilot",
  description: "What needs you today.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
