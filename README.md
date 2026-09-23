# Viam

Sitio de Viam · https://viam26.github.io/ViamPI/  
Dominio propio: **https://viam.es**

Panel de registros de ICARO (personal, con login): **https://viam.es/app/**

Ese enlace no necesita DNS nuevo: el sitio es un solo GitHub Pages y el `CNAME` ya es `viam.es`. Un subdominio `app.viam.es` no puede colgarse de este mismo sitio. Si más adelante se quiere aparte, hace falta otro proyecto de Pages y un CNAME `app` → `viam26.github.io`. Detalle en `firebase/README.md`.

## Configurar `viam.es` con GitHub Pages

El sitio ya se publica desde la rama `main` (carpeta `/`). Falta enlazar el dominio en GitHub y apuntar el DNS del registrador.

### 1. En GitHub (Settings → Pages)

1. Abre [Settings → Pages](https://github.com/Viam26/ViamPI/settings/pages) del repo.
2. En **Custom domain**, escribe `viam.es` y guarda.
3. Cuando GitHub diga que el DNS está OK, activa **Enforce HTTPS**.
4. (Opcional pero recomendado) En [Settings → Pages → Custom domains](https://github.com/settings/pages) de tu cuenta, **verifica** `viam.es` para que nadie más pueda usarlo.

El archivo `CNAME` en la raíz del repo ya contiene `viam.es`. Si lo configuras desde Settings, GitHub lo mantiene solo.

### 2. En el DNS del registrador (donde compraste `viam.es`)

Borra registros A/AAAA/CNAME viejos del apex (`@` / `viam.es`) y de `www` si apuntan a otra cosa. Luego crea:

#### Apex `viam.es` — cuatro registros **A**

| Tipo | Nombre / Host | Valor | TTL |
|------|---------------|-------|-----|
| A | `@` (o en blanco / `viam.es`) | `185.199.108.153` | 3600 o Auto |
| A | `@` | `185.199.109.153` | 3600 o Auto |
| A | `@` | `185.199.110.153` | 3600 o Auto |
| A | `@` | `185.199.111.153` | 3600 o Auto |

#### (Opcional) IPv6 — cuatro registros **AAAA**

| Tipo | Nombre | Valor |
|------|--------|-------|
| AAAA | `@` | `2606:50c0:8000::153` |
| AAAA | `@` | `2606:50c0:8001::153` |
| AAAA | `@` | `2606:50c0:8002::153` |
| AAAA | `@` | `2606:50c0:8003::153` |

#### `www.viam.es` — un **CNAME** (recomendado)

| Tipo | Nombre / Host | Valor |
|------|---------------|-------|
| CNAME | `www` | `viam26.github.io` |

Importante: el CNAME apunta a `viam26.github.io` **sin** `/ViamPI`. Con el dominio custom el sitio queda en la raíz (`https://viam.es/`).

Si tu proveedor ofrece **ALIAS** / **ANAME** en el apex, puedes usar uno solo apuntando a `viam26.github.io` en lugar de los cuatro A (no todos los registradores `.es` lo tienen).

### 3. Comprobar

Espera unos minutos (a veces hasta ~24 h) y prueba:

```bash
dig viam.es +noall +answer -t A
dig www.viam.es +nostats +nocomments +nocmd
```

Deberías ver las IPs de GitHub arriba, y `www` resolviendo vía CNAME a `viam26.github.io`.

Luego abre https://viam.es — cuando el candado HTTPS esté listo en Pages, actívalo si aún no está.

### Orden recomendado

1. Guardar `viam.es` en **Settings → Pages** (o mergear este PR con el `CNAME`).
2. Crear los registros DNS en el registrador.
3. Esperar a que Pages marque el dominio como verificado / DNS check OK.
4. Activar **Enforce HTTPS**.

Docs oficiales: [Managing a custom domain for GitHub Pages](https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).
