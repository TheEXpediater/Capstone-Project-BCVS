export default function ProfileCard({ title, description, action, children, className = '' }) {
  return (
    <section className={`content-card profile-card ${className}`.trim()}>
      <div className="content-card-header d-flex flex-wrap align-items-start justify-content-between gap-3">
        <div>
          <h2 className="h5 mb-1">{title}</h2>
          {description ? <p className="text-muted small mb-0">{description}</p> : null}
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      <div className="content-card-body">{children}</div>
    </section>
  );
}
