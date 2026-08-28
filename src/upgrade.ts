import type { CompanionStaticUpgradeScript } from '@companion-module/base'
import type { Config } from './config'
import { normalizeConfig } from './config'

export const getUpgrades = (): CompanionStaticUpgradeScript<Config>[] => {
  return [
    (_context, props) => {
      /*
       * Companion only runs this transformation for saved configurations that
       * predate the script. Explicit defaults prevent an upgrade from silently
       * enabling network polling or requesting an additional OAuth scope.
       */
      const updatedConfig = props.config ? normalizeConfig(props.config) : null
      return { updatedConfig, updatedActions: [], updatedFeedbacks: [] }
    },
  ]
}
