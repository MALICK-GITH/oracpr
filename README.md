# FC 25 Virtual Predictions

## Demarrage rapide

1. Installer les dependances

```bash
npm install
```

2. Configurer le fichier `.env` (copie de `.env.example`)

Variables minimales:

- `PORT=3029`
- `DB_FILE=data/app.sqlite`
- `TELEGRAM_BOT_TOKEN=...` (optionnel mais recommande)

3. Lancer le serveur

```bash
npm start
```

Le site est disponible sur:

- `http://localhost:3029`

## Base de donnees integree

Le projet utilise SQLite (natif Node.js) et cree automatiquement:

- `coupon_generations`
- `coupon_validations`
- `telegram_logs`

Fichier DB par defaut:

- `data/app.sqlite`

## API utiles

- `GET /api/db/status` -> etat de la DB
- `GET /api/coupon/history?limit=20` -> historique des coupons
- `GET /api/telegram/history?limit=20` -> historique des envois Telegram

## Notes

- Aucune manipulation SQL manuelle n'est necessaire.
- Les tables sont creees automatiquement au demarrage.
