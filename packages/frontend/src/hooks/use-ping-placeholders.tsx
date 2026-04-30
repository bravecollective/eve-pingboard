import { useMemo } from 'react'
import { ApiPingTemplate } from '@ping-board/common'
import { Time } from '../components/time'
import { AbsoluteOrRelativeTime, toAbsoluteTime } from './use-absolute-relative-time-input'

export interface PingPlaceholder {
  placeholder: string
  description: React.ReactNode
}
export function usePingPlaceholders(template: ApiPingTemplate | null, options: {
  userName?: string,
  addToCalendar?: boolean,
  calendarEntryTitle?: string,
  calendarTime?: AbsoluteOrRelativeTime,
}): PingPlaceholder[] {
  return useMemo(() => {
    if (!template) {
      return [] as PingPlaceholder[]
    }
    const placeholders: PingPlaceholder[] = []
    if (options.userName) {
      placeholders.push({
        placeholder: 'me',
        description: `the name of the character you are logged in with (${options.userName})`,
      })
    }
    if (template.allowScheduling && options.addToCalendar) {
      if (typeof options.calendarEntryTitle === 'string') {
        placeholders.push({
          placeholder: 'title',
          description: `the title of the calendar entry${
            options.calendarEntryTitle && ` (${options.calendarEntryTitle})`
          }`,
        })
      }
      if (options.calendarTime) {
        placeholders.push({
          placeholder: 'time',
          description: (<>
            the scheduled date and time (<Time
              time={toAbsoluteTime(options.calendarTime)}
              asLink
              format={'YYYY-MM-DD HH:mm'}
            />) followed by a countdown.
            The date-time is converted to the local timezone of whoever's viewing it,
            and the countdown updates automatically.
            Both link to a 
            <a href="https://time.nakamura-labs.com/" target="_blank" rel="noreferrer">
              Nakamura time link
            </a>
          </>),
        })
      }
    }
    return placeholders
  }, [
    options.addToCalendar,
    options.calendarEntryTitle,
    options.calendarTime,
    options.userName,
    template,
  ])
}
