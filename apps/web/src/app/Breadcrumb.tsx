import clsx from 'clsx';
import { ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { Icon } from '../components';
import { parentRoute, routePath, useNavigation, type Route } from '../navigation';
import type { Crumb } from './crumbs';
import styles from './DesktopHeader.module.css';

function CrumbContent({ crumb }: { crumb: Crumb }) {
  return (
    <>
      {crumb.level === 'project' && (
        <span
          className={styles.square}
          style={crumb.color ? { background: crumb.color } : undefined}
        />
      )}
      <span className={styles.crumbLabel}>{crumb.label}</span>
    </>
  );
}

export function Breadcrumb({ crumbs }: { crumbs: Crumb[] }) {
  const { route, push, back } = useNavigation();
  // The parent crumb pops like the back button; anything further up is a plain link.
  const go = (target: Route) => {
    const parent = parentRoute(route);
    if (parent && routePath(parent) === routePath(target)) back();
    else push(target);
  };
  return (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      {crumbs.map((crumb, index) => {
        const { target } = crumb;
        return (
          <Fragment key={crumb.level}>
            {index > 0 && <Icon icon={ChevronRight} size={14} className={styles.separator} />}
            {target ? (
              <button
                type="button"
                className={clsx(styles.crumb, crumb.level === 'project' && styles.shrinks)}
                onClick={() => go(target)}
              >
                <CrumbContent crumb={crumb} />
              </button>
            ) : (
              <span
                className={clsx(
                  styles.current,
                  (crumb.level === 'project' || crumb.level === 'chat') && styles.shrinks,
                  crumb.level === 'ticket' && styles.ticketKey,
                )}
                aria-current="page"
              >
                <CrumbContent crumb={crumb} />
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
