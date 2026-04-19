# scripts/

Runners utilitarios de Vizme V5. No van a producción; son herramientas de dev.

## test-analyze.ts

Invoca el Edge Function `analyze-data` (modo `build_schema`) contra un archivo real, de principio a fin: crea el usuario de prueba si no existe, sube el archivo a Storage, inserta el registro en `files`, llama a la función, imprime tokens/costos/schema y ofrece cleanup.

### Requisitos

`.env.local` con estas claves:

```
VITE_SUPABASE_URL=https://zzqvwyvgfpjecaorahrn.supabase.co
VITE_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
VIZME_TEST_USER_EMAIL=test+sprint2@vizme.mx
VIZME_TEST_USER_PASSWORD=<password fuerte>
```

> `SUPABASE_SERVICE_ROLE_KEY` nunca se commitea. Se saca del Supabase Dashboard → Project Settings → API → `service_role` key.

### Uso

```bash
npm run test:analyze -- --file ./data/ventas.csv
npm run test:analyze -- --file ./data/barber.xlsx --hint "Barbería en CDMX" --question "¿Cuál es mi servicio más rentable?"
```

Flags:

- `--file <path>` (obligatorio): ruta al archivo local.
- `--hint <string>` (opcional): pista de negocio al modelo.
- `--question <string>` (opcional): pregunta que el cliente quiere responder.

### Salida

El script imprime:

1. Tiempo total hasta recibir respuesta de la Edge Function.
2. Status HTTP.
3. Tokens consumidos (input, output, cache read/write) y costo estimado USD.
4. `summary` devuelto por la función.
5. `schema_id` persistido en `business_schemas`.
6. Schema completo leído desde DB (JSON prettified).
7. Pregunta si quiere limpiar project/file/storage de prueba.

### Prerrequisitos de infraestructura

- Migrations 01-08 aplicadas (Sprint 1).
- Migration 09 aplicada (bucket `user-files` + policies).
- Edge Function `analyze-data` deployada.
- Secret `ANTHROPIC_API_KEY` configurado en Supabase Edge Functions.

### Comportamiento

- Test user se reutiliza si ya existe con el email configurado.
- Test project se reutiliza si ya existe un `projects.name` que empiece con `TEST_`, bajo el usuario.
- Archivo se sube con nombre `<user_id>/<timestamp>_<filename>` para evitar colisiones.
- Al fallar la Edge Function, imprime el JSON de error y ofrece cleanup de todos modos.
