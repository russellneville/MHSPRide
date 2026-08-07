'use client'
import { createContext, useContext } from 'react'

// Skin/org are resolved server-side in app/layout.jsx from the request's
// host header (lib/skin.js) and handed down as static props here — no
// client-side fetch, same "read once on the server, pass down" shape as the
// rest of the app's providers.
const SkinContext = createContext({ skin: 'mhsp', org: null })

export function SkinProvider({ skin, org, children }) {
  return <SkinContext.Provider value={{ skin, org }}>{children}</SkinContext.Provider>
}

export const useSkin = () => useContext(SkinContext)
