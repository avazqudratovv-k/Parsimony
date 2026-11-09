# Deploying Parsimony (VPS, Nginx, HTTPS)

Live address: https://parsimony.duckdns.org

How it fits together:
visitor -> server Nginx (80/443, HTTPS) -> 127.0.0.1:4300 (`web` container: static app + /api proxy) -> `backend` container -> `db` container.
Only 127.0.0.1:4300 is published. The database and backend are not reachable from outside.
The other projects on the server are not touched: this stack has its own Compose project name (`parsimony-prod`), its own volumes and its own Nginx site file.

## First deploy
1. `git clone https://github.com/avazqudratovv-k/Parsimony.git ~/parsimony && cd ~/parsimony`
2. `cp .env.production.example .env`, then edit it (`nano .env`): a long random POSTGRES_PASSWORD (use the same one inside DATABASE_URL), a random SECRET_KEY, the GEMINI_API_KEY.
3. `docker compose -f docker-compose.prod.yml up -d --build`
4. `curl -s http://127.0.0.1:4300/api/health` should answer `{"status":"ok"}`.
5. `sudo cp deploy/nginx-parsimony.conf /etc/nginx/sites-available/parsimony && sudo ln -s /etc/nginx/sites-available/parsimony /etc/nginx/sites-enabled/parsimony`
6. `sudo nginx -t && sudo systemctl reload nginx`
7. `sudo certbot --nginx -d parsimony.duckdns.org`

## Update
`cd ~/parsimony && git pull && docker compose -f docker-compose.prod.yml up -d --build` (migrations run on backend start).

## Cleanup of expired demo accounts (daily cron)
`0 4 * * * cd ~/parsimony && docker compose -f docker-compose.prod.yml exec -T backend python -m app.cleanup`

## Notes
- One backend worker on purpose: rate limits and daily caps are counted in memory.
- Host Nginx overwrites X-Forwarded-For with the real visitor IP, so the rate limiter sees real addresses.
- Never commit `.env`.
