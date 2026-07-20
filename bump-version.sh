#!/usr/bin/env bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

validation_failed=0

report_mismatch() {
  local file_path="$1"
  local expected="$2"
  local actual="$3"
  echo -e "${RED}❌ Version mismatch in ${file_path}: expected ${expected}, found ${actual}${NC}"
  validation_failed=1
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
echo ""

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

# 4. Update Cargo.lock (repo-root workspace lockfile; cargo is workspace-aware)
echo "Updating Cargo.lock..."
cd src-tauri
cargo build --quiet 2>/dev/null || cargo check --quiet
cd ..

# 5+5b+5c. Update website files
# Mirrors the PowerShell pattern: declare date variable first, then single-read + multiple-replace + single-write per file
# Uses two sed calls for index.html (download URLs can't use capture groups in multi-e sed -i)
# Uses one sed call for encrypted-journal
echo "Updating website/index.html..."
website_path="website/index.html"
release_date=$(date -u +%Y-%m-%d)

# Patch app-version spans, softwareVersion, and dateModified (handle empty values with [^"]*)
sed -i.bak \
  -e "s|<span class=\"app-version\">[0-9.]*</span>|<span class=\"app-version\">${NEW_VERSION}</span>|g" \
  -e "s|\"softwareVersion\": \"[^\"]*\"|\"softwareVersion\": \"${NEW_VERSION}\"|g" \
  -e "s|\"dateModified\": \"[^\"]*\"|\"dateModified\": \"${release_date}\"|g" \
  "${website_path}"

# Replace download URLs verbatim (no capture groups — separate sed call avoids backreference issues with multi -e)
sed -i.bak2 \
  -e "s|Mini-Diarium-[0-9.]+-windows.exe|Mini-Diarium-${NEW_VERSION}-windows.exe|g" \
  -e "s|Mini-Diarium-[0-9.]+-macos.dmg|Mini-Diarium-${NEW_VERSION}-macos.dmg|g" \
  -e "s|Mini-Diarium-[0-9.]+-linux.AppImage|Mini-Diarium-${NEW_VERSION}-linux.AppImage|g" \
  "${website_path}"

rm "${website_path}.bak" "${website_path}.bak2"

echo "Updating website/encrypted-journal/index.html..."
encrypted_journal_path="website/encrypted-journal/index.html"

# Single sed pass for encrypted-journal (matches PowerShell's $encryptedJournal read + two -replace + one Set-Content)
sed -i.bak \
  -e "s|\"softwareVersion\": \"[^\"]*\"|\"softwareVersion\": \"${NEW_VERSION}\"|g" \
  -e "s|\"dateModified\": \"[^\"]*\"|\"dateModified\": \"${release_date}\"|g" \
  "${encrypted_journal_path}"

rm "${encrypted_journal_path}.bak"

# 6. Update README version badge
echo "Updating README.md version badge..."
sed -i.bak -E "s|version-[0-9]+\.[0-9]+\.[0-9]+-|version-${NEW_VERSION}-|g" README.md
rm README.md.bak

# 7. Prepend release entry to metainfo.xml
echo "Prepending release entry to data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml..."
# Strip \r so CRLF files match on all platforms
sed -i 's/\r//' data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml

# Build release block in a temp file (printf is portable; sed -i with \n replacement is not BSD/GNU portable)
printf '    <release version="%s" date="%s">\n      <url type="details">https://github.com/fjrevoredo/mini-diarium/releases/tag/v%s</url>\n    </release>\n' \
  "${NEW_VERSION}" "${release_date}" "${NEW_VERSION}" > /tmp/bump-metainfo-release.txt

sed -i.bak -e "/<!-- New release entries are prepended here by bump-version.sh -->/r /tmp/bump-metainfo-release.txt" \
  data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml

rm data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml.bak
rm /tmp/bump-metainfo-release.txt

# 8. Validate all versions
echo "Validating version updates..."

# Helper: extract first match using sed (safe for all file types)
extract_match() {
  local file="$1"
  local pattern="$2"
  sed -nE "s|${pattern}|\\1|p" "${file}" | head -n1
}

package_version=$(extract_match package.json '.*"version"[[:space:]]*:[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*')
tauri_version=$(extract_match src-tauri/tauri.conf.json '.*"version"[[:space:]]*:[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*')
cargo_version=$(extract_match src-tauri/Cargo.toml '^version[[:space:]]*=[[:space:]]*"([0-9]+\.[0-9]+\.[0-9]+)".*')
readme_version=$(extract_match README.md '.*version-([0-9]+\.[0-9]+\.[0-9]+)-.*')

[ "${package_version}" = "${NEW_VERSION}" ] || report_mismatch "package.json" "${NEW_VERSION}" "${package_version:-<missing>}"
[ "${tauri_version}" = "${NEW_VERSION}" ] || report_mismatch "src-tauri/tauri.conf.json" "${NEW_VERSION}" "${tauri_version:-<missing>}"
[ "${cargo_version}" = "${NEW_VERSION}" ] || report_mismatch "src-tauri/Cargo.toml" "${NEW_VERSION}" "${cargo_version:-<missing>}"
[ "${readme_version}" = "${NEW_VERSION}" ] || report_mismatch "README.md" "${NEW_VERSION}" "${readme_version:-<missing>}"

# website/index.html — app-version spans (all must be NEW_VERSION)
website_matches=$(grep -oE '<span class="app-version">[0-9.]+</span>' "${website_path}" || true)
if [ -z "${website_matches}" ]; then
  report_mismatch "${website_path}" "${NEW_VERSION}" "<no app-version spans found>"
else
  website_mismatch_values=$(printf '%s\n' "${website_matches}" | sed -E 's|<span class="app-version">([0-9.]+)</span>|\1|' | awk -v v="${NEW_VERSION}" '$0 != v' | sort -u)
  [ -z "${website_mismatch_values}" ] || report_mismatch "${website_path}" "${NEW_VERSION}" "${website_mismatch_values}"
fi

# website/index.html — download URLs (all must match NEW_VERSION)
website_dl_versions=$(grep -oE "Mini-Diarium-[0-9.]+-(windows.exe|macos.dmg|linux.AppImage)" "${website_path}" | \
  sed -E 's|Mini-Diarium-([0-9.]+)-.*|\1|' | sort -u || true)
if [ -n "${website_dl_versions}" ]; then
  dl_mismatches=$(printf '%s\n' "${website_dl_versions}" | awk -v v="${NEW_VERSION}" '$0 != v')
  [ -z "${dl_mismatches}" ] || report_mismatch "${website_path} download URLs" "${NEW_VERSION}" "${dl_mismatches}"
fi

# website/index.html — softwareVersion (first match must be NEW_VERSION)
website_sv=$(sed -nE 's|.*"softwareVersion":[[:space:]]*"([^"]+)".*|\1|p' "${website_path}" | head -n1)
[ "${website_sv}" = "${NEW_VERSION}" ] || report_mismatch "${website_path} softwareVersion" "${NEW_VERSION}" "${website_sv:-<missing>}"

# website/index.html — dateModified (all must be release_date)
website_dm_count=$(grep -c '"dateModified":' "${website_path}" || true)
if [ "${website_dm_count}" -eq 0 ]; then
  report_mismatch "${website_path} dateModified" "${release_date}" "<no dateModified found>"
else
  dm_mismatches=$(grep '"dateModified":' "${website_path}" | \
    sed -nE 's|.*"dateModified":[[:space:]]*"([^"]+)".*|\1|p' | \
    awk -v d="${release_date}" '$0 != d' | sort -u)
  [ -z "${dm_mismatches}" ] || report_mismatch "${website_path} dateModified" "${release_date}" "${dm_mismatches}"
fi

# website/encrypted-journal/index.html — softwareVersion
enc_sv=$(sed -nE 's|.*"softwareVersion":[[:space:]]*"([^"]+)".*|\1|p' "${encrypted_journal_path}" | head -n1)
[ "${enc_sv}" = "${NEW_VERSION}" ] || report_mismatch "${encrypted_journal_path} softwareVersion" "${NEW_VERSION}" "${enc_sv:-<missing>}"

# website/encrypted-journal/index.html — dateModified
enc_dm=$(sed -nE 's|.*"dateModified":[[:space:]]*"([^"]+)".*|\1|p' "${encrypted_journal_path}" | head -n1)
[ "${enc_dm}" = "${release_date}" ] || report_mismatch "${encrypted_journal_path} dateModified" "${release_date}" "${enc_dm:-<missing>}"

# metainfo.xml — release entry for NEW_VERSION exists
metainfo_count=$(grep -c "<release version=\"${NEW_VERSION}\"" data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml || true)
if [ "${metainfo_count}" -eq 0 ]; then
  report_mismatch "data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml" "${NEW_VERSION}" "<release entry not found>"
fi

if [ "${validation_failed}" -ne 0 ]; then
  echo
  echo -e "${RED}Version bump aborted: one or more files did not match ${NEW_VERSION}.${NC}"
  exit 1
fi

echo
echo -e "${GREEN}✅ Version updated in all files${NC}"
echo ""

# Show what changed
echo "Changes:"
git diff package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml Cargo.lock \
  website/index.html website/encrypted-journal/index.html README.md \
  data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml | head -40

# Get current branch
current_branch=$(git branch --show-current)

echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Review the changes above"
echo "2. Commit: ${GREEN}git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml Cargo.lock website/index.html website/encrypted-journal/index.html README.md data/linux/io.github.fjrevoredo.mini-diarium.metainfo.xml && git commit -m \"chore: bump version to ${NEW_VERSION}\"${NC}"
echo "3. Push branch: ${GREEN}git push origin ${current_branch}${NC}"
echo "4. Create PR to merge ${current_branch} → master"
echo "5. After PR is merged, checkout master and create tag:"
echo "   ${GREEN}git checkout master && git pull && git tag -a v${NEW_VERSION} -m \"Release v${NEW_VERSION}\" && git push origin v${NEW_VERSION}${NC}"
echo ""
echo -e "${YELLOW}⚠️  Important: Tag must be created on master AFTER the PR is merged!${NC}"