#!/bin/bash
cd "$(dirname "$0")"
command -v node >/dev/null || { echo "Node.js is not installed. Install it from https://nodejs.org then run this file again."; read -r; exit 1; }
[ -d node_modules ] || npm install || { read -r; exit 1; }
[ -d dist ] || npm run build || { read -r; exit 1; }
(sleep 4; (open http://localhost:8080/play 2>/dev/null || xdg-open http://localhost:8080/play 2>/dev/null)) &
npm start
