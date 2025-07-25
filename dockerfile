# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: serve static with nginx
FROM nginx:stable-alpine
COPY --from=builder /app/build /usr/share/nginx/html
# Opcional: copia un nginx.conf personalizado si necesitas rutas SPA
# COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
