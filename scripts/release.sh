#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tag> [commit-message]"
  exit 1
fi

TAG_NAME="$1"
COMMIT_MESSAGE="${2:-chore: release ${TAG_NAME}}"

echo ">>> Building action bundle"
npm run build

echo ">>> Staging changes"
git add -A

if git diff --cached --quiet; then
  echo "Nothing to commit. Exiting."
  exit 0
fi

echo ">>> Committing with message: ${COMMIT_MESSAGE}"
git commit -m "${COMMIT_MESSAGE}"

echo ">>> Tagging as ${TAG_NAME}"
git tag -f "${TAG_NAME}"

echo ">>> Pushing branch"
git push

echo ">>> Pushing tag ${TAG_NAME}"
git push -f origin "${TAG_NAME}"

echo "Release complete."
