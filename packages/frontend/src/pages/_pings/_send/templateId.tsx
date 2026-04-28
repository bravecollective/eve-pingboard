import { ApiPingInput } from '@ping-board/common'
import dayjs from 'dayjs'
import { ChangeEventHandler, useEffect, useMemo, useState } from 'react'
import { Button, Col, Form, Modal, Row, Spinner } from 'react-bootstrap'
import { Navigate, useParams } from 'react-router-dom'
import {
  AbsoluteOrRelativeTime,
  toAbsoluteTime,
  useLocalStorage,
  usePingPlaceholders,
} from '../../../hooks'
import { useAddPingMutation, useGetPingTemplatesQuery, useGetUserQuery } from '../../../store'
import { PingInput } from '../../../components/ping-input'
import { PingTimeInput } from '../../../components/ping-time-input'
import './templateId.scss'

export function SendPing(): JSX.Element {
  const me = useGetUserQuery()
  const templates = useGetPingTemplatesQuery()
  const params = useParams()
  const template = useMemo(
    () => templates.data?.templates.find(t => t.id === Number(params.templateId)),
    [params.templateId, templates.data?.templates]
  )

  const [editedPing, setEditedPing, clearEditedPing] = useLocalStorage('sendPing/editedPing', {
    text: '',
    addToCalendar: false,
    calendarEntryTitle: '',
    calendarTime: { relative: dayjs.duration(0).toISOString() } as
      { relative: string } | { absolute: string },
    template: null as null | string,
  })
  const handlePingTextChange = (text: string) => setEditedPing(p => ({
    ...p,
    text,
    template: template?.template ?? null,
  }))
  useEffect(() => {
    if (editedPing.text.trim() === (editedPing.template ?? '').trim()) {
      setEditedPing(p => ({ ...p, text: '' }))
    }
  // We only want this to run when the selected template changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template])

  const pingTime = parsePingTime(editedPing.calendarTime)
  const placeholders = usePingPlaceholders(template ?? null, {
    ...me?.data?.isLoggedIn ? { userName: me.data.character.name } : null,
    addToCalendar: editedPing.addToCalendar,
    calendarEntryTitle: editedPing.calendarEntryTitle,
    calendarTime: pingTime,
  })

  const toggleAddToCalendar = () => {
    setEditedPing(p => ({ ...p, addToCalendar: !p.addToCalendar }))
  }
  const updateCalendarEntryTitle: ChangeEventHandler<HTMLInputElement> = e => {
    setEditedPing(p => ({ ...p, calendarEntryTitle: e.target.value }))
  }

  const updateCalendarTime = (t: AbsoluteOrRelativeTime) => {
    if ('absolute' in t) {
      setEditedPing(p => ({ ...p, calendarTime: { absolute: t.absolute.toISOString() } }))
    } else {
      setEditedPing(p => ({ ...p, calendarTime: { relative: t.relative.toISOString() } }))
    }
  }

  const oldTextSeparator = '\n\n--- old text ---\n\n'
  const pingText = (!!editedPing.text && template && editedPing.template !== template.template)
    ? template.template + oldTextSeparator + (editedPing.text ?? '')
    : editedPing.text || template?.template || ''

  const [
    lastSentPing,
    setLastSentPing,
  ] = useState<{ text: string, templateId: number } | null>(null)

  const canSend = (
    template &&
    (pingText !== lastSentPing?.text || template.id !== lastSentPing.templateId) &&
    pingText.trim() !== template.template.trim() &&
    pingText.trim() !== '' &&
    pingText.indexOf(oldTextSeparator) === -1 &&
    (!template.allowScheduling || !editedPing.addToCalendar || (
      (editedPing.calendarEntryTitle.trim() ?? '') !== '' &&
      (toAbsoluteTime(pingTime).isAfter(dayjs()))
    ))
  )

  const [postPing, postPingState] = useAddPingMutation()
  const handleSendPing = () => {
    if (template && canSend) {
      const input: ApiPingInput = {
        text: pingText,
        templateId: template.id,
      }
      if (template.allowScheduling && editedPing.addToCalendar) {
        input.scheduledFor = toAbsoluteTime(pingTime).toISOString()
        input.scheduledTitle = editedPing.calendarEntryTitle
      }
      setShowSendingDialog(true)
      postPing(input).then(result => {
        if (!('error' in result)) {
          setLastSentPing({ text: input.text, templateId: template.id })
          setEditedPing(p => ({ ...p, text: '' }))
        }
      })
    }
  }

  const [showSendingDialog, setShowSendingDialog] = useState(false)
  const [sendDialogClosing, setSendDialogClosing] = useState(false)
  useEffect(() => {
    if (showSendingDialog && !sendDialogClosing && !postPingState.isLoading) {
      setSendDialogClosing(true)
      setTimeout(() => {
        setShowSendingDialog(false)
        setSendDialogClosing(false)
      }, 2000)
    }
  }, [postPingState.isLoading, postPingState.isSuccess, sendDialogClosing, showSendingDialog])

  if (!template) {
    if (templates.isFetching) {
      return <div>Loading&ellip;</div>
    } else {
      return <Navigate to="../" replace />
    }
  }

  return (<>
    <Form.Group className="mb-3 pe-0 ping">
      {!!template.allowScheduling && (<>
        <Form.Group as={Col} controlId="schedule" xs={12} className="mb-3 pe-0">
          <Form.Label>Ping Options</Form.Label>
          <Form.Check
            checked={editedPing.addToCalendar}
            label="This is a pre-ping (select for more options)"
            onChange={toggleAddToCalendar}
          />
        </Form.Group>
        {editedPing.addToCalendar && (<>
          <Form.Group as={Col} controlid="calendarTitle" xs={12} className="mb-3 pe-0">
            <Form.Label>Calendar Entry Title</Form.Label>
            <Form.Control
              value={editedPing.calendarEntryTitle}
              onChange={updateCalendarEntryTitle}
            />
          </Form.Group>

          <Row className="me-0">
            <Col xs={12} className="pe-0">
              <Form.Label>Calendar Time</Form.Label>
            </Col>
            <PingTimeInput time={pingTime} onChange={updateCalendarTime} />
          </Row>
        </>)}
      </>)}

      <PingInput
        value={pingText}
        onChange={handlePingTextChange}
        placeholders={placeholders}
      />
    </Form.Group>
    <Col xs={12} className="d-flex pe-0">
      <Button variant="warning" onClick={() => clearEditedPing()}>
        Reset Ping
      </Button>
      <div style={{ flexGrow: 1 }} />
      <Button variant="primary" disabled={!canSend} onClick={handleSendPing}>
        Send Ping
      </Button>
    </Col>
    <Modal show={showSendingDialog} size="sm" backdrop="static">
      <Modal.Body className="fs-5">
        {postPingState.isLoading && <>
          <Spinner animation="border" role="status" size="sm">
            <span className="visually-hidden">Sending&hellip;</span>
          </Spinner>{' '}
          Sending&hellip;
        </>}
        {!postPingState.isLoading && postPingState.isError &&
          <span className="text-danger">
            <i className="bi-exclamation-circle" /> Failed to send ping
          </span>
        }
        {!postPingState.isLoading && postPingState.isSuccess &&
          <span className="text-success">
            <i className="bi-check-circle" /> Ping sent
          </span>
        }
      </Modal.Body>
    </Modal>
  </>)
}

function parsePingTime(time: { absolute: string } | { relative: string }): AbsoluteOrRelativeTime {
  if ('absolute' in time) {
    return { absolute: dayjs(time.absolute) }
  }

  // Dayjs is unable to correctly parse negative durations, so we invert them ourselves if needed
  const isNegative = time.relative.startsWith('-')
  const timeMs = dayjs.duration(time.relative).asMilliseconds()
  const sign = (isNegative === timeMs < 0) ? 1 : -1

  return { relative: dayjs.duration(sign * timeMs) }
}
