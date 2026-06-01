.PHONY: build test lint install clean

build:
	go build -o bin/northstar-pp-cli ./cmd/northstar-pp-cli

test:
	go test ./...

lint:
	golangci-lint run

install:
	go install ./cmd/northstar-pp-cli

clean:
	rm -rf bin/

build-mcp:
	go build -o bin/northstar-pp-mcp ./cmd/northstar-pp-mcp

install-mcp:
	go install ./cmd/northstar-pp-mcp

build-all: build build-mcp
