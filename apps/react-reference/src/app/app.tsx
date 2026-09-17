import { TEAMS, type ReferenceStore, type Team } from './reference-store';
import { useSignalTree } from '@signal-tree/react';

function Summary({ store }: { store: ReferenceStore }) {
  const activeCount = useSignalTree(store, ($) => $.activeJobCount());
  const team = useSignalTree(store, ($) => $.filters.team());

  return (
    <header className="summary">
      <div>
        <p className="eyebrow">{team} operations</p>
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

function FilterBar({ store }: { store: ReferenceStore }) {
  const team = useSignalTree(store, ($) => $.filters.team());
  const showCompleted = useSignalTree(store, ($) => $.filters.showCompleted());
  const atDefault = useSignalTree(store, ($) => $.filtersAreDefault());

  return (
    <section className="filters" aria-label="Queue filters">
      <label className="filter-field">
        <span>Team</span>
        <select
          value={team}
          onChange={(event) => store.setTeam(event.target.value as Team)}
        >
          {TEAMS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field filter-toggle">
        <input
          type="checkbox"
          checked={showCompleted}
          onChange={(event) => store.setShowCompleted(event.target.checked)}
        />
        <span>Show completed</span>
      </label>

      <button
        className="filter-reset"
        type="button"
        onClick={() => store.resetFilters()}
        disabled={atDefault}
      >
        Reset filters
      </button>
    </section>
  );
}

function WorkQueue({ store }: { store: ReferenceStore }) {
  const jobs = useSignalTree(store, ($) => $.visibleJobs());
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
        {jobs.length === 0 ? (
          <p className="empty-queue">No jobs match the current filters.</p>
        ) : (
          jobs.map((job) => (
            <article
              className={job.id === selectedId ? 'job selected' : 'job'}
              key={job.id}
            >
              <button
                className="job-select"
                type="button"
                onClick={() => store.selectJob(job.id)}
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
          ))
        )}
      </div>
    </section>
  );
}

function ActiveJob({ store }: { store: ReferenceStore }) {
  const active = useSignalTree(store, ($) => $.jobs.activeEntity());
  const hidden = useSignalTree(store, ($) => $.selectionHiddenByFilters());

  return (
    <aside className="active-job" aria-live="polite">
      <p className="eyebrow">Selected job</p>
      {active ? (
        <>
          <h2>{active.title}</h2>
          {hidden ? (
            <p className="selection-hidden" role="note">
              Hidden by the current filters.
            </p>
          ) : null}
          <dl>
            <div><dt>Site</dt><dd>{active.site}</dd></div>
            <div><dt>Owner</dt><dd>{active.owner}</dd></div>
            <div><dt>Team</dt><dd>{active.team}</dd></div>
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
      <FilterBar store={store} />
      <div className="workspace">
        <WorkQueue store={store} />
        <ActiveJob store={store} />
      </div>
    </main>
  );
}

export default App;
