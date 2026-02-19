#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

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
sed -i.bak "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"${NEW_VERSION}\"/" package.json
rm package.json.bak

# 2. Update tauri.conf.json
echo "Updating src-tauri/tauri.conf.json..."
sed -i.bak "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"${NEW_VERSION}\"/" src-tauri/tauri.conf.json
rm src-tauri/tauri.conf.json.bak

# 3. Update Cargo.toml
echo "Updating src-tauri/Cargo.toml..."
sed -i.bak "s/^version = \"[0-9]*\.[0-9]*\.[0-9]*\"/version = \"${NEW_VERSION}\"/" src-tauri/Cargo.toml
rm src-tauri/Cargo.toml.bak

# 4. Update Cargo.lock
echo "Updating src-tauri/Cargo.lock..."
cd src-tauri
cargo build --quiet 2>/dev/null || cargo check --quiet
cd ..

# 5. Update website/index.html
echo "Updating website/index.html..."
sed -i.bak 's|<span class="app-version">[0-9]*\.[0-9]*\.[0-9]*</span>|<span class="app-version">'"${NEW_VERSION}"'</span>|g' website/index.html
rm website/index.html.bak

echo
echo -e "${GREEN}✅ Version updated in all files${NC}"
echo

# Show what changed
echo "Changes:"
git diff package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html | head -40

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

echo
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the changes above"
echo "2. Commit: ${GREEN}git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml src-tauri/Cargo.lock website/index.html && git commit -m \"chore: bump version to ${NEW_VERSION}\"${NC}"
echo "3. Push branch: ${GREEN}git push origin ${CURRENT_BRANCH}${NC}"
echo "4. Create PR to merge ${CURRENT_BRANCH} → master"
echo "5. After PR is merged, checkout master and create tag:"
echo "   ${GREEN}git checkout master && git pull && git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\" && git push origin v${NEW_VERSION}${NC}"
echo
echo -e "${YELLOW}⚠️  Important: Tag must be created on master AFTER the PR is merged!${NC}"
