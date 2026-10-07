#!/bin/bash
# Double-cliquez sur ce fichier pour lancer FoxBox sur votre Mac.
cd "$(dirname "$0")"
[ -d node_modules ] || npm install
(sleep 3 && open http://localhost:5173) &
npx vite --port 5173
