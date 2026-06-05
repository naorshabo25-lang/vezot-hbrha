#!/bin/bash
set -e

echo "=== מתקין מערכת זאת הברכה דלקים ==="

apt-get update -y
apt-get install -y curl nginx python3 python3-pip python3-venv

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# PM2
npm install -g pm2

# תיקיית האפליקציה
mkdir -p /var/www/vezot/server
mkdir -p /var/www/vezot/dashboard

echo "=== הכנה הושלמה! ==="
echo "עכשיו הרץ את deploy.sh"
