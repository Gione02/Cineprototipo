FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /cineight-api ./cmd/api

FROM alpine:3.22
# Usuario sin privilegios: si alguien compromete el proceso, no obtiene root dentro del contenedor.
# Alpine trae adduser de BusyBox (no useradd): -S crea una cuenta de sistema sin contraseña ni shell de acceso.
RUN addgroup -S app && adduser -S -G app -H -s /sbin/nologin appuser
COPY --from=build --chown=root:root --chmod=0755 /cineight-api /cineight-api
USER appuser
EXPOSE 8080
ENTRYPOINT ["/cineight-api"]
