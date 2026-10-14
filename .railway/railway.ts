import { defineRailway, github, project, service } from 'railway/iac';

// Railway never reads this file during a deploy: `railway config apply` sends it, so run that after
// changing it (docs/deploy-railway.md).
export const partial = 'project-tracker';

export default defineRailway(() => {
  const tracker = service('project-tracker', {
    source: github('Novsochetra/project-tracker', { branch: 'main', checkSuites: false }),
    build: 'npm run build && NPM_CONFIG_PRODUCTION= npm prune --omit=dev',
    preDeploy: 'node apps/server/dist/db.js migrate',
    start: 'node apps/server/dist/main.js',
    healthcheck: '/api/health',
    healthcheckTimeout: 120,
    replicas: { 'asia-southeast1-eqsg3a': 1 },
    // Restart on failure, up to 10 times, is Railway's default: it keeps that as null, so writing
    // it here would show as a change on every plan.
    deploy: { drainingSeconds: 15 },
  });

  return project('Project Tracker Staging', {
    // The dashboard keeps the variables (secrets included). The CLI reads this, but SDK 3.13's
    // types don't list it yet.
    // @ts-expect-error -- variables is missing from ProjectDefinition in railway 3.13
    variables: { managed: false },
    resources: [tracker],
  });
});
