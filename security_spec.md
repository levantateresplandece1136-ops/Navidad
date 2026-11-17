# Especificación de Seguridad Firestore — NAVIDAD JUNTOS 2026

## 1. Invariantes de Datos (Data Invariants)

1. **Separación de Secreto de Reservación**:
   - Un deseo (`/wishes/{wishId}`) NUNCA contiene campos sobre si está reservado ni quién lo reservó.
   - El estado de disponibilidad (`/wishAvailability/{wishId}`) solo almacena `isReserved` (`boolean`), sin ningún identificador del reservante, y su lectura (`get` / `list`) está **estrictamente prohibida a nivel de base de datos** cuando `resource.data.ownerUid == request.auth.uid`.
   - El documento privado de reservación (`/reservations/{wishId}`) usa `wishId` como ID de documento (imposible duplicar reservaciones para el mismo deseo) y solo es legible (`get` / `list`) por `resource.data.reservedByUid == request.auth.uid`. Ni el propietario del deseo ni un administrador pueden leer las reservaciones ajenas.

2. **Integridad de Identidad y Roles (RBAC)**:
   - Un usuario nunca puede autoasignarse el rol `admin` al registrarse o actualizar su perfil público en `/users/{uid}`.
   - Los permisos de administrador se validan en servidor mediante documento confiable `/admins/{uid}` o el correo verificado del administrador raíz.
   - El correo electrónico (PII) se aísla en `/users/{uid}/private/contact` accesible únicamente por el propietario o el administrador.

3. **Integridad Referencial y Atomicidad (`getAfter` / `existsAfter`)**:
   - Crear una reservación en `/reservations/{wishId}` exige atómicamente que `/wishAvailability/{wishId}.isReserved` sea `true` tras la transacción (`getAfter`) y que `ownerUid != request.auth.uid`.
   - Eliminar una reservación exige atómicamente que `/wishAvailability/{wishId}.isReserved` pase a `false` (o que la disponibilidad ya no exista porque el deseo fue borrado).

4. **Integridad Temporal y Límites de Tamaño**:
   - Todos los `createdAt` y `updatedAt` se validan contra `request.time`.
   - Todos los IDs cumplen `^[a-zA-Z0-9_\\-]+$` y longitud `1..128`. Todos los strings tienen límites de tamaño explícitos.

---

## 2. "Dirty Dozen" Payloads (Pruebas Adversarias)

1. **Auto-reserva de deseo propio**: Usuario A intenta crear `/reservations/wishA` donde `wishes/wishA.ownerUid == A` -> `PERMISSION_DENIED`.
2. **Lectura de disponibilidad propia**: Usuario A intenta `get` o `list` sobre `/wishAvailability` con `ownerUid == A` -> `PERMISSION_DENIED`.
3. **Espionaje de reservaciones ajenas (incluyendo Admin)**: Admin o Usuario B intenta leer `/reservations/wishA` donde `reservedByUid == C` -> `PERMISSION_DENIED`.
4. **Doble reservación**: Usuario C intenta sobrescribir `/reservations/wishA` cuando ya existe o sin actualizar atómicamente `wishAvailability` -> `PERMISSION_DENIED`.
5. **Auto-promoción a Administrador**: Usuario B crea o actualiza `/users/B` intentando poner `role: 'admin'` -> `PERMISSION_DENIED`.
6. **Inyección de campo fantasma (Shadow Update)**: Usuario A intenta actualizar `/wishes/wishA` agregando un campo extra `isReservedByMe: true` o `ghost: 1` -> `PERMISSION_DENIED`.
7. **Suplantación de identidad (`ownerUid` ajeno)**: Usuario B intenta crear `/wishes/wishX` con `ownerUid: 'usuarioA'` -> `PERMISSION_DENIED`.
8. **Lectura masiva de PII (emails)**: Usuario B intenta leer `/users/usuarioA/private/contact` -> `PERMISSION_DENIED`.
9. **Cancelación ajena**: Usuario B intenta borrar `/reservations/wishA` reservado por Usuario C -> `PERMISSION_DENIED`.
10. **Falsificación de timestamp**: Usuario A intenta escribir `createdAt` distinto a `request.time` -> `PERMISSION_DENIED`.
11. **Envenenamiento de ID (Resource Poisoning)**: Usuario intenta escribir un ID de documento con caracteres inválidos (`../../admin`) o >128 bytes -> `PERMISSION_DENIED`.
12. **Usuario no verificado (`email_verified: false`)**: Usuario con correo sin verificar intenta mutar documentos -> `PERMISSION_DENIED`.
