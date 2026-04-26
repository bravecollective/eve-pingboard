import Router from '@koa/router'
import { Channel } from '@slack/web-api/dist/response/ConversationsListResponse'
import { BadRequest, Forbidden, InternalServerError, NotFound, Unauthorized } from 'http-errors'
import * as yup from 'yup'
import {
  ApiNeucoreGroupsResponse,
  ApiPingInput,
  ApiPingTemplateInput,
  ApiPingTemplatesResponse,
  ApiPingViewPermissions,
  ApiPingViewPermissionsByGroupInput,
  ApiPingViewPermissionsByChannelInput,
  ApiSlackChannelsResponse,
  ApiPingViewPermission,
  ApiPingsResponse,
  ApiScheduledPingsResponse,
} from '@ping-board/common'
import { UserRoles, userRoles } from '../../middleware/user-roles'
import { SlackClient, slackLink, SlackRequestFailedError } from '../../slack/slack-client'
import { NeucoreClient } from '../../neucore'
import { dayjs } from '../../util/dayjs'
import { PingsRepository, UnknownTemplateError } from '../../database'
import { extractDateQueryParam, extractQueryParam } from '../../util/extract-query-param'

export function getRouter(options: {
  neucoreClient: NeucoreClient,
  slackClient: SlackClient,
  pings: PingsRepository,
}): Router {
  const router = new Router()

  router.get('/', userRoles.requireOneOf(UserRoles.PING), async ctx => {
    if (!ctx.session?.character) {
      throw new Unauthorized()
    }
    const beforeParam = ctx.query['before']
    const before = typeof beforeParam === 'string' ? new Date(beforeParam) : undefined
    const pings = await options.pings.getPings({
      characterName: ctx.session.character.name,
      neucoreGroups: await ctx.getNeucoreGroups(),
      before,
    })
    const response: ApiPingsResponse = { ...pings }
    ctx.body = response
  })

  router.post('/', userRoles.requireOneFreshOf(UserRoles.PING), async ctx => {
    if (!ctx.session?.character) {
      throw new Unauthorized()
    }
    const ping = await validatePingInput(ctx.request.body)
    const template = await options.pings.getPingTemplate({ id: ping.templateId })
    if (!template) {
      throw new BadRequest('unvalid template id')
    }
    if (!!ping.scheduledFor !== !!ping.scheduledTitle) {
      throw new BadRequest('either specify both a calendar time and title or neither of both')
    }
    const groups = await ctx.getNeucoreGroups()
    if (
      template.allowedNeucoreGroups.length > 0 &&
      !template.allowedNeucoreGroups.some(g => groups.includes(g))
    ) {
      throw new Forbidden('you are not permitted to ping using this template')
    }

    const placeholders: { placeholder: string, value: string | (() => string) }[] = [
      { placeholder: 'me', value: ctx.session.character?.name ?? '' },
      { placeholder: 'title', value: () => ping.scheduledTitle ?? '' },
      { placeholder: 'time', value: () => {
        if (!ping.scheduledFor) {
          return ''
        }
        const time = dayjs.utc(ping.scheduledFor)
        return slackLink(
          `https://time.nakamura-labs.com/#${time.unix()}`,
          `${time.format('YYYY-MM-DD HH:mm')} (${time.fromNow()})`
        )
      } },
    ]
    const formattedText = placeholders.reduce(
      (text, { placeholder, value }) => text.replace(
        new RegExp(`{{${placeholder}}}`, 'igm'),
        () => typeof value === 'function' ? value() : value
      ),
      ping.text
    )

    try {
      const characterName = ctx.session.character.name
      const pingDate = new Date()
      const wrappedText = [
        `<!channel> ${!ping.scheduledFor ? 'PING' : '### PRE-PING ###'}`,
        '\n\n',
        formattedText,
        '\n\n',
        `> ${dayjs(pingDate).format('YYYY-MM-DD HH:mm:ss')} `,
        `- *${characterName}* to #${template.slackChannelName}`,
      ].join('')
      const slackMessageId = await options.slackClient.postMessage(
        template.slackChannelId,
        wrappedText
      )
      try {
        const p = await options.pings.addPing({
          text: wrappedText,
          characterName,
          template,
          scheduledTitle: ping.scheduledTitle,
          scheduledFor: ping.scheduledFor,
          slackMessageId,
        })
        ctx.status = 201
        ctx.body = p
      } catch (error) {
        // Storing the ping in the database failed, let's delete the corresponding slack message
        // and pretend we never event sent a ping in the first place.
        await options.slackClient.deleteMessage(template.slackChannelId, slackMessageId)
        throw error
      }
    } catch (error) {
      if (error instanceof SlackRequestFailedError) {
        throw new InternalServerError(error.message)
      }
      throw error
    }
  })

  router.get('/scheduled', userRoles.requireOneOf(UserRoles.PING), async ctx => {
    if (!ctx.session?.character) {
      throw new Unauthorized()
    }

    const before = extractDateQueryParam(ctx, 'before')
    const after = extractDateQueryParam(ctx, 'after')
    const count = extractQueryParam(ctx, 'count', v => {
      const n = parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? Math.ceil(n) : null
    })

    const response: ApiScheduledPingsResponse = await options.pings.getScheduledEvents({
      characterName: ctx.session.character.name,
      neucoreGroups: await ctx.getNeucoreGroups(),
      before,
      after,
      count,
    })
    ctx.body = response
  })

  router.get('/channels', userRoles.requireOneOf(UserRoles.PING_TEMPLATES_WRITE), async ctx => {
    const channels = await options.slackClient.getChannels()
    const response: ApiSlackChannelsResponse = {
      channels: channels.flatMap(c => typeof c.id === 'string' && typeof c.name === 'string'
        ? [{ id: c.id, name: c.name }]
        : []
      ),
    }
    ctx.body = response
  })

  router.get(
    '/neucore-groups',
    userRoles.requireOneOf(UserRoles.PING_TEMPLATES_WRITE),
    async ctx => {
      const appInfo = await options.neucoreClient.getAppInfo()
      const response: ApiNeucoreGroupsResponse = {
        neucoreGroups: appInfo.groups,
      }
      ctx.body = response
    }
  )

  router.get('/templates', userRoles.requireOneOf(UserRoles.PING), async ctx => {
    const templates = await options.pings.getPingTemplates()
    const canSeeAllTemplates = await ctx.hasRoles(UserRoles.PING_TEMPLATES_WRITE)
    let response: ApiPingTemplatesResponse
    if (canSeeAllTemplates) {
      response = { templates }
    } else {
      const neucoreGroups = await ctx.getNeucoreGroups()
      response = {
        templates: templates.filter(t =>
          t.allowedNeucoreGroups.length === 0 ||
          t.allowedNeucoreGroups.some(g => neucoreGroups.includes(g))
        ),
      }
    }
    ctx.body = response
  })

  router.post(
    '/templates',
    userRoles.requireOneFreshOf(UserRoles.PING_TEMPLATES_WRITE),
    async ctx => {
      const template = await validateTemplateInput(ctx.request.body)
      const channelName = await options.slackClient.getChannelName(template.slackChannelId)
      const createdTemplate = await options.pings.addPingTemplate({
        input: {
          ...template,
          slackChannelName: channelName,
        },
        characterName: ctx.session?.character?.name ?? '',
      })
      ctx.body = createdTemplate
    }
  )

  router.put(
    '/templates/:templateId',
    userRoles.requireOneFreshOf(UserRoles.PING_TEMPLATES_WRITE),
    async ctx => {
      const templateId = parseInt(ctx.params['templateId'] ?? '', 10)
      if (!isFinite(templateId)) {
        throw new BadRequest(`invalid templateId: ${ctx.params['templateId']}`)
      }
      const template = await validateTemplateInput(ctx.request.body)
      const channelName = await options.slackClient.getChannelName(template.slackChannelId)
      try {
        const updatedTemplate = await options.pings.setPingTemplate({
          id: templateId,
          template: {
            ...template,
            slackChannelName: channelName,
          },
          characterName: ctx.session?.character?.name ?? '',
        })
        ctx.body = updatedTemplate
      } catch (e) {
        if (e instanceof UnknownTemplateError) {
          throw new NotFound()
        }
        throw e
      }
    }
  )

  router.delete(
    '/templates/:templateId',
    userRoles.requireOneFreshOf(UserRoles.PING_TEMPLATES_WRITE),
    async ctx => {
      const templateId = parseInt(ctx.params['templateId'] ?? '', 10)
      if (!isFinite(templateId)) {
        throw new BadRequest(`invalid templateId: ${ctx.params['templateId']}`)
      }
      try {
        await options.pings.deletePingTemplate({ id: templateId })
        ctx.status = 204
      } catch (e) {
        if (e instanceof UnknownTemplateError) {
          throw new NotFound()
        }
        throw e
      }
    }
  )

  router.get('/view-permissions',
    userRoles.requireOneOf(UserRoles.PING_TEMPLATES_WRITE),
    async ctx => {
      const [viewPermissions, slackChannels] = await Promise.all([
        options.pings.getPingViewPermissions(),
        options.slackClient.getChannels(),
      ])
      const response = buildApiPingViewPermissionsResponse(viewPermissions, slackChannels)
      ctx.body = response
    }
  )

  router.put(
    '/view-permissions/groups/:group',
    userRoles.requireOneFreshOf(UserRoles.PING_TEMPLATES_WRITE),
    async ctx => {
      const neucoreGroup = ctx.params['group']
      if (!neucoreGroup) {
        throw new BadRequest('invalid neucore group')
      }
      const appInfo = await options.neucoreClient.getAppInfo()
      if (!appInfo.groups.some(g => g.name === neucoreGroup)) {
        throw new BadRequest('invalid neucore group')
      }
      const input = await validateViewPermissionsByGroupInput(ctx.request.body)
      const slackChannels = await options.slackClient.getChannels()
      const invalidSlackChannels = input.allowedSlackChannelIds
        .filter(c => !slackChannels.some(sc => sc.id === c))
      if (invalidSlackChannels.length > 0) {
        throw new BadRequest(`invalid slack channel id: ${invalidSlackChannels.join(', ')}`)
      }

      const viewPermissions = await options.pings.setPingViewPermissionsByGroup({
        neucoreGroup,
        channelIds: input.allowedSlackChannelIds,
      })
      const response = buildApiPingViewPermissionsResponse(viewPermissions, slackChannels)
      ctx.body = response
    }
  )

  router.put(
    '/view-permissions/channels/:channelId',
    userRoles.requireOneFreshOf(UserRoles.PING_TEMPLATES_WRITE),
    async ctx => {
      const channelId = ctx.params['channelId']
      if (!channelId) {
        throw new BadRequest('invalid slack channel id')
      }
      const slackChannels = await options.slackClient.getChannels()
      if (!slackChannels.some(c => c.id === channelId)) {
        throw new BadRequest('invalid slack channel id')
      }

      const input = await validateViewPermissionsByChannelInput(ctx.request.body)
      const appInfo = await options.neucoreClient.getAppInfo()
      const invalidNeucoreGroups = input.allowedNeucoreGroups
        .filter(g => !appInfo.groups.some(ng => ng.name === g))
      if (invalidNeucoreGroups.length > 0) {
        throw new BadRequest(`invalid neucore group: ${invalidNeucoreGroups.join(', ')}`)
      }

      const viewPermissions = await options.pings.setPingViewPermissionsByChannel({
        channelId,
        neucoreGroups: input.allowedNeucoreGroups,
      })
      const response = buildApiPingViewPermissionsResponse(viewPermissions, slackChannels)
      ctx.body = response
    }
  )

  return router
}

const pingSchema = yup.object().noUnknown(true).shape({
  templateId: yup.number().required(),
  text: yup.string().min(1),
  scheduledTitle: yup.string().min(1).notRequired(),
  scheduledFor: yup.date().notRequired(),
})
async function validatePingInput(
  raw: unknown
): Promise<ApiPingInput> {
  const isValid = await pingSchema.isValid(raw)
  if (isValid) {
    return pingSchema.cast(raw) as unknown as ApiPingInput
  }
  throw new BadRequest('invalid input')
}

const templateSchema = yup.object().noUnknown(true).shape({
  name: yup.string().required().min(1),
  slackChannelId: yup.string().min(1),
  template: yup.string().min(0),
  allowedNeucoreGroups: yup.array(yup.string().min(1)).min(0),
  allowScheduling: yup.boolean().notRequired(),
})
async function validateTemplateInput(
  raw: unknown
): Promise<ApiPingTemplateInput> {
  const isValid = await templateSchema.isValid(raw)
  if (isValid) {
    return templateSchema.cast(raw) as unknown as ApiPingTemplateInput
  }
  throw new BadRequest('invalid input')
}

const viewPermissionsByGroupSchema = yup.object().noUnknown(true).shape({
  allowedSlackChannelIds: yup.array(yup.string().min(1)).min(0),
})
async function validateViewPermissionsByGroupInput(
  raw: unknown
): Promise<ApiPingViewPermissionsByGroupInput> {
  if (await viewPermissionsByGroupSchema.isValid(raw)) {
    return viewPermissionsByGroupSchema.cast(raw) as unknown as ApiPingViewPermissionsByGroupInput
  }
  throw new BadRequest('invalid input')
}

const viewPermissionsByChannelSchema = yup.object().noUnknown(true).shape({
  allowedNeucoreGroups: yup.array(yup.string().min(1)).min(0),
})
async function validateViewPermissionsByChannelInput(
  raw: unknown
): Promise<ApiPingViewPermissionsByChannelInput> {
  if (await viewPermissionsByChannelSchema.isValid(raw)) {
    return viewPermissionsByChannelSchema
      .cast(raw) as unknown as ApiPingViewPermissionsByChannelInput
  }
  throw new BadRequest('invalid input')
}

function buildApiPingViewPermissionsResponse(
  dbResult: Omit<ApiPingViewPermission, 'slackChannelName'>[],
  slackChannels: Channel[],
): ApiPingViewPermissions {
  return {
    viewPermissions: dbResult.map(p => ({
      ...p,
      slackChannelName: slackChannels.find(c => c.id === p.slackChannelId)?.name ?? '',
    })),
  }
}
