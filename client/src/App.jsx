// src/App.jsx
import { BrowserRouter as Router } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min.js'
import './App.css'
import AppRoutes from './routes'

export default function App() {
  return (
    <>
      <Router>
        <AppRoutes />
      </Router>
      <ToastContainer />
    </>
  )
}
