# Stria est un fichier autonome (index.html) : nginx sans privilèges, port 8080
FROM nginxinc/nginx-unprivileged:alpine
COPY --chown=nginx:nginx index.html /usr/share/nginx/html/index.html
EXPOSE 8080
