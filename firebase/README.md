# Firebase · Viam

Proyecto compartido para el sitio (GitHub Pages) y webs futuras.
Ahora mismo solo se usa para el ranking de **ICARO Climb**.

## 1. Datos de la app web

1. En [Firebase Console](https://console.firebase.google.com/) abre tu proyecto.
2. ⚙️ Project settings → **Your apps** → añade una app **Web** si no hay.
3. Copia el objeto `firebaseConfig`.
4. Pégalo en `firebase/config.js` (reemplaza los `PEGA_AQUI` / `TU_PROYECTO`).

## 2. Firestore

Si ya creaste Firestore (modo production o test):

1. Ve a **Firestore Database → Rules**.
2. Pega el contenido de `firestore.rules` y publica.
3. (Opcional) El mural ordena por `points` en Firestore y desempata por `time` en el cliente,
   así no hace falta un índice compuesto.

Colección usada:

```
leaderboards/icaro-climb/scores/{autoId}
```

Campos: `name`, `points`, `time`, `right`, `wrong`, `combo`, `won`, `at`, `source`.

## 3. Probar el juego

1. Abre `/icaro/climb/`.
2. Si `config.js` está vacío, el ranking sigue en `localStorage` (solo ese navegador).
3. Con config + rules OK, “Guardar” escribe en Firestore y el mural se ve en todos los dispositivos.

## 4. Otras webs después

Mismo proyecto Firebase, misma `config` (o otra app Web en el mismo project).

Estructura sugerida:

| Uso | Ruta |
|-----|------|
| Ranking ICARO | `leaderboards/icaro-climb/scores` |
| App futura X | `apps/nombre-app/...` |

Abre reglas solo para las rutas que necesites en `firestore.rules`.

## 5. Dominios autorizados

Authentication no hace falta para el ranking anónimo, pero si más adelante usas Auth:
**Authentication → Settings → Authorized domains** → añade `viam.es` y `viam26.github.io`.
