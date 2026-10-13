FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /cineight-api .

FROM alpine:3.22
COPY --from=build /cineight-api /cineight-api
EXPOSE 8080
ENTRYPOINT ["/cineight-api"]
