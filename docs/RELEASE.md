# Release Process

This document describes the complete release process for Mini Diarium.

## Prerequisites

Before creating a release, ensure:

1. **All tests pass**: Run `bun run pre-commit` to verify all checks pass
2. **Version consistency**: Verify version numbers match across:
   - `package.json` (version field)
   - `src-tauri/Cargo.toml` (version field)
   - `src-tauri/tauri.conf.json` (version field)
3. **Changelog updated**: Update `CHANGELOG.md` with release notes (if applicable)
4. **Clean working tree**: Commit all changes and push to `master` branch
5. **CI passes**: Ensure the latest CI run on `master` is green

## Version Numbering

Mini Diarium follows [Semantic Versioning](https://semver.org/):

- **Major** (X.0.0): Breaking changes, major new features
- **Minor** (0.X.0): New features, backwards compatible
- **Patch** (0.0.X): Bug fixes, minor improvements

## Creating a Release

### 1. Update Version Numbers

Update the version in all three files:

```bash
# Example: Bumping to v0.2.0
VERSION="0.2.0"

# Update package.json
bun version $VERSION

# Update Cargo.toml
cd src-tauri
# Manually edit Cargo.toml: version = "0.2.0"

# Update tauri.conf.json
# Manually edit tauri.conf.json: "version": "0.2.0"
```

Verify consistency:

```bash
grep '"version"' package.json
grep '^version' src-tauri/Cargo.toml
grep '"version"' src-tauri/tauri.conf.json
```

### 2. Commit Version Bump

```bash
git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json
git commit -m "chore: bump version to v0.2.0"
git push origin master
```

### 3. Create and Push Tag

```bash
git tag v0.2.0
git push origin v0.2.0
```

**Important**: The tag MUST start with `v` (e.g., `v0.2.0`, not `0.2.0`) to trigger the release workflow.

### 4. Monitor Release Workflow

The release workflow will automatically:

1. Create a draft GitHub release
2. Build artifacts for Windows, macOS, and Linux (in parallel)
3. Rename artifacts with version-specific names:
   - `Mini-Diarium-0.2.0-windows.msi`
   - `Mini-Diarium-0.2.0-windows.exe`
   - `Mini-Diarium-0.2.0-macos.dmg`
   - `Mini-Diarium-0.2.0-linux.AppImage`
   - `Mini-Diarium-0.2.0-linux.deb`
4. Generate SHA256 checksums for each platform
5. Upload all artifacts to the draft release

Monitor the workflow at: https://github.com/fjrevoredo/mini-diarium/actions

Typical build time: **15-25 minutes** (builds run in parallel)

### 5. Finalize Draft Release

Once the workflow completes:

1. Go to https://github.com/fjrevoredo/mini-diarium/releases
2. Find the draft release for your version
3. **Review uploaded artifacts**: Verify all files are present and correctly named
4. **Edit release notes**: Replace the placeholder with detailed changelog
5. **Verify checksums**: Ensure `checksums-*.txt` files are present
6. **Publish the release**: Click "Publish release"

### 6. Post-Release Activities

After publishing:

1. **Update README badges**: Change the version badge in `README.md` to the new version
   ```markdown
   [![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)](...)
   ```
2. **Announce**: Share the release (social media, discussions, etc.)
3. **Monitor issues**: Watch for bug reports related to the new release

## Testing Releases (Release Candidates)

Before a major release, create a release candidate to test the workflow:

```bash
# Create RC tag
git tag v0.2.0-rc.1
git push origin v0.2.0-rc.1

# This triggers the workflow and creates a draft release
# Review artifacts, then delete the draft and tag

# Delete draft release via GitHub UI
# Delete tag locally and remotely:
git tag -d v0.2.0-rc.1
git push origin :refs/tags/v0.2.0-rc.1
```

## Hotfix Process

For critical bug fixes that need immediate release:

1. **Create hotfix branch** from the release tag:
   ```bash
   git checkout -b hotfix/v0.2.1 v0.2.0
   ```

2. **Fix the bug** and commit changes

3. **Update version** to patch version (e.g., `0.2.0` → `0.2.1`)

4. **Merge to master**:
   ```bash
   git checkout master
   git merge hotfix/v0.2.1
   git push origin master
   ```

5. **Tag and release** following the normal process:
   ```bash
   git tag v0.2.1
   git push origin v0.2.1
   ```

6. **Delete hotfix branch**:
   ```bash
   git branch -d hotfix/v0.2.1
   ```

## Troubleshooting

### Workflow Fails to Trigger

- **Cause**: Tag doesn't start with `v`
- **Fix**: Delete tag and recreate with correct format
  ```bash
  git tag -d 0.2.0
  git push origin :refs/tags/0.2.0
  git tag v0.2.0
  git push origin v0.2.0
  ```

### Build Fails on One Platform

- **Cause**: Platform-specific dependency issue
- **Fix**:
  1. Cancel workflow run
  2. Delete draft release
  3. Fix the issue and commit to master
  4. Delete and recreate tag:
     ```bash
     git tag -d v0.2.0
     git push origin :refs/tags/v0.2.0
     git tag v0.2.0
     git push origin v0.2.0
     ```

### Artifacts Not Uploaded

- **Cause**: Build succeeded but artifact paths are incorrect
- **Fix**: Check workflow logs, verify bundle paths match patterns in `release.yml`

### Version Mismatch

- **Cause**: Version not updated in all three files
- **Fix**:
  1. Delete tag and draft release
  2. Fix version numbers
  3. Commit, tag, and push again

## Release Checklist

Copy this checklist for each release:

```markdown
## Pre-Release
- [ ] All tests pass (`bun run pre-commit`)
- [ ] Version updated in package.json
- [ ] Version updated in src-tauri/Cargo.toml
- [ ] Version updated in src-tauri/tauri.conf.json
- [ ] All versions match
- [ ] Changelog updated (if applicable)
- [ ] Changes committed and pushed to master
- [ ] CI passes on master

## Release
- [ ] Version bump committed
- [ ] Tag created (v*.*.*)
- [ ] Tag pushed to GitHub
- [ ] Release workflow triggered
- [ ] All platform builds succeeded
- [ ] Artifacts correctly named
- [ ] Checksums generated

## Finalization
- [ ] Draft release reviewed
- [ ] Release notes added
- [ ] Artifacts verified
- [ ] Release published
- [ ] README version badge updated
- [ ] Announcement prepared

## Post-Release
- [ ] Downloads working
- [ ] No critical installation issues reported
- [ ] Issues triaged
```

## Additional Resources

- **Tauri Release Guide**: https://tauri.app/v1/guides/distribution/
- **GitHub Releases**: https://docs.github.com/en/repositories/releasing-projects-on-github
- **Semantic Versioning**: https://semver.org/
