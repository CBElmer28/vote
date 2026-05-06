FROM nginx:alpine

# Eliminar la configuración por defecto de Nginx
RUN rm /etc/nginx/nginx.conf

# Copiar nuestra configuración personalizada
COPY nginx.conf /etc/nginx/nginx.conf

# Exponer el puerto 80
EXPOSE 80

# Nginx corre por defecto en el primer plano en la imagen oficial
CMD ["nginx", "-g", "daemon off;"]
