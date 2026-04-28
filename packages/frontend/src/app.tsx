import React from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { UserRoles } from '@ping-board/common'
import { useGetUserQuery } from './store'
import { AppNav } from './components/app-nav'
// import { AppFooter } from './components/app-footer'

import { CalendarPage } from './pages/calendar'
import { TimersPage } from './pages/timers'
import { LoginPage } from './pages/login'
import { PingsPage } from './pages/pings'
import { PingsIndex } from './pages/_pings/index'
import { SendPingLayout } from './pages/_pings/send'
import { SendPing } from './pages/_pings/_send/templateId'
import { NoPingTemplateSelected } from './pages/_pings/_send/index'
import { SentPings } from './pages/_pings/sent'
import { ManagePingTemplates } from './pages/_pings/templates'
import { ManagePingViewAccess } from './pages/_pings/view-access'

import 'bootstrap/dist/css/bootstrap.min.css'
import './app.css'
import './custom.scss'

function LoginAndReturn(): JSX.Element {
  const currentPath = useLocation().pathname
  return <Navigate to={`/login?postLoginRedirect=${currentPath}`} />
}

export default function App(): JSX.Element {
  const user = useGetUserQuery()
  const roles = user.data?.isLoggedIn && user.data.character.roles || []

  function ifHasRoles(
    requiredRoles: UserRoles[],
    element: JSX.Element,
    fallback: JSX.Element | string = <React.Fragment />
  ): JSX.Element {
    if (user.isLoading) { return <React.Fragment /> }
    const hasRoles = requiredRoles.every(r => roles.includes(r))
    if (hasRoles) {
      return element
    }
    if (typeof fallback === 'string') {
      return <LoginAndReturn />
    }
    return fallback
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route path="" element={<Navigate to="calendar" replace />} />
          <Route path="calendar" element={ifHasRoles(
            [UserRoles.EVENTS_READ, UserRoles.PING],
            <CalendarPage />,
            '/calendar'
          )} />
          <Route path="timers" element={ifHasRoles(
            [UserRoles.EVENTS_READ],
            <TimersPage />,
            '/timers'
          )} />
          <Route path="pings" element={ifHasRoles(
            [UserRoles.PING],
            <PingsPage />,
            '/pings'
          )}>
            <Route path="" element={<PingsIndex />} />
            <Route path="send" element={<SendPingLayout />}>
              <Route path="" element={<NoPingTemplateSelected />} />
              <Route path=":templateId" element={<SendPing />} />
            </Route>
            <Route path="sent" element={<SentPings />} />
            {ifHasRoles([UserRoles.PING_TEMPLATES_WRITE], (<>
              <Route path="templates" element={<ManagePingTemplates />} />
              <Route path="view-access" element={<ManagePingViewAccess />} />
            </>))}
          </Route>
          <Route path="login" element={<LoginPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

function Layout(): JSX.Element {
  return (
    <div className="app-wrapper">
      <header>
        <AppNav pages={[
          { title: 'Calendar', href: '/calendar' },
          { title: 'Timers', href: '/timers' },
          { title: 'Pings', href: '/pings' },
        ]} />
      </header>
      <main className="main">
        <Outlet />
      </main>
      {/* <footer>
        <AppFooter />
      </footer> */}
    </div>
  )
}
