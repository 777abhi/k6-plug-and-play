FROM grafana/k6:latest

WORKDIR /app

COPY dist/ /app/dist/
COPY data/ /app/data/

ENTRYPOINT ["k6"]
CMD ["run", "/app/dist/baseline.js"]
