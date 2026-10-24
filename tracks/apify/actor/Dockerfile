FROM apify/actor-node:22
COPY package*.json ./
RUN npm install --omit=dev --omit=optional --no-audit --no-fund
COPY src ./src
COPY .actor ./.actor
CMD ["node", "src/main.js"]
