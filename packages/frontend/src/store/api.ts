import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/dist/query/react'
import {
  ApiDiscordChannelsResponse,
  ApiEventEntry,
  ApiEventEntryInput,
  ApiEventsResponse,
  ApiMeResponse,
  ApiNeucoreGroupsResponse,
  ApiPing,
  ApiPingInput,
  ApiPingsResponse,
  ApiPingTemplate,
  ApiPingTemplateInput,
  ApiPingTemplatesResponse,
  ApiPingViewPermissions,
  ApiPingViewPermissionsByGroupInput,
  ApiSlackChannelsResponse,
  ApiSolarSystemsResponse,
} from '@ping-board/common'

export const apiSlice = createApi({
  reducerPath: 'loginApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/', credentials: 'same-origin' }),
  tagTypes: [
    'User',
    'Event',
    'Ping',
    'PingTemplate',
    'PingChannel',
    'DiscordChannel',
    'NeucoreGroup',
    'PingViewPermission',
  ],
  endpoints: builder => ({
    /* User Management */
    getUser: builder.query<ApiMeResponse, void>({
      query: () => 'api/me',
      providesTags: ['User'],
    }),
    logOut: builder.mutation<void, void>({
      query: () => ({ url: 'auth/logout', method: 'POST' }),
      invalidatesTags: ['User', 'Event'],
    }),

    /* Events */
    getEvents: builder.query<ApiEventsResponse, GetEventsOptions>({
      query: params => ({ url: 'api/events', params }),
      providesTags: (result) => result && result.events.length > 0
        ? result.events.map(({ id }) => ({ type: 'Event', id }))
        : ['Event'],
    }),
    addEvent: builder.mutation<ApiEventEntry, ApiEventEntryInput>({
      query: event => ({ url: 'api/events', method: 'POST', body: event }),
      invalidatesTags: ['Event'],
    }),
    updateEvent: builder.mutation<ApiEventEntry, { id: number, event: ApiEventEntryInput }>({
      query: ({ id, event }) => ({ url: `api/events/${id}`, method: 'PUT', body: event }),
      invalidatesTags: ['Event'],
    }),
    deleteEvent: builder.mutation<void, number>({
      query: id => ({ url: `api/events/${id}`, method: 'DELETE' }),
      invalidatesTags: (result, _, arg) => result ? [{ type: 'Event', id: arg }] : ['Event'],
    }),
    getSolarSystems: builder.query<ApiSolarSystemsResponse, void>({
      query: () => 'api/events/solarSystems',
    }),

    /* Pings */
    getPings: builder.query<ApiPingsResponse, { before?: string } | void>({
      query: params => ({ url: 'api/pings', params: params || undefined }),
      providesTags: result => result && result.pings.length > 0
        ? result.pings.map(({ id }) => ({ type: 'Ping', id }))
        : ['Ping'],
    }),
    addPing: builder.mutation<ApiPing, ApiPingInput>({
      query: ping => ({ url: 'api/pings', method: 'POST', body: ping }),
      invalidatesTags: result => result ? [({ type: 'Ping', id: result.id })] : ['Ping'],
    }),
    getPingChannels: builder.query<ApiSlackChannelsResponse, void>({
      query: () => ({ url: 'api/pings/channels' }),
      providesTags: result => result && result.channels.length > 0
        ? result.channels.map(({ id }) => ({ type: 'PingChannel', id }))
        : ['PingChannel'],
    }),
    getDiscordChannels: builder.query<ApiDiscordChannelsResponse, void>({
      query: () => ({ url: 'api/pings/discord-channels' }),
      providesTags: result => result && result.channels.length > 0
        ? result.channels.map(({ id }) => ({ type: 'DiscordChannel', id }))
        : ['DiscordChannel'],
    }),
    getAvailableNeucoreGroups: builder.query<ApiNeucoreGroupsResponse, void>({
      query: () => ({ url: 'api/pings/neucore-groups' }),
      providesTags: result => result && result.neucoreGroups.length > 0
        ? result.neucoreGroups.map(({ id }) => ({ type: 'NeucoreGroup', id }))
        : ['NeucoreGroup'],
    }),
    getPingTemplates: builder.query<ApiPingTemplatesResponse, void>({
      query: () => ({ url: 'api/pings/templates' }),
      providesTags: (result) => result && result.templates.length > 0
        ? result.templates.map(({ id }) => ({ type: 'PingTemplate', id }))
        : ['PingTemplate'],
    }),
    addPingTemplate: builder.mutation<ApiPingTemplate, ApiPingTemplateInput>({
      query: template => ({ url: 'api/pings/templates', method: 'POST', body: template }),
      invalidatesTags: ['PingTemplate'],
    }),
    updatePingTemplate: builder
      .mutation<ApiPingTemplate, { id: number, template: ApiPingTemplateInput }>({
        query: ({ id, template }) => ({
          url: `api/pings/templates/${id}`,
          method: 'PUT',
          body: template,
        }),
        invalidatesTags: result =>
          result ? [{ type: 'PingTemplate', id: result.id }] : ['PingTemplate'],
    }),
    deletePingTemplate: builder.mutation<void, number>({
      query: id => ({ url: `api/pings/templates/${id}`, method: 'DELETE' }),
      invalidatesTags: (result, _, arg) =>
        result ? [{ type: 'PingTemplate', id: arg }] : ['PingTemplate'],
    }),
    getPingViewPermissions: builder.query<ApiPingViewPermissions, void>({
      query: () => ({ url: 'api/pings/view-permissions' }),
      providesTags: ['PingViewPermission'],
    }),
    updatePingViewPermissionsByNeucoreGroup: builder.mutation<
      ApiPingViewPermissions,
      ApiPingViewPermissionsByGroupInput & { neucoreGroup: string }
    >({
      query: ({ neucoreGroup, ...body }) => ({
        url: `api/pings/view-permissions/groups/${neucoreGroup}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['PingViewPermission', 'Ping'],
    }),
  }),
})

export interface GetEventsOptions {
  before?: string
  after?: string
  count?: number
}

export const {
  useGetUserQuery,
  useLogOutMutation,

  useGetEventsQuery,
  useAddEventMutation,
  useUpdateEventMutation,
  useDeleteEventMutation,
  useGetSolarSystemsQuery,

  useGetPingsQuery,
  useAddPingMutation,
  useGetPingChannelsQuery,
  useGetDiscordChannelsQuery,
  useGetAvailableNeucoreGroupsQuery,
  useGetPingTemplatesQuery,
  useAddPingTemplateMutation,
  useUpdatePingTemplateMutation,
  useDeletePingTemplateMutation,
  useGetPingViewPermissionsQuery,
  useUpdatePingViewPermissionsByNeucoreGroupMutation,
} = apiSlice
