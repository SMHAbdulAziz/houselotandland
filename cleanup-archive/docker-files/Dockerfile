# Simple CLI-focused Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set work directory
WORKDIR /app

# Copy application code
COPY app/ ./app/
COPY data/ ./data/
COPY reports/ ./reports/
COPY .env* ./

# Create necessary directories with proper permissions
RUN mkdir -p data reports

# Make main.py executable
RUN chmod +x app/main.py

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Set the default command - CLI mode
CMD ["python", "app/main.py", "--cli"]