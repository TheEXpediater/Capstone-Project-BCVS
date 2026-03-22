//Layout.js
import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topnav from './Header'

function Layout() {
  return (
    <>
      <Sidebar />                 
      <main className="main-content">
        <Topnav />               
        <div className="container-fluid py-3">
          <Outlet />           
        </div>
      </main>
    </>
  )
}

export default Layout
