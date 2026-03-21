export default function Footer() {
  return (
    <footer className="border-t border-border mt-16 py-8" role="contentinfo">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col items-center gap-3 text-sm text-text-secondary font-ui text-center sm:text-left">
          <div className="flex items-center gap-2">
            <span aria-hidden="true">🌲</span>
            <span>New England Nature Explorer</span>
          </div>
          <p className="text-xs text-text-muted max-w-md">
            A personal side project — always a work in progress. New species, features, and
            improvements are added regularly. Some data may be incomplete or missing photos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <span>
              Species data from{" "}
              <a
                href="https://www.inaturalist.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-forest hover:underline"
              >
                iNaturalist
              </a>
            </span>
            <span className="text-border hidden sm:inline">|</span>
            <span>
              Photos licensed under{" "}
              <a
                href="https://creativecommons.org/licenses/by-nc/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-forest hover:underline"
              >
                CC BY-NC
              </a>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
