import { Geist, Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { PopupProvider } from "@/context/PopupContext";
import { Popup } from "@/components/Popup";
import { NetworkProvider } from "@/context/NetworksContext";
import { ThemeProvider } from "@/context/ThemeContext";
import CookieConsent from "@/components/CookieConsent";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata = {
  title: "MHSPRide",
  description: "Carpooling and rideshare for the Mount Hood Ski Patrol community.",
};

export default function RootLayout({ children }) {
  return (
    
          <html lang="en" suppressHydrationWarning>
            <body
              className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} font-poppins antialiased`}
            >
              <ThemeProvider
                  attribute="class"  
                  defaultTheme="system"
                  enableSystem
                  disableTransitionOnChange>
                <AuthProvider>
                  <NetworkProvider>
                    <PopupProvider>
                          {children}
                          <Popup />
                          <Toaster/>
                          <CookieConsent />
                    </PopupProvider>
                  </NetworkProvider>
                </AuthProvider>
              </ThemeProvider>
            </body>
          </html>
        
  );
}
