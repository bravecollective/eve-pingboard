export interface ApiDiscordChannel {
  id: string
  name: string
}

export interface ApiDiscordChannelsResponse {
  channels: ApiDiscordChannel[]
}
