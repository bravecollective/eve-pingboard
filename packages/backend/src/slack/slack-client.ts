import { LogLevel, WebClient } from '@slack/web-api'
import { Channel } from '@slack/web-api/dist/response/ConversationsListResponse'
import { InMemoryTTLCache } from '../util/in-memory-ttl-cache'
import {dayjs} from '../util/dayjs'

export class InvalidChannelIdError extends Error {
  constructor(id: string) {
    super(`invalid slack channel id: ${id}`)
  }
}

export class SlackRequestFailedError extends Error {
  constructor(error?: string) {
    super(`slack request failed: ${error || 'unknown reason'}`)
  }
}

export class SlackClient {
  private client: WebClient

  constructor(token: string, apiBaseUrl?: string) {
    this.client = new WebClient(token, {
      logLevel: LogLevel.DEBUG,
      slackApiUrl: apiBaseUrl,
    })
  }

  private channelCache = new InMemoryTTLCache<void, Channel[]>({
    defaultTTL: 30 * 60 * 1000,
    get: async () => {
      let channels: Channel[] = []
      let cursor: string | undefined
      do {
        const page = await this.client.conversations.list({
          types: [
            'public_channel',
            'private_channel',
          ].join(','),
          exclude_archived: true,
          cursor,
        })
        if (page.ok && page.channels) {
          channels = [...channels, ...page.channels]
        } else {
          throw new Error(`Error querying slack channels: ${page.error ?? 'unknown error'}`)
        }
        cursor = page.response_metadata?.next_cursor
      } while (cursor)

      return {
        value: channels.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '')),
      }
    },
  })
  async getChannels(): Promise<Channel[]> {
    return await this.channelCache.get()
  }

  private channelNameCache = new InMemoryTTLCache<string, string>({
    defaultTTL: 30 * 60 * 1000,
    maxEntries: 1000,
    get: async channelId => {
      const response = await this.client.conversations.info({
        channel: channelId,
      })
      if (typeof response.channel?.name !== 'string') {
        throw new InvalidChannelIdError(channelId)
      }
      return { value: response.channel.name }
    },
  })
  async getChannelName(channelId: string): Promise<string> {
    return await this.channelNameCache.get(channelId)
  }

  async postMessage(channelId: string, text: string): Promise<string> {
    const response = await this.client.chat.postMessage({
      link_names: true,
      channel: channelId,
      text,
    })
    if (!response.ok || !response.message?.ts) {
      throw new SlackRequestFailedError(response.error)
    }
    return response.message.ts
  }

  async deleteMessage(channelId: string, messageId: string): Promise<void> {
    const response = await this.client.chat.delete({
      channel: channelId,
      ts: messageId,
    })
    if (!response.ok) {
      throw new SlackRequestFailedError(response.error)
    }
  }
}

export function slackLink(href: string, title: string): string {
  return `<${href.replace(/\|/g, '%7C')}|${title.replace(/>/g, '\\>')}>`
}

export function slackTimestamp(timestamp: number): string {
  // eslint-disable-next-line max-len
  return `<!date^${timestamp}^{date} {time} ({ago})^https://time.nakamura-labs.com/#${timestamp}|${dayjs.utc(timestamp).format('YYYY-MM-DD HH:mm:ss')}>`
}
