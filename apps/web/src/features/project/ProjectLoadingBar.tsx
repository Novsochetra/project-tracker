import { NavBar } from '../../navigation';

// Shared by the screen while its board is on its way and the app's loading state while the
// screen's code is (PT-108), so the bar stays put when either arrives.
export function ProjectLoadingBar() {
  return <NavBar backLabel="Projects" />;
}
