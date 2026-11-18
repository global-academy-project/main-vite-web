FROM node:24.22.2-alpine3.24 AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# -------------------------------[ Build Stage to Nginx Stage ]-------------------------------
FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# -------------------------------[ End of Dockerfile ]-------------------------------