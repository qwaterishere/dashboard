# Frontend (Angular)


!UI всегда требует бэкенда
## Development server

Требуется **Node.js 22+** (`nvm install 22`).

```bash
npm install
npm start          # ng serve + proxy /api → localhost:8000
```

Откройте http://localhost:4200/ — данные идут с бэкенда:

```bash
cd backend && uvicorn src.main:app --port 8000
```

## Tests & build

```bash
npm run test:ci
npm run build
```

## Additional Resources

[Angular CLI Overview](https://angular.dev/tools/cli)
