# Firebase · Viam

Proyecto compartido: sitio (GitHub Pages) y el robot ICARO.
Proyecto: `viam-e93e0`. La config web pública está en `firebase/config.js`.

No subas cuentas de servicio ni contraseñas. La seguridad está en Authentication y en `firestore.rules` (hay que publicarlas a mano en la consola).

## Qué hay en Firestore

| Uso | Ruta | Quién |
|-----|------|--------|
| Ranking ICARO Climb | `leaderboards/icaro-climb/scores/{autoId}` | Público (lectura y alta de un score válido) |
| Registros de pacientes | `apps/icaro/consultas/{sqliteId}` | Solo personal con cuenta autorizada |
| Correos extra | `apps/icaro/meta/access` | El personal base puede ampliar la lista |

No había otra colección de pacientes en este repo. El ranking del juego no se mezcla con las consultas.

## Panel

https://viam.es/app/

También, con el dominio de GitHub: `https://viam26.github.io/ViamPI/app/`.

En la página de ICARO hay un enlace «Panel de registros». Sin sesión no se lee nada: la pantalla es solo el login.

## 1. Auth

1. [Firebase Console](https://console.firebase.google.com/) → proyecto `viam-e93e0`.
2. **Authentication → Sign-in method** → activa **Correo electrónico/contraseña**. No hace falta el registro público: el panel no crea cuentas.
3. **Authentication → Users → Add user**. Crea al menos `medicalviam@gmail.com` (es el correo que ya figura en los commits del repo y el que las reglas dejan entrar). La contraseña se elige ahí y no va en git.
4. Para el Jetson, puedes usar esa misma cuenta o crear otra (por ejemplo un correo solo del robot) y agregarla a la lista.
5. **Authentication → Settings → Authorized domains**: `viam.es`, `www.viam.es` y `viam26.github.io`. `localhost` ya viene.

Más personal, sin volver a editar reglas: en Firestore crea el documento `apps/icaro/meta/access` con un campo `emails` (array de strings **en minúsculas**). Esas cuentas también pueden leer y escribir consultas. Solo los correos fijos de `bootstrapEmails()` en `firestore.rules` pueden cambiar esa lista desde el cliente; desde la consola se puede crear igual.

## 2. Reglas

1. **Firestore Database → Rules**.
2. Pega **todo** `firebase/firestore.rules` y publica.
3. El archivo mantiene el ranking de Climb y abre solo `apps/icaro/consultas` al personal. El resto de `apps/` sigue cerrado. Nadie puede borrar consultas desde el cliente.

Hasta que publiques estas reglas, el panel entra pero Firestore responde permiso denegado.

## 3. DNS

El hosting actual es un solo GitHub Pages. `CNAME` = `viam.es`. GitHub Pages admite **un** dominio propio por sitio, así que la ruta limpia es:

**https://viam.es/app/**

No falta ningún registro DNS para esa URL.

`app.viam.es` no se puede servir desde este mismo repo. Si más adelante se separa en otro proyecto de Pages:

| Tipo | Nombre | Valor |
|------|--------|--------|
| CNAME | `app` | `viam26.github.io` |

Y en Authorized domains habría que agregar `app.viam.es`. No pongas los dos hostnames en el `CNAME` de este repo.

## Contrato de la consulta

Documento: `apps/icaro/consultas/{sqliteId}`

`sqliteId` es el `rowid` de SQLite (entero positivo, en string: la fila `42` → documento `"42"`). Así un reintento hace upsert y no duplica.

| Campo | Tipo | Obligatorio |
|-------|------|-------------|
| `sqlite_id` | int | sí, igual al id del documento |
| `origen` | `"icaro"` | sí |
| `nombre` | string ≤ 120 | sí (puede ir vacío) |
| `dui` | string ≤ 20 | sí (puede ir vacío) |
| `nivel` | string, idealmente `ROJO` / `AMARILLO` / `VERDE` | sí |
| `fecha` | string, el texto tal cual está en SQLite | sí |
| `fecha_ms` | número, epoch en milisegundos | sí (el panel ordena por esto) |
| `actualizado_en` | número, epoch ms del momento de subir | sí |
| `edad` | int 0–130, o string corto | no |
| `alarma` | string, bool o número | no |
| `motivos`, `molestia`, `otros`, `condiciones`, `alergias`, `observacion` | string | no |
| `tiempo` | string | no |
| `intensidad` | string | no |
| `naturaleza` | string | no |
| `foto` | URL `https://` o data-url chica. Una ruta local del Jetson no se muestra | no |
| `temperatura`, `pulso` | número o string corto | no |
| `atendido` | bool (o 0/1) | no. El robot lo manda solo al **crear**. El panel lo actualiza después |
| `atendido_en` | string | no. Igual: solo al crear, desde el robot |
| `atendido_por` | string (correo de quien marcó en el panel) | no. No lo escribe el robot |
| `subido` | bool | no |

Cualquier otro campo lo rechazan las reglas. El panel muestra los 300 documentos con `fecha_ms` más reciente.

## Bloque para el chat de Icaro (Jetson / icaro2)

Pega esto en el otro chat. El código del robot **no** vive en este repo. No uses una cuenta de servicio aquí. La contraseña va solo en el Jetson, en variables de entorno.

```python
# ICARO → Firestore (viam-e93e0)
# Colección: apps/icaro/consultas/{rowid}
# La apiKey es la config web pública (la misma de viam.es). NO es una cuenta de servicio.
# La cuenta de Auth tiene que estar en bootstrapEmails() de firestore.rules
# o en apps/icaro/meta/access.emails (minúsculas).
#
# Entorno en el Jetson (no commitear):
#   ICARO_FIREBASE_EMAIL
#   ICARO_FIREBASE_PASSWORD

import json
import os
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request

API_KEY = "AIzaSyA4p_Y8dHIbfFyML4xqc8GLwG-yhqbiCHc"
PROJECT_ID = "viam-e93e0"
EMAIL = os.environ["ICARO_FIREBASE_EMAIL"]
PASSWORD = os.environ["ICARO_FIREBASE_PASSWORD"]

# Si la tabla no se llama consultas, cambia este nombre.
TABLA = "consultas"


class AlreadyExists(Exception):
    pass


def _request(url, payload=None, headers=None, method=None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            raw = res.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", "replace")
        if err.code == 409:
            raise AlreadyExists(body)
        raise RuntimeError("HTTP %s %s" % (err.code, body))


def sign_in():
    url = "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=" + API_KEY
    data = _request(url, {"email": EMAIL, "password": PASSWORD, "returnSecureToken": True})
    return data["idToken"], data["refreshToken"], time.time() + int(data.get("expiresIn", 3600)) - 60


def refresh(refresh_token):
    url = "https://securetoken.googleapis.com/v1/token?key=" + API_KEY
    # Este endpoint espera form-urlencoded.
    body = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        data = json.loads(res.read().decode("utf-8"))
    return data["id_token"], data["refresh_token"], time.time() + int(data.get("expires_in", 3600)) - 60


def fs_value(value):
    if value is None:
        return {"nullValue": None}
    if isinstance(value, bool):
        return {"booleanValue": value}
    if isinstance(value, int):
        return {"integerValue": str(value)}
    if isinstance(value, float):
        return {"doubleValue": value}
    return {"stringValue": str(value)}


def fecha_a_ms(fecha):
    if fecha is None or str(fecha).strip() == "":
        return int(time.time() * 1000)
    s = str(fecha).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%d/%m/%Y %H:%M:%S", "%d/%m/%Y %H:%M", "%d/%m/%Y"):
        try:
            return int(time.mktime(time.strptime(s, fmt)) * 1000)
        except ValueError:
            pass
    try:
        n = float(s)
        if n > 1e12:
            return int(n)
        if n > 1e9:
            return int(n * 1000)
    except ValueError:
        pass
    return int(time.time() * 1000)


def nivel_norm(value):
    s = str(value or "").strip().upper()
    if s in ("ROJO", "AMARILLO", "VERDE"):
        return s
    if s.startswith("ROJ") or s == "RED":
        return "ROJO"
    if s.startswith("AMA") or s.startswith("YEL"):
        return "AMARILLO"
    if s.startswith("VER") or s == "GREEN":
        return "VERDE"
    return s[:20]


def as_int_or_str(value, lo, hi, max_len):
    if value is None or str(value).strip() == "":
        return None
    if isinstance(value, bool):
        return str(value).lower()[:max_len]
    if isinstance(value, int) and lo <= value <= hi:
        return value
    if isinstance(value, float) and value == int(value) and lo <= int(value) <= hi:
        return int(value)
    s = str(value).strip()
    try:
        n = int(s)
        if lo <= n <= hi and str(n) == s:
            return n
    except (TypeError, ValueError):
        pass
    return s[:max_len]


def as_vital(value):
    if value is None or str(value).strip() == "":
        return None
    try:
        n = float(value)
        if 0 <= n <= 300:
            return int(n) if n == int(n) else n
    except (TypeError, ValueError):
        pass
    return str(value).strip()[:20]


def as_bool(value):
    if isinstance(value, bool):
        return value
    if value is None or str(value).strip() == "":
        return False
    if isinstance(value, (int, float)):
        return value != 0
    return str(value).strip().lower() in ("1", "true", "si", "sí", "yes", "atendido")


def foto_web(value):
    if not isinstance(value, str):
        return None
    s = value.strip()
    if s.startswith("https://") and len(s) <= 2000:
        return s
    if s.startswith("data:image/") and len(s) <= 120000:
        return s
    return None


def clip(value, n):
    if value is None:
        return None
    s = str(value).strip()
    return s[:n] if s else None


def fila_a_campos(row, incluir_atendido):
    """row es sqlite3.Row con columna id = rowid."""
    campos = {
        "sqlite_id": int(row["id"]),
        "origen": "icaro",
        "nombre": str(row["nombre"] or "").strip()[:120],
        "dui": str(row["dui"] or "").strip()[:20],
        "nivel": nivel_norm(row["nivel"]),
        "fecha": str(row["fecha"] or "").strip()[:80],
        "fecha_ms": fecha_a_ms(row["fecha"]),
        "actualizado_en": int(time.time() * 1000),
        "subido": True,
    }
    opcionales = {
        "edad": as_int_or_str(row["edad"], 0, 130, 20),
        "alarma": clip(row["alarma"], 200) if not isinstance(row["alarma"], bool) else bool(row["alarma"]),
        "motivos": clip(row["motivos"], 4000),
        "molestia": clip(row["molestia"], 4000),
        "tiempo": clip(row["tiempo"], 120),
        "intensidad": clip(row["intensidad"], 40),
        "otros": clip(row["otros"], 4000),
        "condiciones": clip(row["condiciones"], 4000),
        "alergias": clip(row["alergias"], 4000),
        "naturaleza": clip(row["naturaleza"], 200),
        "observacion": clip(row["observacion"], 4000),
        "foto": foto_web(row["foto"]),
        "temperatura": as_vital(row["temperatura"]),
        "pulso": as_vital(row["pulso"]),
    }
    if incluir_atendido:
        opcionales["atendido"] = as_bool(row["atendido"])
        opcionales["atendido_en"] = clip(row["atendido_en"], 80)
    for key, value in opcionales.items():
        if value is not None:
            campos[key] = value
    return {k: fs_value(v) for k, v in campos.items()}


def _patch(token, doc_id, fields, exists):
    base = (
        "https://firestore.googleapis.com/v1/projects/%s/databases/(default)/documents/apps/icaro/consultas/%s"
        % (PROJECT_ID, urllib.parse.quote(str(doc_id)))
    )
    qs = ["updateMask.fieldPaths=" + urllib.parse.quote(k) for k in fields]
    qs.append("currentDocument.exists=" + ("true" if exists else "false"))
    url = base + "?" + "&".join(qs)
    return _request(
        url,
        {"fields": fields},
        headers={"Authorization": "Bearer " + token},
        method="PATCH",
    )


def subir_fila(token, row):
    doc_id = str(int(row["id"]))
    nuevo = fila_a_campos(row, incluir_atendido=True)
    try:
        _patch(token, doc_id, nuevo, exists=False)
    except AlreadyExists:
        # Reintento: no pisa atendido / atendido_en si el panel ya los marcó.
        _patch(token, doc_id, fila_a_campos(row, incluir_atendido=False), exists=True)


def pendientes(conn):
    conn.row_factory = sqlite3.Row
    return conn.execute(
        "SELECT rowid AS id, fecha, dui, nombre, edad, nivel, alarma, motivos, "
        "molestia, tiempo, intensidad, otros, condiciones, alergias, naturaleza, "
        "observacion, foto, temperatura, pulso, atendido, atendido_en, subido "
        "FROM %s WHERE COALESCE(subido, 0) = 0" % TABLA
    ).fetchall()


def sincronizar(db_path):
    token, refresh_token, expira = sign_in()
    conn = sqlite3.connect(db_path)
    try:
        for row in pendientes(conn):
            if time.time() > expira:
                token, refresh_token, expira = refresh(refresh_token)
            subir_fila(token, row)
            conn.execute("UPDATE %s SET subido = 1 WHERE rowid = ?" % TABLA, (int(row["id"]),))
            conn.commit()
    finally:
        conn.close()


# sincronizar("datos/icaro.db")
```

Notas para ese chat:

- El reloj del Jetson tiene que ser razonable al subir (`fecha_ms` y `actualizado_en` son epoch ms). Conviene NTP y la zona `America/El_Salvador`, porque `fecha_ms` sale de la hora local con `time.mktime`.
- `atendido_por` lo escribe solo el panel. El robot no lo manda.
- Si la tabla usa una columna `id` propia en lugar de `rowid`, ese entero es el id del documento y el `UPDATE` debe usar esa columna.
- Tras publicar las reglas, una fila de prueba tiene que aparecer en https://viam.es/app/ con la cuenta de personal.

En `localhost`, abre `/app/#preview` para ver el diseño con tres fichas ficticias. En viam.es ese hash no activa nada.
