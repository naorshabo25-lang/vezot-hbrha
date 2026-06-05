#!/bin/bash
set -e
cd /var/www/vezot

echo "=== מתקין Python dependencies ==="
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
deactivate
cd ..

echo "=== בונה React ==="
cd dashboard
npm install
npm run build
cd ..

echo "=== מגדיר Nginx ==="
cp nginx.conf /etc/nginx/sites-available/vezot
ln -sf /etc/nginx/sites-available/vezot /etc/nginx/sites-enabled/vezot
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "=== מפעיל שרת Python עם PM2 ==="
cd server
pm2 delete vezot-api 2>/dev/null || true
pm2 start "venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000" \
    --name vezot-api \
    --cwd /var/www/vezot/server
pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || true
cd ..

echo ""
echo "=== הכל מוכן! ==="
echo "פתח דפדפן על: http://159.223.139.4"
