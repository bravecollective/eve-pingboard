import { ChangeEvent, useMemo, useState } from 'react'
import { Alert, Button, Col, Container, Form, ListGroup, Row, Table } from 'react-bootstrap'
import { Link } from 'react-router-dom'
import {
  useGetAvailableNeucoreGroupsQuery,
  useGetPingChannelsQuery,
  useGetPingViewPermissionsQuery,
  useUpdatePingViewPermissionsByNeucoreGroupMutation,
} from '../../store'
import './view-access.scss'

export function ManagePingViewAccess(): JSX.Element {
  const viewPermissionsQuery = useGetPingViewPermissionsQuery()
  const viewPermissions = useMemo(() => (viewPermissionsQuery.data?.viewPermissions ?? []).reduce(
    (byGroup, { neucoreGroup, ...rest }) => byGroup.set(
      neucoreGroup,
      [...byGroup.get(neucoreGroup) ?? [], rest].sort(
        (a, b) => a.slackChannelName.localeCompare(b.slackChannelName)
      )
    ),
    new Map<string, { slackChannelId: string, slackChannelName: string }[]>()
  ), [viewPermissionsQuery.data?.viewPermissions])

  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const selectableGroups = [
    ...viewPermissions.keys(),
    ...selectedGroup && !viewPermissions.has(selectedGroup) ? [selectedGroup] : [],
  ].sort()
  const handleGroupChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedGroup(e.target.value || null)
  }

  const allGroups = useGetAvailableNeucoreGroupsQuery()
  const remainingGroups = (allGroups.data?.neucoreGroups ?? [])
    .filter(g => !viewPermissions.has(g.name) && g.name !== selectedGroup)
    .map(g => g.name)

  const channels = useGetPingChannelsQuery()
  const remainingChannels = (channels.data?.channels ?? [])
    .filter(c => (selectedGroup && viewPermissions.get(selectedGroup) || [])
      .every(cc => cc.slackChannelId !== c.id)
    )

  const [
    setGroupChannels,
    setGroupChannelsState,
  ] = useUpdatePingViewPermissionsByNeucoreGroupMutation()
  const handleChannelSelected = (e: ChangeEvent<HTMLSelectElement>) => {
    if (!selectedGroup) {
      return
    }
    setGroupChannels({
      neucoreGroup: selectedGroup,
      allowedSlackChannelIds: [
        ...(viewPermissions.get(selectedGroup) ?? []).map(g => g.slackChannelId),
        e.target.value,
      ],
    })
  }
  const handleRemoveChannel = (channelId: string) => {
    if (!selectedGroup) {
      return
    }
    setGroupChannels({
      neucoreGroup: selectedGroup,
      allowedSlackChannelIds: (viewPermissions.get(selectedGroup) ?? [])
        .map(g => g.slackChannelId)
        .filter(g => g !== channelId),
    })
  }

  const isLoading =
    viewPermissionsQuery.isFetching ||
    allGroups.isFetching ||
    channels.isFetching ||
    setGroupChannelsState.isLoading

  return (
    <Container>
      <div className="view-access-header">
        <h3>Manage Ping View Access</h3>
        <div style={{ flex: 1 }} />
        <Link to="../sent" className="btn btn-primary" role="button">
          <i className="bi-arrow-left" /> Back to Sent Pings
        </Link>
      </div>
      <Row>
        <Form.Group as={Col} controlId="neucoreGroup" xs={12} md={4} className="mb-3">
          <Form.Label>Neucore Group</Form.Label>
          {selectableGroups.length < 1 && (isLoading
            ? <Alert variant="info" className="mb-2 py-2">
                Loading&hellip;
              </Alert>
            : <Alert variant="warning" className="mb-2 py-2">
                No view permissions defined.
              </Alert>
          )}
          {selectableGroups.length > 0 &&
            <ListGroup className="mb-2">
              {selectableGroups.map(g => (
                <ListGroup.Item key={g}
                  type="button"
                  action
                  active={g === selectedGroup}
                  onClick={() => setSelectedGroup(g)}
                  disabled={isLoading}
                >
                  {g}
                </ListGroup.Item>
              ))}
            </ListGroup>
          }
          <Form.Select
            value={selectedGroup ?? ''}
            onChange={handleGroupChange}
            disabled={isLoading || remainingGroups.length < 1}
          >
            {isLoading &&
              <option value="">Loading&hellip;</option>
            }
            {!isLoading && (remainingGroups.length > 0
              ? <option value="">(Select a group to add)</option>
              : <option value="">No more groups to add</option>
            )}
            {!isLoading && remainingGroups.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </Form.Select>
        </Form.Group>

        <Form.Group as={Col} controlId="slackGroups" xs={12} md={8}>
          <Form.Label>Can see pings sent to</Form.Label>
          <Table variant="dark">
            <thead>
              <tr>
                <th className="w-100">Slack Channel</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {!selectedGroup && (
                <tr>
                  <td colSpan={2}>(Please select a group to manage first)</td>
                </tr>
              )}
              {selectedGroup && <>
                {!viewPermissions.get(selectedGroup)?.length && (
                  <tr>
                    <td colSpan={2}>
                      <Alert variant="info" className="mb-0 py-2">
                        Members of this group cannot view any{' '}
                        pings other than those they sent themselves.
                      </Alert>
                    </td>
                  </tr>
                )}
                {viewPermissions.get(selectedGroup)?.map(p => (
                  <tr key={p.slackChannelId}>
                    <td className="align-middle">
                      {p.slackChannelName || `Unavailable channel (${p.slackChannelId})`}
                    </td>
                    <td>
                      <Button
                        size="sm"
                        className="text-nowrap"
                        onClick={() => handleRemoveChannel(p.slackChannelId)}
                        disabled={isLoading}
                      >
                        <i className="bi-trash-fill" /> Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {remainingChannels.length > 0 && (
                  <tr>
                    <td colSpan={2}>
                      <Form.Select
                        value=""
                        onChange={handleChannelSelected}
                        disabled={isLoading}
                      >
                        <option value="">(Select a channel to add)</option>
                        {!isLoading && remainingChannels.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </Form.Select>
                    </td>
                  </tr>
                )}
              </>}
            </tbody>
          </Table>
        </Form.Group>
      </Row>
    </Container>
  )
}
