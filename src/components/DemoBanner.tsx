import { useDemoSync } from '@/features/data/hooks'

const LOADING_MESSAGE = 'Loading your saved changes…'
const OFFLINE_MESSAGE = 'Offline: changes are saved on this device and will sync'

const noticeClass =
  'pointer-events-auto mx-auto flex max-w-md items-center justify-center gap-3 rounded-full px-4 py-2 text-center text-xs font-semibold shadow-md'

/** Sync notice above the mobile nav; quiet while synced. */
function SyncNotice() {
  const { status, retry } = useDemoSync()

  const message =
    status.state === 'loading'
      ? LOADING_MESSAGE
      : status.state === 'offline' && status.hasPendingWrites
        ? OFFLINE_MESSAGE
        : null

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[4.5rem] z-40 px-4 md:bottom-4">
      <div role="status">
        {message ? (
          <p className={`${noticeClass} border border-[var(--line)] bg-white text-[var(--fg)]`}>
            {message}
          </p>
        ) : null}
      </div>
      {status.state === 'error' ? (
        <div className={`${noticeClass} border border-red-200 bg-red-50 text-red-800`} role="alert">
          <span>{status.error ?? 'Lost the connection to the demo service.'}</span>
          <button
            type="button"
            className="min-h-8 shrink-0 rounded-full border border-red-300 bg-white px-3 text-xs font-semibold text-red-800 hover:bg-red-100"
            onClick={retry}
          >
            Retry
          </button>
        </div>
      ) : null}
    </div>
  )
}

export function DemoBanner() {
  return (
    <>
      <aside
        className="fixed inset-x-0 top-0 z-40 border-b border-primary-700/30 bg-primary-700 px-4 py-2 text-center text-xs font-semibold text-white shadow-sm"
        role="status"
      >
        <span className="sm:hidden">
          Public demo — sample data, saved privately for this browser.
        </span>
        <span className="hidden sm:inline">
          Public demo — sample data only; your changes are saved to a private demo space for this
          browser.
        </span>
      </aside>
      <SyncNotice />
    </>
  )
}
