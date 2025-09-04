@echo off
git fetch
git pull
cd ygg-chat
call npm i
call npm run build:server
call npm run build:client
call npm run dev