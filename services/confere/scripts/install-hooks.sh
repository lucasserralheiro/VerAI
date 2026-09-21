#!/usr/bin/env bash
#
# Ativa os git hooks versionados do projeto. Rode uma vez após clonar:
#   ./scripts/install-hooks.sh
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
git -C "$REPO_ROOT" config core.hooksPath scripts/git-hooks
chmod +x "$REPO_ROOT"/scripts/git-hooks/*

echo "✅ Hooks ativados (core.hooksPath = scripts/git-hooks)."
echo "   Para desativar:  git config --unset core.hooksPath"
