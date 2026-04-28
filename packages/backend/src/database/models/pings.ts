import { Knex } from 'knex'

export interface Pings {
  id: number
  text: string
  slack_channel_name: string
  slack_channel_id: string
  slack_message_id?: string | null
  discord_channel_name?: string | null
  discord_channel_id?: string | null
  discord_message_id?: string | null
  author: string
  sent_at: Date
}

declare module 'knex/types/tables' {
  interface Tables {
    pings: Knex.CompositeTableType<
      Pings,
      Omit<Pings, 'id'>
    >
  }
}
