import Router from '@koa/router'
import Koa from 'koa'
import bodyParser from 'koa-bodyparser'
import { UserRoles } from '@ping-board/common'
import { EventsRepository, PingsRepository } from './database'
import { getSessionMiddleware, SessionProvider } from './middleware/session'
import { getUserRolesMiddleware, NeucoreGroupsProvider } from './middleware/user-roles'
import { NeucoreClient } from './neucore'
import { getRouter as getApiRouter } from './routes/api'
import { getRouter as getAuthRouter } from './routes/auth'
import { EveSSOClient } from './sso/eve-sso-client'
import { SlackClient } from './slack/slack-client'
import { DiscordClient } from './discord/discord-client'

export function getApp(options: {
  eveSsoClient: EveSSOClient,
  neucoreClient: NeucoreClient,
  neucoreGroupsProvider: NeucoreGroupsProvider,
  slackClient: SlackClient,
  discordClient: DiscordClient,
  sessionProvider: SessionProvider,
  sessionTimeout: number,
  sessionRefreshInterval: number,
  cookieSigningKeys?: string[],
  events: EventsRepository,
  pings: PingsRepository,
  neucoreToUserRolesMapping: Map<string, UserRoles[]>,
}): Koa {
  const app = new Koa()
  if (options.cookieSigningKeys && options.cookieSigningKeys.length > 0) {
    app.keys = options.cookieSigningKeys
  }

  const appRouter = new Router()

  app.use(getSessionMiddleware({
    app,
    sessionCookieName: 'pingboard-session',
    sessionProvider: options.sessionProvider,
    sessionTimeout: options.sessionTimeout,
    sessionRefreshInterval: options.sessionRefreshInterval,
  }))
  app.use(getUserRolesMiddleware(options))
  app.use(bodyParser({ enableTypes: ['json'] }))

  const apiRouter = getApiRouter(options)
  const authRouter = getAuthRouter(options)

  appRouter.use('/api', apiRouter.routes(), apiRouter.allowedMethods())
  appRouter.use('/auth', authRouter.routes(), authRouter.allowedMethods())

  app.use(appRouter.routes()).use(appRouter.allowedMethods())

  return app
}