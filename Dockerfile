# VerbaAI PWA — situs statis murni (HTML + ES modules); satu-satunya langkah
# build adalah menandai versi file.
FROM nginx:1.29-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY index.html manifest.json sw.js /usr/share/nginx/html/
COPY js/ /usr/share/nginx/html/js/
COPY icons/ /usr/share/nginx/html/icons/

# Cap setiap build dengan ID unik supaya browser & service worker tidak
# mencampur file JS lama dengan index.html baru.
ARG BUILD_ID=dev
RUN sed -i "s/__BUILD__/${BUILD_ID}/g" \
      /usr/share/nginx/html/index.html \
      /usr/share/nginx/html/sw.js \
      /usr/share/nginx/html/js/app.js

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1/healthz || exit 1
