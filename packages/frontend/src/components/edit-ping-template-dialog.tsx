import clsx from 'clsx'
import { ChangeEvent, useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Col,
  Form,
  Modal,
  Row,
  Table,
} from 'react-bootstrap'
import { ApiPingTemplate, ApiPingTemplateInput } from '@ping-board/common'
import {
  useGetAvailableNeucoreGroupsQuery,
  useGetPingChannelsQuery,
  useGetDiscordChannelsQuery,
} from '../store'
import { dayjs } from '../utils/dayjs'
import './edit-ping-template-dialog.scss'

export interface EditPingTemplateDialogProps {
  show: boolean
  template?: ApiPingTemplate | null
  onSave?: (template: ApiPingTemplateInput) => void
  onCancel?: () => void
  onDelete?: () => void
}
export function EditPingTemplateDialog({
  show,
  template,
  onSave,
  onCancel,
  onDelete,
}: EditPingTemplateDialogProps): JSX.Element {
  const [editedTemplate, setEditedTemplate] = useState<ApiPingTemplateInput>(
    getDefaultEditedTemplate()
  )
  useEffect(() => setEditedTemplate(
    template ? { ...template } : getDefaultEditedTemplate()
  ), [template])
  const canSave = (
    editedTemplate.name.length > 0 &&
    editedTemplate.slackChannelId.length > 0
  )
  const save = () => {
    if (canSave && onSave) {
      const template = editedTemplate
      onSave(template)
      setEditedTemplate(getDefaultEditedTemplate())
    }
  }

  const channels = useGetPingChannelsQuery()
  const discordChannels = useGetDiscordChannelsQuery()
  const neucoreGroups = useGetAvailableNeucoreGroupsQuery()
  const remainingNeucoreGroups = (neucoreGroups.data?.neucoreGroups ?? [])
    .filter(g => !editedTemplate.allowedNeucoreGroups.includes(g.name))

  const isNewTemplate = typeof template?.id !== 'number'
  const lastEdited = !isNewTemplate && [
    `Last edited by ${template?.updatedBy ?? 'unknown'}`,
    template?.updatedAt
      ? `at ${dayjs(template.updatedAt).format('llll')} (${dayjs(template.updatedAt).fromNow()})`
      : 'unknown',
  ].join(' ')

  const setTemplateField = <T extends keyof ApiPingTemplateInput>(
    field: T, value: ApiPingTemplateInput[T]
  ) => {
    setEditedTemplate(t => ({ ...t, [field]: value }))
  }

  const handleSlackChannelChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setEditedTemplate(t => ({ ...t, slackChannelId: e.target.value }))

  const handleDiscordChannelChange = (e: ChangeEvent<HTMLSelectElement>) =>
    setEditedTemplate(t => ({ ...t, discordChannelId: e.target.value || null }))

  const handleAllowSchedulingChange = () =>
    setTemplateField('allowScheduling', !editedTemplate.allowScheduling)

  const handleNeucoreGroupSelected = (e: ChangeEvent<HTMLSelectElement>) =>
    setEditedTemplate(t => ({
      ...t,
      allowedNeucoreGroups: [...t.allowedNeucoreGroups, e.target.value ],
    }))
  const handleRemoveNeucoreGroup = (groupName: string) =>
    setEditedTemplate(t => ({
      ...t,
      allowedNeucoreGroups: t.allowedNeucoreGroups.filter(g => g !== groupName),
    }))

  const [isDeletePending, setIsDeletePending] = useState(false)
  const handleStartDelete = () => setIsDeletePending(true)
  const handleCancelDelete = () => setIsDeletePending(false)
  const handleConfirmDelete = () => {
    setIsDeletePending(false)
    onDelete?.()
    setEditedTemplate(getDefaultEditedTemplate())
  }

  return (
    <Modal show={show} size="lg" backdrop="static">
      <Modal.Header>
        <Modal.Title>{isNewTemplate ? 'Add' : 'Edit'} Ping Template</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            {lastEdited && <Col xs={12} className="mb-3">{lastEdited}</Col>}

            <Form.Group as={Col} controlId="name" xs={12} sm={6} className="mb-3">
              <Form.Label>Template Name</Form.Label>
              <Form.Control
                type="text"
                value={editedTemplate.name}
                onChange={e => setTemplateField('name', e.target.value)}
              />
            </Form.Group>

            <Form.Group as={Col} controlId="slackChannel" xs={12} sm={6} className="mb-3">
              <Form.Label>Targeted Slack Channel</Form.Label>
              <Form.Select
                value={editedTemplate.slackChannelId}
                onChange={handleSlackChannelChange}
              >
                {channels.isLoading &&
                  <option value="">Loading&hellip;</option>
                }
                {!channels.isLoading && ((channels.data?.channels.length ?? 0) < 1
                  ? <option value="">No valid target channels!</option>
                  : <option value="">(Please Select)</option>
                )}
                {!channels.isLoading && channels.data?.channels.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group as={Col} controlId="discordChannel" xs={12} sm={6} className="mb-3">
              <Form.Label>Targeted Discord Channel (Optional)</Form.Label>
              <Form.Select
                value={editedTemplate.discordChannelId ?? ''}
                onChange={handleDiscordChannelChange}
              >
                {discordChannels.isLoading &&
                  <option value="">Loading&hellip;</option>
                }
                {!discordChannels.isLoading && (
                  <option value="">(None)</option>
                )}
                {!discordChannels.isLoading && discordChannels.data?.channels.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Form.Select>
            </Form.Group>

            <Form.Group as={Col} controlId="allowScheduling" xs={12} className="mb-3">
              <Form.Check
                checked={!!editedTemplate.allowScheduling}
                onChange={handleAllowSchedulingChange}
                label={<>
                  Allow Showing the Ping in the Calendar
                  <span className="d-block" style={{fontSize: '0.9rem' }}>
                    Only users with permissions to view pings sent to the target channel will be
                    able to see them in the calendar.
                  </span>
                </>}
              />
            </Form.Group>

            <Form.Group as={Col} controlId="addNeucoreGroup" xs={12} className="mb-3">
              <Form.Label>Neucore Groups Allowed to Ping</Form.Label>
              <Table variant="dark">
                <thead>
                  <tr>
                    <th style={{ width: '100%' }}>Group</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {editedTemplate.allowedNeucoreGroups.length === 0 &&
                    <tr>
                      <td colSpan={2}>
                        <Alert variant="warning" className="mb-0 p-1">
                          <i className="bi-exclamation-triangle" />{' '}
                          All users allowed to ping can use this template
                        </Alert>
                      </td>
                    </tr>
                  }
                  {editedTemplate.allowedNeucoreGroups.map(g => (
                    <tr key={g}>
                      <td className="align-middle">{g}</td>
                      <td>
                        <Button
                          size="sm"
                          onClick={() => handleRemoveNeucoreGroup(g)}
                          className="text-nowrap"
                        >
                          <i className="bi-trash-fill" /> Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {neucoreGroups.isLoading &&
                    <tr><td colSpan={2}>Loading&hellip;</td></tr>
                  }
                  {!neucoreGroups.isLoading &&
                    remainingNeucoreGroups.length < 1 &&
                    editedTemplate.allowedNeucoreGroups.length < 1 &&
                    <tr>
                      <td colSpan={2}>
                        <Alert variant="Error">
                          No Neucore groups configured!
                        </Alert>
                      </td>
                    </tr>
                  }
                  {remainingNeucoreGroups.length > 0 && (
                    <tr>
                      <td colSpan={2}>
                        <Form.Select value="" onChange={handleNeucoreGroupSelected}>
                          <option value="">(Select a group to add)</option>
                          {!neucoreGroups.isLoading && remainingNeucoreGroups.map(g => (
                            <option key={g.id} value={g.name}>{g.name}</option>
                          ))}
                        </Form.Select>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </Form.Group>

            <Form.Group as={Col} controlId="template" xs={12} className="mb-3">
              <Form.Label>Template Text</Form.Label>
              <Form.Control
                as="textarea"
                rows={10}
                value={editedTemplate.template}
                onChange={e => setTemplateField('template', e.target.value)}
              />
            </Form.Group>
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer className="edit-ping-template-dialog-footer">
        <div className={clsx(
          'edit-ping-template-dialog-buttons-wrapper',
          isDeletePending && 'hidden',
        )}>
          {!isNewTemplate && (
            <>
              <Button
                variant="danger"
                disabled={isDeletePending}
                onClick={handleStartDelete}
              >
                Delete
              </Button>
              <div className="edit-ping-template-dialog-buttons-spacer" />
            </>
          )}
          <Button variant="secondary" onClick={onCancel} disabled={isDeletePending}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSave || isDeletePending} onClick={save}>
            Save
          </Button>
        </div>
        {!isNewTemplate && (
          <div className={clsx(
            'edit-ping-template-confirm-delete-buttons-wrapper',
            !isDeletePending && 'hidden'
          )}>
            <Button disabled={!isDeletePending} onClick={handleCancelDelete}>
              No
            </Button>
            <div className="edit-ping-template-dialog-buttons-spacer">
              Are you sure you want to delete this ping template?
            </div>
            <Button variant="danger" disabled={!isDeletePending} onClick={handleConfirmDelete}>
              Yes
            </Button>
          </div>
        )}
      </Modal.Footer>
    </Modal>
  )
}

function getDefaultEditedTemplate(): ApiPingTemplateInput {
  return {
    name: '',
    slackChannelId: '',
    discordChannelId: null,
    template: '',
    allowedNeucoreGroups: [],
    allowScheduling: false,
  }
}
