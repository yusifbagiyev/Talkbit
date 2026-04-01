# Build mərhələsi
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production mərhələsi
FROM nginx:alpine AS final
COPY --from=build /app/dist /usr/share/nginx/html

# Production-da API_BASE_URL boş olmalıdır — nginx proxy istifadə edir
RUN echo 'window.__ENV__ = { API_BASE_URL: "" };' > /usr/share/nginx/html/env.js

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]