import { resolveConfig } from './resolveConfig'

/** The app's settings, read once from frontend/.env (VITE_API_URL). */
export const config = resolveConfig(import.meta.env.VITE_API_URL as string | undefined)
