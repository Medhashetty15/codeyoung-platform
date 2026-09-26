-- Runs once, on first start of an empty data volume.
-- codeyoung_dev: backend dev API (port 3000)
-- codeyoung_fe:  frontend worktree's own API instance (port 3001)
-- codeyoung_test: optional manual test runs (automated tests use Testcontainers)
CREATE DATABASE codeyoung_dev;
CREATE DATABASE codeyoung_fe;
CREATE DATABASE codeyoung_test;

ALTER DATABASE codeyoung_dev SET timezone TO 'UTC';
ALTER DATABASE codeyoung_fe SET timezone TO 'UTC';
ALTER DATABASE codeyoung_test SET timezone TO 'UTC';
