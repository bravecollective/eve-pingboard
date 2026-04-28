import { getApp } from './app'
import { knexInstance, EventsRepository, PingsRepository } from './database'
import { NeucoreClient } from './neucore'
import { EveSSOClient } from './sso/eve-sso-client'
import { InMemorySessionProvider } from './util/in-memory-session-provider'
import { UserRoles } from '@ping-board/common'
import { SlackClient } from './slack/slack-client'
import { NeucoreGroupCache } from './neucore/neucore-group-cache'
import { DiscordClient } from './discord/discord-client'

async function main() {
  const eveSsoClient = new EveSSOClient({
    clientId: getFromEnv('SSO_CLIENT_ID'),
    clientSecret: getFromEnv('SSO_CLIENT_SECRET'),
    redirectUri: getFromEnv('SSO_REDIRECT_URI'),
    accessTokenUri: getOptionalFromEnv('SSO_TOKEN_URI'),
    authorizationUri: getOptionalFromEnv('SSO_AUTHORIZATION_URI'),
  })
  eveSsoClient.startAutoCleanup()

  const neucoreClient = new NeucoreClient({
    baseUrl: getFromEnv('CORE_URL'),
    appId: getFromEnv('CORE_APP_ID'),
    appToken: getFromEnv('CORE_APP_TOKEN'),
  })
  const neucoreGroupsProvider = new NeucoreGroupCache({
    neucoreClient,
    cacheTTL: getNumberFromEnv('CORE_GROUP_REFRESH_INTERVAL', 60) * 1000,
  })

  const slackClient = new SlackClient(
    getFromEnv('SLACK_TOKEN'),
    getOptionalFromEnv('SLACK_API_BASE_URL')
  )

  const discordClient = new DiscordClient({
    token: getFromEnv('DISCORD_TOKEN'),
    guildId: getOptionalFromEnv('DISCORD_GUILD_ID'),
    apiBaseUrl: getOptionalFromEnv('DISCORD_API_BASE_URL'),
  })

  const sessionTimeout = getNumberFromEnv('SESSION_TIMEOUT', 7 * 24 * 60 * 60) * 1000
  const sessionRefreshInterval = getNumberFromEnv('SESSION_REFRESH_INTERVAL', 60) * 1000
  const sessionProvider = new InMemorySessionProvider()
  sessionProvider.startAutoCleanup()


  const cookieSigningKeys = process.env.COOKIE_KEY?.split(' ')

  const knex = await knexInstance()
  const events = new EventsRepository(knex)
  const pings = new PingsRepository(knex)

  if (process.env.GROUPS_WRITE_EVENTS) {
    console.warn('Using GROUPS_WRITE_EVENTS is deprecated, use GROUPS_EDIT_EVENTS instead')
  }

  const groupsByRole: [UserRoles, string | undefined][] = [
    [UserRoles.EVENTS_READ, process.env.GROUPS_READ_EVENTS],
    [UserRoles.EVENTS_ADD, process.env.GROUPS_ADD_EVENTS],
    [UserRoles.EVENTS_EDIT, process.env.GROUPS_EDIT_EVENTS || process.env.GROUPS_WRITE_EVENTS],
    [UserRoles.PING, process.env.GROUPS_PING],
    [UserRoles.PING_TEMPLATES_WRITE, process.env.GROUPS_WRITE_PING_TEMPLATES],
  ]
  const neucoreToUserRolesMapping = groupsByRole.reduce(
    (byGroup, [role, groups]) => (groups ?? '').split(' ')
      .reduce((byGroup, group) => byGroup.set(group, [...byGroup.get(group) ?? [], role]), byGroup)
    , new Map<string, UserRoles[]>()
  )

  const app = getApp({
    eveSsoClient,
    neucoreClient,
    neucoreGroupsProvider,
    slackClient,
    discordClient,
    sessionProvider,
    sessionTimeout,
    sessionRefreshInterval,
    cookieSigningKeys,
    events,
    pings,
    neucoreToUserRolesMapping,
  })

  const port = process.env.PORT ?? '3000'
  await new Promise<void>((resolve, reject) => {
    const listenTimeout = 10
    const timeout = setTimeout(() => reject(
      new Error(`Timed out after ${listenTimeout}s while trying to listen on port ${port}`)
    ), listenTimeout * 1000)
    app.listen(parseInt(port), () => {
      clearTimeout(timeout)
      resolve()
    })
  })

  console.log(`Listening on port ${port}`)
}

function getFromEnv(key: string): string {
  const value = process.env[key]
  if (typeof value !== 'string') {
    throw new Error(`Missing env variable: ${key}`)
  }
  return value
}

function getOptionalFromEnv(key: string): string | undefined {
  const value = process.env[key]
  if (value) return value
  return undefined
}

function getNumberFromEnv(key: string, fallback?: number): number {
  const value = process.env[key]
  if (typeof value !== 'string') {
    if (typeof fallback === 'number') {
      return fallback
    }
    throw new Error(`Missing env variable: ${key}`)
  }
  const asNumber = Number(value)
  if (!Number.isFinite(asNumber)) {
    throw new Error(`Env variable is not a number: ${key}`)
  }
  return asNumber
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
