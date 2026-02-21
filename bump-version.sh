#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

validation_failed=0

report_mismatch() {
  local file_path="$1"
  local expected="$2"
  local actual="$3"
  echo -e "${RED}❌ Version mismatch in ${file_path}: expected ${expected}, found ${actual}${NC}"
  validation_failed=1
}

extract_first_match() {
  local file_path="$1"
  local regex="$2"
  sed -nE "s/${regex}/\\1/p" "${file_path}" | head -n1
}

# Check if version argument is provided
if [ -z "$1" ]; then
  echo -e "${RED}❌ Error: Version number required${NC}"
  echo "Usage: ./bump-version.sh <version>"
  echo "Example: ./bump-version.sh 0.1.1"
  exit 1
fi

NEW_VERSION="$1"

# Validate version format (X.Y.Z)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo -e "${RED}❌ Error: Invalid version format${NC}"
  echo "Version must be in format X.Y.Z (e.g., 0.1.1)"
  exit 1
fi

echo -e "${YELLOW}📦 Bumping version to ${NEW_VERSION}...${NC}"
echo

# 1. Update package.json
echo "Updating package.json..."
sed -i.bak -E "s/\"version\"[[:space:]]*:[[:space:]]*\"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"${NEW_VERSION}\"/" package.json
rm package.json.bak

# 2. Update tauri.conf.json
echo "Updating src-tauri/tauri.conf.json..."
sed -i.bak -E "s/\"version\"[[:space:]]*:[[:space:]]*\"[0-9]+\.[0-9]+\.[0-9]+\"/\"version\": \"${NEW_VERSION}\"/" src-tauri/tauri.conf.json
rm src-tauri/tauri.conf.json.bak

# 3. Update Cargo.toml
echo "Updating src-tauri/Cargo.toml..."
sed -i.bak -E "s/^version[[:space:]]*=[[:space:]]*\"[0-9]+\.[0-9]+\.[0-9]+\"/version = \"${NEW_VERSION}\"/" src-tauri/Cargo.toml
rm src-tauri/Cargo.toml.bak

# 4. Update Cargo.lock
echo "Updating src-tauri/Cargo.lock..."
cd src-tauri
cargo build --quiet 2>/dev/null || cargo check --quiet
cd ..

# 5. Update website/index.html
echo "Updating website/index.html..."
sed -i.bak -E 's|<span class="app-version">[0-9]+\.[0-9]+\.[0-9]+</span>|<span class="app-version">'"${NEW_VERSION}"'</span>|g' website/index.html
rm website/index.html.bak

# 6. Update README version badge
echo "Updating README.md version badge..."
sed -i.bak -E "s|version-[0-9]+\.[0-9]+\.[0-9]+-|version-${NEW_VERSION}-|g" README.md
rm README.md.bak

# 7. Validate all versions
echo "Validating version updates..."

package_version=$(extract_first_match package.json '.*"version"[[:space:]]*:[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*')
tauri_version=$(extract_first_match src-tauri/tauri.conf.json '.*"version"[[:space:]]*:[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*')
cargo_version=$(extract_first_match src-tauri/Cargo.toml '^version[[:space:]]*=[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*')
readme_version=$(extract_first_match README.md '.*version-([0-9]+\.[0-9]+\.[0-9]+)-.*')

if [ "${package_version}" != "${NEW_VERSION}" ]; then
  report_mismatch "package.json" "${NEW_VERSION}" "${package_version:-<missing>}"
fi

if [ "${tauri_version}" != "${NEW_VERSION}" ]; then
  report_mismatch "src-tauri/tauri.conf.json" "${NEW_VERSION}" "${tauri_version:-<missing>}"
fi

if [ "${cargo_version}" != "${NEW_VERSION}" ]; then
  report_mismatch "src-tauri/Cargo.toml" "${NEW_VERSION}" "${cargo_version:-<missing>}"
fi

if [ "${readme_version}" != "${NEW_VERSION}" ]; then
  report_mismatch "README.md" "${NEW_VERSION}" "${readme_version:-<missing>}"
fi

website_matches=$(grep -oE '<span class="app-version">[0-9]+\.[0-9]+\.[0-9]+</span>' website/index.html || true)
if [ -z "${website_matches}" ]; then
  report_mismatch "website/index.html" "${NEW_VERSION}" "<no app-version spans found>"
else
  website_versions=$(printf '%s\n' "${website_matches}" | sed -E 's|<span class="app-version">([0-9]+\.[0-9]+\.[0-9]+)</span>|\1|')
  website_mismatch_values=$(printf '%s\n' "${website_versions}" | awk -v target="${NEW_VERSION}" '$0 != target { print }' | sort -u)
  if [ -n "${website_mismatch_values}" ]; then
    report_mismatch "website/index.html" "${NEW_VERSION}" "$(printf '%s' "${website_mismatch_values}" | tr '\n' ',' | sed 's/,$//')"
  fi
fi

if [ "${validation_failed}" -ne 0 ]; then
  echo
  echo -e "${RED}Version bump aborted: one or more files did not match ${NEW_VERSION}.${NC}"
  exit 1
fi

echo
echo -e "${GREEN}✅ Version updated in all files${NC}"
echo

# Show what changed
echo "Changes:"
git diff package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html README.md | head -40

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the changes above"
echo "2. Commit: ${GREEN}git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html README.md && git commit -m \"chore: bump version to ${NEW_VERSION}\"${NC}"
echo "3. Push branch: ${GREEN}git push origin ${CURRENT_BRANCH}${NC}"
echo "4. Create PR to merge ${CURRENT_BRANCH} → master"
echo "5. After PR is merged, checkout master and create tag:"
echo "   ${GREEN}git checkout master && git pull && git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\" && git push origin v${NEW_VERSION}${NC}"
echo
echo -e "${YELLOW}⚠️  Important: Tag must be created on master AFTER the PR is merged!${NC}"
