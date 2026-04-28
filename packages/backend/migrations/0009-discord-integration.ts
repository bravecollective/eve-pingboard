import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
    await knex.schema.alterTable('ping_templates', table => {
        table.string('discord_channel_id', 255).nullable().defaultTo(null)
    })

    await knex.schema.alterTable('pings', table => {
        table.string('discord_channel_id', 255).nullable().defaultTo(null)
        table.string('discord_channel_name', 255).nullable().defaultTo(null)
        table.string('discord_message_id', 255).nullable().defaultTo(null)
    })
}

export async function down(knex: Knex): Promise<void> {
    await knex.schema.alterTable('pings', table => {
        table.dropColumn('discord_message_id')
        table.dropColumn('discord_channel_name')
        table.dropColumn('discord_channel_id')
    })

    await knex.schema.alterTable('ping_templates', table => {
        table.dropColumn('discord_channel_id')
    })
}