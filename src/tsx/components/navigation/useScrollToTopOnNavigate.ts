import { useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Opens each new page at the top. The router keeps the previous page's scroll
 * position, so a link near the bottom of one page would land partway down the
 * next. Back and forward (POP) keep the browser's own position, and links to
 * an anchor (#…) are left for the page to scroll to.
 */
export function useScrollToTopOnNavigate() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useLayoutEffect(() => {
    if (navigationType === "POP" || hash) {
      return;
    }
    window.scrollTo(0, 0);
    // Only a change of page should scroll, not a change of hash or search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
}
