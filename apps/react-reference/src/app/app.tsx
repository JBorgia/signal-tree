import type { ReferenceStore } from './reference-store';
import { useSignalTree } from '@signal-tree/react';

function Summary({ store }: { store: ReferenceStore }) {
  const activeCount = useSignalTree(
    store,
    ($) => $.jobs.all().filter((job) => job.status === 'active').length
  );
  const team = useSignalTree(store, ($) => $.filters.team());

  return (
    <header className="summary">
      <div>
        <p className="eyebrow">North operations</p>
        <h1>Field work queue</h1>
      </div>
      <div
        className="summary-metric"
        aria-label={`${activeCount} active ${activeCount === 1 ? 'job' : 'jobs'}`}
      >
        <strong>{activeCount}</strong>
        <span>active for {team}</span>
      </div>
    </header>
  );
}

function WorkQueue({ store }: { store: ReferenceStore }) {
  const jobs = useSignalTree(store, ($) => $.jobs.all());
  const selectedId = useSignalTree(store, ($) => $.jobs.activeId());

  return (
    <section className="queue" aria-labelledby="queue-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Live assignment</p>
          <h2 id="queue-title">Today&apos;s work</h2>
        </div>
        <span className="status-key"><i /> In progress</span>
      </div>

      <div className="job-list">
        {jobs.map((job) => (
          <article
            className={job.id === selectedId ? 'job selected' : 'job'}
            key={job.id}
          >
            <button
              className="job-select"
              type="button"
              onClick={() => store.$.jobs.setActiveId(job.id)}
            >
              <span className={`priority priority-${job.priority}`}>
                {job.priority}
              </span>
              <span>
                <strong>{job.title}</strong>
                <small>{job.site}</small>
              </span>
              <span className={`job-state state-${job.status}`}>
                {job.status}
              </span>
            </button>
            {job.id === selectedId && job.status !== 'done' ? (
              <button
                className="advance"
                type="button"
                onClick={() => store.advance(job.id)}
              >
                Advance
              </button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function ActiveJob({ store }: { store: ReferenceStore }) {
  const active = useSignalTree(store, ($) => $.jobs.activeEntity());

  return (
    <aside className="active-job" aria-live="polite">
      <p className="eyebrow">Selected job</p>
      {active ? (
        <>
          <h2>{active.title}</h2>
          <dl>
            <div><dt>Site</dt><dd>{active.site}</dd></div>
            <div><dt>Owner</dt><dd>{active.owner}</dd></div>
            <div><dt>Status</dt><dd>{active.status}</dd></div>
          </dl>
        </>
      ) : (
        <h2>No job selected</h2>
      )}
    </aside>
  );
}

export function App({ store }: { store: ReferenceStore }) {
  return (
    <main>
      <Summary store={store} />
      <div className="workspace">
        <WorkQueue store={store} />
        <ActiveJob store={store} />
      </div>
    </main>
  );
}

export default App;
