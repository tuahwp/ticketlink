import { Space_Grotesk, Atkinson_Hyperlegible } from "next/font/google";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  weight: ["500", "600", "700"],
  display: "swap",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  variable: "--font-atkinson",
  weight: ["400", "700"],
  display: "swap",
});

export default function FeV2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${spaceGrotesk.variable} ${atkinson.variable} font-st-body min-h-screen bg-[#faf8ff] dark:bg-slate-950 text-[#131b2e] dark:text-slate-100 antialiased`}
      style={{
        fontFamily: "var(--font-atkinson), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* Scoped Google Material Symbols Outlined stylesheet strictly for /fe-v2 */}
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
      />
      {children}
    </div>
  );
}
