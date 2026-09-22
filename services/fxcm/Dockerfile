# Das offizielle Linux-Wheel setzt CPython 3.7 voraus; kein eingehender Dienst.
FROM python:3.7.17-slim-bullseye@sha256:603879aeff06df23f0d392a19f7ce02aa85e14e6b4d25fd9647b116e0cb93467
RUN pip install --no-cache-dir --only-binary=:all: forexconnect==1.6.43 numpy==1.21.6 pandas==1.3.5 python-dateutil==2.9.0.post0 pytz==2026.3.post1 six==1.17.0
COPY candles.py collector.py /app/
USER 10001:10001
ENV PYTHONUNBUFFERED=1
HEALTHCHECK --interval=60s --timeout=10s --start-period=120s CMD python -c "import pathlib,time; assert time.time()-float(pathlib.Path('/data/heartbeat').read_text()) < 180"
ENTRYPOINT ["python", "/app/collector.py"]
