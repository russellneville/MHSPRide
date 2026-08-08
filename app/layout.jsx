import Script from "next/script";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Poppins, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { PopupProvider } from "@/context/PopupContext";
import { Popup } from "@/components/Popup";
import { NetworkProvider } from "@/context/NetworksContext";
import { LocationsProvider } from "@/context/LocationsContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SkinProvider } from "@/context/SkinContext";
import CookieConsent from "@/components/CookieConsent";
import Analytics from "@/components/Analytics";
import { COOKIE_CONSENT_STORAGE_KEY } from "@/lib/cookieConsent";
import { resolveSkin, TROOPITER_ORG_ID } from "@/lib/skin";
import { getAdminDb } from "@/lib/firebaseAdmin";

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

// Troopiter's own design language uses Inter (resources/troopiter/integration-proposal.md,
// "Look and feel") — loaded unconditionally since next/font can't be called
// conditionally, applied only under [data-skin="troopiter"] in globals.css.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata = {
  title: "MHSP Ride",
  description: "Carpooling and rideshare for the Mount Hood Ski Patrol community.",
};

// Org config is a single hardcoded doc for this rehearsal prototype (see
// lib/skin.js) — real multi-tenant org resolution from the launch session
// is out of scope until a second patrol onboards.
async function getOrgForSkin(skin) {
  if (skin !== 'troopiter') return null
  const snap = await getAdminDb().collection('organizations').doc(TROOPITER_ORG_ID).get()
  return snap.exists ? { id: snap.id, ...snap.data() } : null
}

export default async function RootLayout({ children }) {
  const host = (await headers()).get('host')
  const skin = resolveSkin(host)
  const org = await getOrgForSkin(skin)

  return (

          <html lang="en" suppressHydrationWarning data-skin={skin}>
            <body
              className={`${geistSans.variable} ${geistMono.variable} ${poppins.variable} ${inter.variable} font-poppins antialiased`}
            >
              <ThemeProvider
                  attribute="class"
                  defaultTheme="system"
                  enableSystem
                  disableTransitionOnChange>
                <SkinProvider skin={skin} org={org}>
                <AuthProvider>
                  <NetworkProvider>
                  <LocationsProvider>
                    <PopupProvider>
                          {children}
                          <Popup />
                          <Toaster/>
                          <CookieConsent />
                          {process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
                            <Script
                              id="ga-consent-default"
                              strategy="beforeInteractive"
                              dangerouslySetInnerHTML={{
                                __html: `
                                  window.dataLayer = window.dataLayer || [];
                                  function gtag(){dataLayer.push(arguments);}
                                  var consent = localStorage.getItem('${COOKIE_CONSENT_STORAGE_KEY}');
                                  gtag('consent', 'default', {
                                    'analytics_storage': consent === 'necessary' ? 'denied' : 'granted',
                                    'ad_storage': 'denied',
                                    'ad_user_data': 'denied',
                                    'ad_personalization': 'denied'
                                  });
                                `,
                              }}
                            />
                          )}
                          <Analytics />
                    </PopupProvider>
                  </LocationsProvider>
                  </NetworkProvider>
                </AuthProvider>
                </SkinProvider>
              </ThemeProvider>
            </body>
          </html>

  );
}
