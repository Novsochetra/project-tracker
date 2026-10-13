# Releasing

The app has one version, in the root `package.json` (semver). Every release gets a `CHANGELOG.md` entry and a git tag `vX.Y.Z`. Railway still deploys every push to `main`; the version says which release a deploy is, and the app shows it with the deploy's commit at the bottom of the Account and Connect Claude Code sheets (`tracker --version` for the CLI).

## Once

The release command starts from the tag of the current version. Tag the commit that shipped 1.0.0 (the merge of PT-182 into `main`) and push the tag:

```bash
git tag -a v1.0.0 -m "Release v1.0.0" <commit>
git push origin v1.0.0
```

## Each release

On an up-to-date, clean `main`:

```bash
npm run release -- patch   # fixes only: 1.0.0 → 1.0.1
npm run release -- minor   # new features: 1.0.0 → 1.1.0
npm run release -- major   # breaking changes for agents or the API: 1.0.0 → 2.0.0
```

It bumps `package.json` and `package-lock.json`, adds the commit subjects since the last tag to `CHANGELOG.md`, commits `Release vX.Y.Z` and tags it. It does not push. Read the new `CHANGELOG.md` entry (edit it and `git commit --amend` if needed, then move the tag with `git tag -fa vX.Y.Z -m "Release vX.Y.Z"`), then:

```bash
git push --follow-tags
```

Railway deploys the push, and the app shows the new version once it is live.
