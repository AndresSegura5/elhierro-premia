# Revisión de seguridad — 2 de octubre de 2026

## Alcance

Revisión del acceso de administración y comercios, consultas públicas y privadas de bonos, registro de gastos, sesiones, permisos de Supabase y dependencias de producción. Se revisó el código y se hicieron comprobaciones controladas; no es una auditoría externa completa ni una garantía de invulnerabilidad.

## Problemas corregidos

- El contador SQL público se saturaba en 10 y seguía devolviendo autorización. Ahora la consulta 11 se deniega y el contador permanece cerrado hasta que vence la ventana.
- Una sesión de comercio permitía saltarse el límite de búsquedas. Ahora hay un contador por usuario y los comercios solo pueden consultar sus propios bonos mientras están identificados.
- Cabeceras proporcionadas por el cliente podían cambiar la IP usada para el contador. En Vercel se utiliza exclusivamente `X-Forwarded-For`, que la plataforma sobrescribe. Las direcciones IPv6 se agrupan por /64; las IP se guardan como HMAC, no en claro.
- El acceso no tenía un límite por IP ni por identificador inexistente. Estos límites se aplican antes de comprobar contraseñas y se comparten entre todas las instancias de Vercel.
- Los fallos concurrentes de contraseña podían perder incrementos en SQLite. La actualización ahora es atómica; cinco fallos bloquean la cuenta durante 15 minutos. Las respuestas de contraseña incorrecta y cuenta bloqueada son iguales para evitar confirmar si existe una cuenta.
- Los reintentos de una compra podían descontarse más de una vez. Cada operación lleva una clave UUID única. Repetir la misma operación no vuelve a descontar; reutilizarla con otros datos se rechaza.
- Se añade comprobación de origen a las API de escritura y validación del tipo y tamaño de la petición de canje. La configuración inicial de administración queda desactivada en producción.
- Supabase tenía RLS activado, pero conservaba permisos innecesarios para `anon` y `authenticated`. Se han retirado los permisos de tablas y secuencias, incluidos `TRUNCATE`, y endurecido los permisos por defecto de objetos futuros.
- Los nuevos bonos usan 12 caracteres aleatorios con el generador criptográfico de Node. Los códigos impresos anteriores siguen siendo válidos.
- Se añaden cabeceras contra inclusión en marcos, interpretación incorrecta de contenido y envío del código del bono como referente a webs externas. Las fichas de bonos no se indexan.

## Límites aplicados

| Operación | Límite |
| --- | --- |
| Inicio de sesión por IP o red IPv6 | 20 intentos en 15 minutos, compartidos entre ambos formularios |
| Inicio de sesión por identificador y rol | 10 intentos en 15 minutos, exista o no la cuenta |
| Contraseñas incorrectas de una cuenta | Bloqueo de 15 minutos tras 5 fallos |
| Consulta pública de bonos, API y ficha | 10 consultas en 15 minutos por IP o red IPv6 |
| Consulta con sesión | 60 consultas por minuto por usuario |
| Registro de compras | 30 peticiones por minuto por usuario, con clave de operación obligatoria |

Los contadores de producción están en Supabase y se actualizan atómicamente. En desarrollo local se guardan en memoria y las cabeceras de IP del cliente no seleccionan nuevas cuotas. Varias personas detrás de una misma red pueden compartir el límite público; el límite privado del comercio se calcula por usuario.

## Controles de canje comprobados

- Solo una sesión de comercio puede registrar compras; una cuenta administradora no hereda permisos de tienda.
- La tienda y el comercio asignado al bono se comprueban en el servidor. Se rechazan comercios inactivos.
- El importe se convierte a céntimos y debe ser entero, positivo y menor o igual al saldo.
- Se rechazan bonos no vigentes, caducados y agotados.
- PostgreSQL bloquea la fila del bono durante el canje; SQLite utiliza una transacción de escritura. El saldo y el movimiento se guardan juntos.
- La base impide saldos negativos y claves de compra duplicadas.
- Las consultas SQL del acceso y del canje están parametrizadas. Las sesiones usan cookies HttpOnly, SameSite=Lax y Secure en producción; los tokens aleatorios se almacenan como hashes y caducan.

## Comprobaciones realizadas

- 24 pruebas automatizadas correctas: roles, sesiones, cinco fallos simultáneos, cuotas concurrentes, origen de peticiones, IPv6, códigos y protección de canjes.
- Compilación de producción correcta.
- `npm audit --omit=dev`: cero vulnerabilidades conocidas comunicadas en las dependencias de producción en esta revisión.
- HTTP local: diez consultas devuelven 404 para un código inexistente; las siguientes devuelven 429 aunque se cambien cabeceras alternativas de IP. Canje sin sesión: 401. Canje desde otro origen: 403. El límite de acceso funciona también con una cuenta inexistente.
- Supabase: el contador nuevo y el anterior autorizan exactamente diez de veinte llamadas. Las comprobaciones se hicieron dentro de transacciones revertidas.
- Canje PostgreSQL real dentro de una transacción revertida: un gasto de 12,50 € repetido con la misma clave produce un único movimiento y un único descuento. Se rechazan la tienda incorrecta, cambios de datos en una operación usada y el exceso de saldo. No queda ningún bono ni gasto de prueba en producción.
- Supabase: `anon` no puede leer bonos ni ejecutar el contador; `authenticated` no puede leer usuarios. No quedan permisos de tablas para esos dos roles.
- Migraciones aplicadas: `20261002000000_security_hardening` y `20261002010000_private_database_access`.

## Riesgos que siguen requiriendo atención

- Un código o QR válido acredita posesión, no la identidad de una persona ni que se haya producido una compra física. Una fotografía robada puede utilizarse hasta consumir el saldo. Los controles impiden inventar saldo o cobrar desde otra tienda, pero no demuestran la entrega real de productos.
- Los límites por IP reducen automatizaciones, pero no eliminan ataques distribuidos desde muchas redes. La defensa de red y las reglas del firewall de Vercel complementan los controles de la aplicación; esta revisión no incluye una prueba de carga ni configura reglas nuevas de firewall.
- No se ha implantado segundo factor para administradores. Sigue siendo recomendable para el acceso con capacidad de emitir bonos y gestionar cuentas.
- Los bonos anteriores conservan su código más corto. Cambiarlos invalidaría las impresiones ya entregadas.
- La política CSP incorporada protege marcos, objetos y base de URLs; no es una política completa con nonces para todos los scripts.

## Referencias

Controles de acceso y automatización contrastados con [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html) y [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html). La selección de IP sigue la [documentación de cabeceras de Vercel](https://vercel.com/docs/headers/request-headers). Las acciones de formulario conservan la protección de origen de [Next.js Server Actions](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions).
