import "@/styles/globals.css";
import "react-toastify/dist/ReactToastify.css";
import "@/styles/vendor.css";
import type { Metadata } from "next";
import ClientLayout from "./ClientLayout";
import { Providers } from "./Providers";
import { themeBootstrapScript } from "@/theme/colors";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "CRM Dashboard built with Next.js",
};

/**
 * Runs before first paint: restores light/dark mode and company branding.
 * The brand color is restored by `themeBootstrapScript`, generated from the
 * same function the runtime theme provider uses (theme/colors.ts).
 */
const modeAndBrandingScript = `(function(){try{
var theme=localStorage.getItem('theme')||'light';
if(theme==='system'){theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}
var root=document.documentElement;
if(theme==='dark'){root.classList.add('dark');}else{root.classList.remove('dark');}
root.style.colorScheme=theme;
var saved=localStorage.getItem('soft7_company_details');
if(saved){var parsed=JSON.parse(saved);if(parsed&&parsed.company&&parsed.company.name){document.title=parsed.company.name;}}
}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Cascade-layer order must be declared before ANY stylesheet loads:
            component CSS chunks can arrive before globals.css, and the first
            @layer mention fixes precedence for the whole document. */}
        <style dangerouslySetInnerHTML={{ __html: "@layer theme, base, components, utilities;" }} />
        {/* Boxicons for auth page icons */}
        <script
          src="https://unpkg.com/boxicons@2.1.4/dist/boxicons.js"
          async
        ></script>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: modeAndBrandingScript }} />
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="font-sans min-h-screen antialiased" suppressHydrationWarning>
        <Providers>
          {/* ClientLayout handles auth vs dashboard layout */}
          <ClientLayout>{children}</ClientLayout>
        </Providers>
      </body>
    </html>
  );
}
