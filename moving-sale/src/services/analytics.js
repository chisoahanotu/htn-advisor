// ---------------------------------------------------------------------------
// Thin analytics wrapper around posthog-js. No-ops unless VITE_POSTHOG_KEY is
// set, and only pays the import cost on the first real event — so the mock
// demo path never loads posthog-js at all.
// ---------------------------------------------------------------------------
let posthogPromise = null

function getPosthog() {
  const key = import.meta.env.VITE_POSTHOG_KEY
  if (!key) return null
  if (!posthogPromise) {
    posthogPromise = import('posthog-js').then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
        capture_pageview: false,
      })
      return posthog
    })
  }
  return posthogPromise
}

export function track(event, props) {
  const posthog = getPosthog()
  if (!posthog) return
  posthog.then((ph) => ph.capture(event, props)).catch(() => {})
}
