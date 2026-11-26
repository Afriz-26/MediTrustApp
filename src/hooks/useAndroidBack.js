import { useEffect } from 'react';

/**
 * Prevents the Android hardware back button from terminating the WebView
 * when the React Router history stack is exhausted.
 *
 * On mount we push a sentinel history state. On popstate, if the state we
 * landed on is falsy (the browser's true root entry, before any app state),
 * we re-push the sentinel so the container is not closed. Router navigations
 * always carry a non-null state object, so in-app back presses are left
 * untouched and step normally through the router stack.
 */
export function useAndroidBack() {
  useEffect(() => {
    window.history.pushState({ meditrustGuard: true }, '');
    const onPopState = (e) => {
      if (!e.state) {
        window.history.pushState({ meditrustGuard: true }, '');
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
}

export default useAndroidBack;