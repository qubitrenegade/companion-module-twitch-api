/**
 * Keep the operator's current channel when it still exists. A fresh connection
 * has no prior selection, so use the first configured channel. Without this
 * fallback, every selected-channel variable remains empty until a Select Channel
 * action runs, even when authentication and channel polling are healthy.
 */
export const selectConfiguredChannel = (current: string, configuredUsernames: string[]): string => {
  return configuredUsernames.includes(current) ? current : (configuredUsernames[0] ?? '')
}
