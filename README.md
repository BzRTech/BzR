# BzR Technology

Site institucional da BzR Technology — software que vira hábito.

## Estrutura

Site estático, sem build — basta abrir `index.html` ou publicar a pasta em qualquer hospedagem (GitHub Pages, Netlify, Vercel).

- `index.html` — página única (hero, tese, serviços, WebGIS, método, público, contato)
- `css/style.css` — estilos; tokens de marca no `:root`
- `js/main.js` — animações de entrada, contadores e o mapa WebGIS ilustrativo (canvas)
- `assets/` — logotipo (versões escura e branca), favicon e ícone de app

## Marca

- **O Bloco**: quadrado com um único canto arredondado, sempre o superior-direito (`border-radius: 0 .36em 0 0`). Sólido constrói; piscando, é o cursor.
- **Cor**: verde-sinal `#008037`, preto `#0A0B0A`, papel `#F4F5F2`. Sem degradê, sem sombra.
- **Tipografia**: Space Grotesk (texto) + JetBrains Mono (etiquetas e código).

## Antes de publicar

- Troque o e-mail de contato em `index.html` (procure por `contato@seudominio.com.br`).
