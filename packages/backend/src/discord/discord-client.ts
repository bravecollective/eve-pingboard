import fetch from 'node-fetch'
import { InMemoryTTLCache } from '../util/in-memory-ttl-cache'

export class DiscordRequestFailedError extends Error {
    constructor(message: string) {
        super(`discord request failed: ${message}`)
    }
}

type DiscordChannel = {
    id: string
    name?: string
    type?: number
}

type DiscordGuild = {
    id: string
    name?: string
}

type DiscordClientOptions = {
    token: string
    guildId?: string
    guildIds?: string[]
    apiBaseUrl?: string
}

type DiscordChannelListItem = {
    id: string
    name: string
    guildId: string
    guildName: string
}

export class DiscordClient {
    private readonly token: string
    private readonly apiBaseUrl: string
    private readonly guildIds: string[]

    constructor(options: DiscordClientOptions) {
        this.token = options.token
        this.guildIds = [
            ...new Set([
                ...(options.guildIds ?? []),
                ...(options.guildId ? [options.guildId] : []),
            ]),
        ]
        this.apiBaseUrl = options.apiBaseUrl ?? 'https://discord.com/api/v10'
    }

    private async request<T>(path: string, init?: { method?: string, body?: unknown }): Promise<T> {
        const url = `${this.apiBaseUrl}${path}`
        const response = await fetch(url, {
            method: init?.method ?? 'GET',
            headers: {
                Authorization: `Bot ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: init?.body ? JSON.stringify(init.body) : undefined,
        })

        if (!response.ok) {
            const text = await response.text().catch(() => '')
            throw new DiscordRequestFailedError(
                `${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`
            )
        }

        // Apparently discord likes to return 204 sometimes, sure, why not
        if (response.status === 204) {
            return undefined as unknown as T
        }

        return await response.json() as T
    }

    private channelCache = new InMemoryTTLCache<void, DiscordChannelListItem[]>({
        defaultTTL: 30 * 60 * 1000,
        get: async () => {
            if (this.guildIds.length === 0) {
                return { value: [] }
            }

            const channelsByGuild = await Promise.all(this.guildIds.map(async guildId => {
                const [guild, channels] = await Promise.all([
                    this.request<DiscordGuild>(`/guilds/${guildId}`),
                    this.request<DiscordChannel[]>(`/guilds/${guildId}/channels`),
                ])

                const guildName = guild.name ?? guildId

                // 0 = regular channel, 5 = special announcement-type channel
                return channels
                    .filter(c =>
                        (c.type === 0 || c.type === 5)
                        && typeof c.id === 'string'
                        && typeof c.name === 'string')
                    .map(c => ({
                        id: c.id,
                        name: c.name as string,
                        guildId,
                        guildName,
                    }))
            }))

            const sorted = channelsByGuild
                .flat()
                .sort((a, b) => {
                    const guildCompare: number= a.guildName.localeCompare(b.guildName)
                    if (guildCompare !== 0) {
                        return guildCompare
                    }

                    return a.name.localeCompare(b.name)
                })

            return { value: sorted }
        },
    })

    async getChannels(): Promise<{ id: string, name: string }[]> {
        const channels = await this.channelCache.get()
        return channels.map(c => ({
            id: c.id,
            name: `${c.guildName} / #${c.name}`,
        }))
    }

    private channelNameCache = new InMemoryTTLCache<string, string>({
        defaultTTL: 30 * 60 * 1000,
        maxEntries: 1000,
        get: async channelId => {
            const channel = await this.request<DiscordChannel>(`/channels/${channelId}`)
            if (typeof channel?.name !== 'string') {
                throw new DiscordRequestFailedError(`invalid discord channel id: ${channelId}`)
            }
            return { value: channel.name }
        },
    })

    async getChannelName(channelId: string): Promise<string> {
        return await this.channelNameCache.get(channelId)
    }

    async postMessage(channelId: string, content: string): Promise<string> {
        const message = await this.request<{ id?: string }>(`/channels/${channelId}/messages`, {
            method: 'POST',
            body: { content },
        })
        if (typeof message.id !== 'string') {
            throw new DiscordRequestFailedError('missing message id in response')
        }
        return message.id
    }

    async deleteMessage(channelId: string, messageId: string): Promise<void> {
        await this.request<void>(`/channels/${channelId}/messages/${messageId}`, {
            method: 'DELETE',
        })
    }
}
