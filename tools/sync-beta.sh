#!/bin/sh
# Refresh the beta page (beta/) from a branch, without touching the live game at the root.
#   sh tools/sync-beta.sh            # from campaign-engine
#   sh tools/sync-beta.sh my-branch  # from another branch
set -e
BRANCH=${1:-campaign-engine}
git fetch -q origin "$BRANCH"
rm -rf beta
mkdir beta
git archive "origin/$BRANCH" play.html index.html ui engine rules lib campaign $(git ls-tree --name-only "origin/$BRANCH" story >/dev/null 2>&1 && git ls-tree -d --name-only "origin/$BRANCH" story) | tar -x -C beta
echo "beta/ now matches origin/$BRANCH ($(git rev-parse --short "origin/$BRANCH"))"
echo "$BRANCH $(git rev-parse --short "origin/$BRANCH")" > beta/VERSION.txt
