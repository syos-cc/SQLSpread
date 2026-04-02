FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./* \
    && apk add --no-cache curl \
    && curl -L https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.js   -o /usr/share/nginx/html/sql-wasm.js   \
    && curl -L https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.wasm -o /usr/share/nginx/html/sql-wasm.wasm \
    && apk del curl

COPY index.html /usr/share/nginx/html/index.html
COPY LICENSE    /usr/share/nginx/html/LICENSE.txt
COPY README.md  /usr/share/nginx/html/README.md

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
