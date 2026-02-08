FROM python:3.11-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential g++ \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-install CmdStan (Prophet backend) at build time
RUN python -c "import cmdstanpy; cmdstanpy.install_cmdstan()"

FROM python:3.11-slim

WORKDIR /app

# Copy installed packages and CmdStan from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /root/.cmdstan /root/.cmdstan

# CmdStan needs g++ at runtime for model compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    g++ make \
    && rm -rf /var/lib/apt/lists/*

ENV CMDSTAN=/root/.cmdstan/cmdstan-2.36.0

COPY . .

EXPOSE 8080

# Use gunicorn with uvicorn workers for production
CMD ["gunicorn", "app:app", "-k", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "300", \
     "--access-logfile", "-"]
