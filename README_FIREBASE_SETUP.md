# NAVIDAD JUNTOS 2026 — Guía de Configuración, Ejecución y Publicación

> *"Una Navidad, muchos deseos y una familia."*

---

## 1. Requisitos previos

- Node.js 20 o superior (`node -v`)
- Cuenta de Google / Firebase Console (`https://console.firebase.google.com`)
- Firebase CLI (`npm install -g firebase-tools`) si deseas desplegar Storage rules, Cloud Functions y Hosting.

---

## 2. Configuración en Firebase Console

El proyecto ya cuenta con su archivo de configuración en `firebase-applet-config.json` y las reglas de **Firestore** (`firestore.rules`) desplegadas. Para activar todas las capacidades opcionales (subida de fotografías, inicio de sesión con correo/contraseña y Cloud Functions):

### A. Firebase Authentication (Acceso libre sin correo ni WhatsApp + Google)
1. Ingresa a **Firebase Console** → tu proyecto → **Authentication** → **Sign-in method**.
2. **Anónimo (obligatorio para acceso libre desde cualquier celular)**:
   - Haz clic en **Agregar nuevo proveedor** → **Anónimo** → **Habilitar** → **Guardar**.
   - Con esto, cualquier familiar puede entrar al instante escribiendo solo su nombre, sin correo, sin contraseña y sin WhatsApp, incluso desde navegadores integrados en celulares.
3. **Google (para el administrador)**: ya viene configurado. En **Authentication → Settings → Authorized domains**, asegúrate de que el dominio público de la app (`ais-pre-...run.app` o tu dominio `.web.app`) esté agregado.

### B. Firebase Storage (para fotografías de regalos y avatares)
1. En **Firebase Console** → **Storage** → **Comenzar**.
2. Elige la ubicación y crea el bucket predeterminado.
3. Despliega las reglas de seguridad incluidas en `storage.rules`:
   ```bash
   firebase deploy --only storage
   ```

### C. Cloud Functions (opcional / recomendado para producción)
La aplicación funciona de inmediato con **transacciones atómicas de Firestore** protegidas por reglas `getAfter` en `firestore.rules`. Si además deseas ejecutar la lógica de reservaciones en Cloud Functions (`functions/src/index.ts`):
1. Asegúrate de tener el plan **Blaze** en Firebase.
2. Instala dependencias y despliega:
   ```bash
   cd functions
   npm install
   npm run build
   cd ..
   firebase deploy --only functions
   ```
3. En tu archivo `.env`, define:
   ```env
   VITE_USE_CLOUD_FUNCTIONS="true"
   ```

---

## 3. Ejecutar el proyecto en local

```bash
npm install
npm run dev
```

Abre `http://localhost:3000` en tu navegador.

Para verificar tipos, pruebas unitarias y reglas de Firestore:
```bash
npm run lint
npx tsx --test src/utils/christmasLogic.test.ts
npx eslint firestore.rules
```

---

## 4. Publicar en internet (Firebase Hosting)

1. Compila la aplicación optimizada para producción:
   ```bash
   npm run build
   ```
2. Inicia sesión en Firebase CLI y selecciona tu proyecto:
   ```bash
   firebase login
   firebase use <TU_PROJECT_ID>
   ```
3. Publica hosting, reglas e índices:
   ```bash
   firebase deploy --only hosting,firestore,storage
   ```
4. Recibirás una URL pública (`https://<tu-proyecto>.web.app`) lista para compartir por WhatsApp con toda tu familia.
5. En **Authentication → Settings → Authorized domains**, verifica que tu dominio publicado esté incluido.

---

## 5. Notas de seguridad

- **Reservaciones secretas**: El propietario del deseo tiene bloqueado por reglas de Firestore el acceso de lectura a `/wishAvailability/{wishId}` y nadie (ni siquiera el administrador) puede leer `/reservations/{wishId}` de otra persona.
- **Revisa y endurece las reglas** antes de compartir la aplicación fuera de tu círculo familiar de confianza.
