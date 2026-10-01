# Plan de migración a Git, Vercel y Supabase

## Estado observado

- El repositorio local está inicializado con la rama `migration/supabase` y el remoto `AndresSegura5/elhierro-premia`; aún no hay commits ni se ha publicado código. El repositorio remoto está vacío y es público.
- El usuario tiene cuentas de Vercel y Supabase, pero todavía no ha creado proyectos para esta aplicación. Quedan por concretar el equipo de Vercel y la organización/región de Supabase.
- El proyecto mantiene SQLite para desarrollo local y ya incluye un repositorio asíncrono PostgreSQL para Supabase (`DATABASE_URL`), con TLS, máximo de una conexión y prepared statements desactivados para el pooler serverless.
- Las lecturas y escrituras de carreras, comercios, bonos, canjes y cuentas se han convertido para el repositorio asíncrono. En producción se exige `DATABASE_URL`; no se usa SQLite temporal.
- La base local contiene 3 carreras, 5 comercios, 2 cuentas (1 administradora y 1 de comercio), 3 sesiones, 400 bonos Bestial y ningún canje.
- Por indicación expresa, los 400 bonos no se migrarán. La base remota arrancará sin bonos emitidos y se hará una emisión nueva desde administración. Los códigos/QR anteriores dejarán de ser válidos.
- Carreras, categorías, condiciones, textos de las páginas públicas y comercios se han modelado en tablas (`races`, `business_categories`, `coupon_rules`, `site_content`, `businesses`). En modo PostgreSQL las páginas leen estos valores desde Supabase; los valores estáticos quedan como semillas y respaldo para el desarrollo local.
- `public/municipios-canarias.geojson` ocupaba unos 47,5 MB. Se ha generado `public/municipios-el-hierro.geojson`, de unos 2,5 MB, y el mapa ya carga solo los tres municipios de la isla; el original se excluye de Git.
- `.gitignore` excluye bases locales, variables de entorno, recursos grandes locales y ficheros temporales. No se han configurado credenciales de servicios.
- Las altas y los restablecimientos de acceso de comercios generan contraseñas temporales aleatorias. Se retiró el generador determinista basado en nombre/teléfono y la exportación ya no revela contraseñas. El importador rotará las claves existentes, forzará a cada administrador a establecer una clave nueva y guardará las claves temporales en un fichero local excluido de Git.
- Existe una migración SQL versionada en `supabase/migrations/` con restricciones, claves foráneas, RLS sin políticas públicas y función de rate limit compartido.
- `scripts/import-local-data-to-supabase.mjs` importa carreras, comercios, categorías, condiciones, contenido público y cuentas desde SQLite a un proyecto vacío. No lee ni importa bonos, canjes, caché o sesiones.

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
2. Revisar la lista de archivos que entrarán en el primer commit antes de publicarlo.
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

### 3. Crear staging y migrar los datos

1. Crear un proyecto Supabase de pruebas y desplegar el esquema exclusivamente mediante migraciones versionadas.
2. Parar las escrituras locales y generar una copia consistente de SQLite mediante la API de backup de SQLite (la base está en modo WAL; no copiar solo el `.sqlite` mientras la app esté activa).
3. Importar las 3 configuraciones de carrera, los 5 comercios y las 2 cuentas. Mantener los identificadores para preservar relaciones. El importador aborta si el proyecto no está vacío y exige confirmación adicional para producción.
4. No importar los 400 bonos, las 3 sesiones ni la caché de geocodificación. Comprobar que los contadores remotos son: 3 carreras, 5 comercios, 2 usuarios, 0 sesiones, 0 bonos y 0 canjes.
5. El importador guarda contraseñas temporales bajo `.data/`, que está excluido de Git. No incluir hashes de contraseña ni exportaciones en Git.

### 4. Conectar Vercel Preview y validar

1. Conectar el repositorio a Vercel y desplegar primero una rama Preview. Vercel crea despliegues Preview para ramas no productivas y Production desde la rama configurada. [Despliegues Git de Vercel](https://vercel.com/docs/git)
2. Configurar variables separadas para Development/Preview y Production. El servidor recibirá la URL de conexión de Supabase y `NEXT_PUBLIC_APP_URL`; secretos solo en los entornos de Vercel correspondientes. [Entornos de Vercel](https://vercel.com/docs/deployments/environments)
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

No hacen falta contraseñas ni claves copiadas en el chat. El destino GitHub ya está definido. Para crear los proyectos falta identificar el equipo/cuenta de Vercel y la organización y región de Supabase, o confirmar que puedo elegirlos si ya tengo acceso a las cuentas. Después se autorizará la CLI de forma interactiva. El importador requiere `DATA_MIGRATION_TARGET=preview` o `production`; para producción también exige `CONFIRM_PRODUCTION_DATA_IMPORT=yes`. Las claves se cargarán directamente en los gestores de entorno, nunca en Git ni en este documento.

Las migraciones SQL deben quedar versionadas y ser la única vía normal de cambio del esquema, como recomienda Supabase. [Flujo de migraciones Supabase](https://supabase.com/docs/guides/deployment/database-migrations)
