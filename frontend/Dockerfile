# Imagem do Vite. Node só para desenvolver: o servidor que sobe aqui é o de
# desenvolvimento, com HMR, igual ao que rodava no terminal.
FROM node:22-slim

WORKDIR /app

# `npm ci` antes do código, para que editar um componente não reinstale o React.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# `--host 0.0.0.0` porque, de dentro do contêiner, escutar em 127.0.0.1 é
# escutar num lugar onde o navegador do host nunca vai bater.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
