# Plan de migración a Git, Vercel y Supabase

## Estado observado

- El repositorio público `AndresSegura5/elhierro-premia` ya tiene publicada la rama `migration/supabase`, con el commit `70c867f` (`Prepare Supabase and Vercel migration`).
- En Vercel se creó `elhierro-premia` en el equipo personal `Andres' projects` y se conectó al repositorio GitHub. Todavía falta crear el primer despliegue. Se añadieron variables sensibles para Preview y Production; la URL pública quedó configurada en Production.
- Supabase tiene el proyecto `elhierro-premia` (`xbkojjftmyqzbpuoptqh`) en la organización disponible y en Irlanda (`eu-west-1`). Está saludable y usa el pooler de transacciones para Vercel.
- El proyecto mantiene SQLite para desarrollo local y ya incluye un repositorio asíncrono PostgreSQL para Supabase (`DATABASE_URL`), con TLS, máximo de una conexión y prepared statements desactivados para el pooler serverless.
- Las lecturas y escrituras de carreras, comercios, bonos, canjes y cuentas se han convertido para el repositorio asíncrono. En producción se exige `DATABASE_URL`; no se usa SQLite temporal.
- La base local contiene 3 carreras, 5 comercios, 2 cuentas (1 administradora y 1 de comercio), 3 sesiones, 400 bonos Bestial y ningún canje.
- Por indicación expresa, los 400 bonos no se migrarán. La base remota arrancará sin bonos emitidos y se hará una emisión nueva desde administración. Los códigos/QR anteriores dejarán de ser válidos.
- Carreras, categorías, condiciones, textos de las páginas públicas y comercios se han modelado en tablas (`races`, `business_categories`, `coupon_rules`, `site_content`, `businesses`). En modo PostgreSQL las páginas leen estos valores desde Supabase; los valores estáticos quedan como semillas y respaldo para el desarrollo local.
- `public/municipios-canarias.geojson` ocupaba unos 47,5 MB. Se ha generado `public/municipios-el-hierro.geojson`, de unos 2,5 MB, y el mapa ya carga solo los tres municipios de la isla; el original se excluye de Git.
- `.gitignore` excluye bases locales, variables de entorno, recursos grandes locales y ficheros temporales. Las claves de Supabase y las credenciales temporales se guardan solo bajo `.data/` o en los gestores de entorno.
- Las altas y los restablecimientos de acceso de comercios generan contraseñas temporales aleatorias. Se retiró el generador determinista basado en nombre/teléfono y la exportación ya no revela contraseñas. La importación rotó las claves existentes, forzó al administrador a establecer una clave nueva y guardó las claves temporales en un fichero local excluido de Git.
- La migración `20261001000000_initial_schema.sql` se aplicó y quedó registrada en el historial de Supabase. Incluye restricciones, claves foráneas, RLS sin políticas públicas y la función de rate limit compartido.
- `scripts/import-local-data-to-supabase.mjs` importa carreras, comercios, categorías, condiciones, contenido público y cuentas desde SQLite a un proyecto vacío. No lee ni importa bonos, canjes, caché o sesiones.
- La importación inicial terminó: 3 carreras, 5 comercios, 2 cuentas y 4 condiciones; 0 bonos, canjes y sesiones. La clave del límite de consultas se llama `COUPON_LOOKUP_HMAC_KEY` y se guarda como secreta.
- Vercel tiene configurada la región `dub1` (Dublín), cerca de la base en Irlanda. Las URLs Preview y Production apuntan al mismo proyecto Supabase; evitar pruebas que cambien datos desde Preview.

## Destino de los datos

Supabase Postgres será la fuente de verdad de todo el contenido editable de la aplicación:

| Tabla propuesta | Contenido |
| --- | --- |
| `races` | Identificador, nombre, nombre corto, color, cantidad prevista, inicio, vigencia y referencia del logotipo. |
| `site_content` | Contenido estructurado de la portada y la página informativa del bono. |
| `businesses` | Identidad, categoría, municipio, zona, contacto, dirección, coordenadas, horario, descripción, imagen y estado activo. |
| `business_categories` | Categorías administrables y su orden. |
| `coupon_rules` | Condiciones mostradas en la ficha del bono y su orden. |
| `coupons` | Código, carrera, comercio, saldo inicial y saldo utilizado. Cero filas al iniciar producción; nueva emisión posterior. |
| `redemptions` | Canjes con bono, comercio, importe, saldo posterior y fecha. Cero filas actuales que importar. |
| `users` | Cuentas actuales: usuario, hash de contraseña scrypt, rol, comercio vinculado, datos del administrador, bloqueos y cambio obligatorio de contraseña. |
| `sessions` | Sesiones con token hash, usuario y caducidad. Se recreará vacía para obligar a iniciar sesión otra vez. |
| `public_lookup_limits` | Contadores compartidos de consultas públicas, para que el límite siga funcionando en todas las instancias de Vercel. |

Las imágenes, logotipos y otros binarios irán a Supabase Storage; Postgres guardará sus rutas/URL. El código de la web y los recursos gráficos estructurales seguirán versionados en Git. El GeoJSON del mapa se simplificará y se conservará como recurso estático ligero o se moverá a PostGIS si se decide que sus geometrías también deben administrarse desde la base.

Las tablas tendrán claves foráneas entre bonos, carreras y comercios; restricciones para importes y saldos; unicidad para los códigos y cuentas; y operaciones atómicas para emitir lotes y registrar canjes. La API de base de datos no se expondrá al navegador. Las tablas tendrán RLS sin políticas públicas y las credenciales privilegiadas solo vivirán en el servidor de Next.js.

## Fases

### 1. Preparar Git sin subir datos privados

1. Usar el repositorio GitHub ya facilitado; está configurado como remoto y es público.
2. Revisar los archivos del primer commit antes de publicarlo; se excluyeron la base local, secretos y el GeoJSON original.
3. Mantener fuera de Git `.data/`, `.env*`, copias SQLite/WAL, credenciales, exportaciones con datos personales y ficheros temporales.
4. El repositorio facilitado es público: el generador determinista de contraseñas de comercios ya se ha retirado; no commitear ningún secreto ni copia de la base.
5. Reducir el GeoJSON grande, hacer el build reproducible y guardar únicamente migraciones SQL, semillas de desarrollo no sensibles y código.
6. Crear rama de producción `main`; trabajar la migración en una rama aparte.

### 2. Pasar la aplicación de SQLite a Postgres

1. Crear migraciones SQL versionadas en `supabase/migrations/` para el esquema y las políticas.
2. Usar el repositorio servidor asíncrono PostgreSQL para producción y conservar SQLite solo para desarrollo local.
3. Mantener hashes scrypt. La migración rotará claves de administradores y comercios con valores aleatorios; los administradores cambiarán su clave temporal al entrar. No trasladar sesiones activas ni publicar claves de Supabase.
4. Para comercios, reemplazar las claves derivadas del nombre/teléfono por claves aleatorias que solo se muestran en el fichero local de credenciales o al restablecer el acceso.
5. Hacer transaccionales la emisión de bonos y los canjes para evitar códigos duplicados o saldos inconsistentes ante llamadas simultáneas.
6. Mover los datos editables actualmente incrustados en el código (metadatos de carreras, categorías y condiciones del bono) a sus tablas.
7. Mover el contador del buscador desde memoria local a almacenamiento compartido en Supabase; así no se puede eludir el límite al caer en otra instancia de Vercel.
8. Usar el pooler de transacciones de Supabase para funciones serverless de Vercel; configurar SSL, pool pequeño y desactivar prepared statements en el cliente PostgreSQL. Supabase documenta estas limitaciones para el pooler de transacciones. [Conexión y pool de Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres)

### 3. Aplicar el esquema y migrar los datos

1. Crear el proyecto Supabase y aplicar el esquema mediante la migración versionada. **Completado**.
2. Parar las escrituras locales y generar una copia consistente de SQLite mediante la API de backup de SQLite (la base está en modo WAL; no copiar solo el `.sqlite` mientras la app esté activa).
3. Importar las 3 configuraciones de carrera, los 5 comercios y las 2 cuentas. Mantener los identificadores para preservar relaciones. El importador aborta si el proyecto no está vacío y exige confirmación adicional para producción. **Completado**.
4. No importar los 400 bonos, las 3 sesiones ni la caché de geocodificación. Se confirmó: 3 carreras, 5 comercios, 2 usuarios, 0 sesiones, 0 bonos y 0 canjes. **Completado**.
5. Las contraseñas temporales quedaron bajo `.data/`, excluidas de Git. No incluir hashes de contraseña ni exportaciones en Git. **Completado**.

### 4. Conectar Vercel Preview y validar

1. El repositorio está conectado a Vercel. Se preparó `main` como rama de producción, pero primero debe existir en GitHub; después las demás ramas generarán Preview. [Despliegues Git de Vercel](https://vercel.com/docs/git)
2. `DATABASE_URL` y `COUPON_LOOKUP_HMAC_KEY` están configuradas como variables sensibles en Preview y Production. `NEXT_PUBLIC_APP_URL` está configurada en Production. [Entornos de Vercel](https://vercel.com/docs/deployments/environments)
3. Validar en Preview inicio/cierre de sesión, cambio/restablecimiento de contraseñas, gestión de comercios, edición de carreras, emisión completa, QR, consulta pública, límites, canjes parciales y exportaciones PDF/Excel.
4. Verificar RLS, permisos de servidor, FK/cascadas y consistencia de saldos con operaciones concurrentes. Revisar logs sin registrar contraseñas, cookies, tokens ni códigos completos.

### 5. Corte a producción y nueva emisión

1. Congelar cambios de datos en local; guardar la copia final y registrar sus recuentos.
2. Aplicar migraciones a Supabase Production y cargar carreras, comercios y cuentas, con cero bonos/canjes.
3. Configurar dominio y variables de producción en Vercel; desplegar `main`.
4. Confirmar que las cuentas pueden entrar y que los comercios/condiciones de carrera se ven correctamente.
5. Emitir de nuevo los bonos completos desde administración, comprobar el recuento y generar/descargar los nuevos PDF/QR. No reutilizar ni entregar impresiones con los códigos antiguos.
6. Mantener el SQLite antiguo como copia de solo lectura durante el periodo acordado y definir rollback: detener escrituras nuevas, volver a la versión anterior solo si no se han registrado canjes en producción; si ya los hay, reconciliarlos antes del retroceso.

### 6. Operación

- Activar copias de seguridad de Supabase y comprobar una restauración antes del evento.
- Mantener cambios de esquema como migraciones en Git y aplicar primero en Preview/Staging.
- Revisar límites de almacenamiento, tamaño de GeoJSON, pool de conexiones, alertas y comportamiento del rate limit.

## Requisitos de acceso para continuar

No se incluyen contraseñas ni claves en este documento. El repositorio, Vercel y Supabase están enlazados/configurados. El importador requiere `DATA_MIGRATION_TARGET=preview` o `production`; para producción también exige `CONFIRM_PRODUCTION_DATA_IMPORT=yes`. Las claves se guardan localmente en `.data/` o directamente en los gestores de entorno, nunca en Git.

Las migraciones SQL deben quedar versionadas y ser la única vía normal de cambio del esquema, como recomienda Supabase. [Flujo de migraciones Supabase](https://supabase.com/docs/guides/deployment/database-migrations)

## Páginas legales: actualización pendiente de publicación

La migración `supabase/migrations/20261001010000_legal_content.sql` añade los cuatro textos legales a `site_content`: `legal.notice`, `legal.privacy`, `legal.cookies` y `legal.accessibility`. No modifica textos existentes ni datos de bonos. El importador para proyectos nuevos también incorpora estos contenidos. Las páginas consultan esa tabla y usan los textos iniciales como respaldo si aún no existe la fila correspondiente.

Esta migración está preparada localmente y debe aplicarse al publicar estos cambios, después de la autorización del usuario. No se ha aplicado a Supabase ni se ha desplegado esta actualización.

La migración `supabase/migrations/20261001020000_coupon_steps_copy.sql` actualiza la redacción de los dos primeros pasos de `coupon.page`, conservando el resto del contenido. También está pendiente de aplicar cuando se autorice publicar.
