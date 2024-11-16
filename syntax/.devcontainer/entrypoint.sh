#!/bin/sh

/opt/halon/bin/halonctl license fetch --username ${HALON_REPO_USER} --password ${HALON_REPO_PASS}
/opt/halon/bin/halonconfig --src-dir /workspaces/vscode-extensions/syntax/sampleWorkspace/src --dist-dir /workspaces/vscode-extensions/syntax/sampleWorkspace/dist

exec "$@"