import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export function NotFoundPage() {
  return (
    <div className="page">
      <EmptyState
        title="Page not found"
        body="The route you requested is not part of this local factory."
        action={
          <Link to="/" className="btn btn-primary">
            Return to overview
          </Link>
        }
      />
    </div>
  );
}
