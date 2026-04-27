import Router from '@koa/router'
import { ApiMeResponse } from '@ping-board/common'
import { NeucoreClient } from '../neucore'
import { SlackClient } from '../slack/slack-client'
import { EventsRepository, PingsRepository } from '../database'
import { getRouter as getEventRouter } from './api/events'
import { getRouter as getPingsRouter } from './api/pings'
import {DiscordClient} from "../discord/discord-client";

export function getRouter(options: {
  neucoreClient: NeucoreClient,
  slackClient: SlackClient,
  discordClient: DiscordClient,
  events: EventsRepository,
  pings: PingsRepository,
}): Router {
  const router = new Router()

  router.get('/me', async ctx => {
    const response: ApiMeResponse = ctx.session?.character
      ? {
          isLoggedIn: true,
          character: {
            id: ctx.session.character.id,
            name: ctx.session.character.name,
            roles: await ctx.getRoles(),
          },
        }
      : { isLoggedIn: false }

    ctx.body = response
  })

  const eventsRouter = getEventRouter(options)
  router.use('/events', eventsRouter.routes(), eventsRouter.allowedMethods())

  const pingsRouter = getPingsRouter(options)
  router.use('/pings', pingsRouter.routes(), pingsRouter.allowedMethods())

  return router
}
