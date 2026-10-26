FROM node:24.21-slim

WORKDIR /app

COPY package.json /app
COPY package-lock.json /app

COPY . .

# Clean up apt cache to reduce image size
RUN echo "Installing dependencies..."
RUN npm install

RUN echo "Version check:"
RUN node --version && npm --version

RUN npm run build

EXPOSE 50001

CMD ["npm", "run", "preview", "--", "--port", "50001"]