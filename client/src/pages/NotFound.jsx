import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container py-5 text-center">
      <h1 className="display-6">404</h1>
      <p className="text-muted">Page not found.</p>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </div>
  );
}
