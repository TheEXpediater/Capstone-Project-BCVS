import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'

function NotFound() {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <main className="d-flex align-items-center justify-content-center min-vh-100 bg-light">
      <div className="text-center p-4">
        <h1 className="display-3 fw-bold mb-0">404</h1>
        <p className="lead mt-2 mb-1">Page not found</p>
        <p className="text-muted">
          We couldn’t find&nbsp;
          <code className="bg-body-tertiary px-1 rounded">{pathname}</code>.
        </p>

        <div className="d-flex gap-2 justify-content-center mt-3">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() => navigate(-1)}
          >
            Go back
          </button>

          <Link to="/" className="btn btn-primary">
            Go to Dashboard
          </Link>

          <Link to="/login" className="btn btn-link">
            Login
          </Link>
        </div>
      </div>
    </main>
  )
}

export default NotFound
