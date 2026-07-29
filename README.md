# POS Indumentaria

Sistema de punto de venta para comercios de indumentaria. Monorepo pnpm con backend (Express + Prisma/SQLite), frontend (React + Vite + Tailwind) y buildeado como app de escritorio usando Electron.

## Cómo correr el proyecto

**Importante:**

Email: admin@pos.local
Contraseña: admin123

1. **Requisitos**: Node.js LTS (v20+) y pnpm (`corepack enable` o `npm i -g pnpm`).

3. **Instalar dependencias:**

   ```bash
   pnpm install
   ```

4. **Configurar el entorno:** copiar `.env.example` a `.env` y ajustar si hace falta (por defecto usa SQLite local, no requiere nada externo):

   ```bash
   cp .env.example .env
   ```

5. **Base de datos:**

   ```bash
   pnpm prisma:generate
   pnpm prisma:migrate
   pnpm prisma:seed
   ```

   Esto crea `prisma/dev.db`, aplica las migraciones y siembra el usuario `admin@pos.local` / `admin123`.

6. Correr en modo desarrollo (sin empaquetar)

```bash
pnpm dev:electron
```



Opcional: 

EMPAQUETAR: **Generar el instalador de Windows:**

   ```bash
   pnpm package:win
   ```

   El instalador queda en `apps/electron/release/POS Indumentaria Setup X.X.X.exe`.

