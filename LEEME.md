# jorgetorrijos.tech

Sitio estático: `index.html`, `estilos.css`, `img/`. Sin build.

## Ver en local
python3 -m http.server 5410   (y abrir http://localhost:5410)

## Publicar (Vercel, gratis)
1. vercel.com → entrar con GitHub o correo.
2. Add New → Project → arrastrar esta carpeta (o `npx vercel` aquí dentro).
3. Project → Settings → Domains → agregar `jorgetorrijos.tech` y `www.jorgetorrijos.tech`.
4. name.com → My Domains → jorgetorrijos.tech → Manage DNS Records:
   - borrar los registros A/CNAME del parking (91.195.240.94)
   - A     @    76.76.21.21
   - CNAME www  cname.vercel-dns.com
   (usar los valores que muestre Vercel si son distintos)
5. Esperar minutos a horas; Vercel emite el HTTPS solo.

## Correo hola@jorgetorrijos.tech
Todavía no existe. En name.com → Email Forwarding: reenviar hola@ a tu correo personal.
