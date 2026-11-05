export function PostListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="forum-floor p-4">
          <div className="flex items-start gap-3">
            <div className="skeleton w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-2/3 rounded" />
              <div className="skeleton h-3 w-1/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-4/5 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PostDetailSkeleton() {
  return (
    <div>
      <div className="forum-floor main-post p-5 mb-6">
        <div className="flex items-center gap-3 mb-4 pb-3 border-b-2 border-[var(--color-forum-header)]">
          <div className="skeleton w-14 h-14 rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-4 w-24 rounded" />
            <div className="skeleton h-6 w-3/4 rounded" />
          </div>
          <div className="skeleton h-6 w-16 rounded" />
        </div>
        <div className="space-y-2">
          <div className="skeleton h-4 w-full rounded" />
          <div className="skeleton h-4 w-95% rounded" />
          <div className="skeleton h-4 w-80% rounded" />
          <div className="skeleton h-4 w-90% rounded" />
        </div>
      </div>
    </div>
  );
}
