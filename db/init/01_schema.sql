-- ============================================================
--  VOTESYSTEM — Database initialization script
--  Auto-executed when the MySQL container starts
-- ============================================================

CREATE DATABASE IF NOT EXISTS votesystem CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE votesystem;

-- -------------------------------------------------------
-- roles
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id              INT           AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(50)   NOT NULL UNIQUE,
    description     VARCHAR(255)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- users
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id              INT           AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(100)  NOT NULL,
    last_name       VARCHAR(100)  NOT NULL,
    dni             CHAR(8)       NOT NULL UNIQUE COMMENT '8-digit national ID',
    email           VARCHAR(150)  NOT NULL UNIQUE,
    photo_url       VARCHAR(255)  COMMENT 'Reference photo for face verification',
    fingerprint_hash VARCHAR(255) COMMENT 'Stored fingerprint template/hash for biometric match',
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    role_id         INT           NOT NULL,
    created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_dni (dni),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- candidates
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS candidates (
    id          INT          AUTO_INCREMENT PRIMARY KEY,
    full_name   VARCHAR(100) NOT NULL,
    party       VARCHAR(100),
    photo_url   VARCHAR(255),
    description TEXT         COMMENT 'Bio or campaign summary',
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- votes
-- -------------------------------------------------------
CREATE TABLE IF NOT EXISTS votes (
    id                      INT     AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT     NOT NULL,
    candidate_id            INT     NOT NULL,
    -- Biometric audit fields
    face_confidence         FLOAT   COMMENT 'Confidence score returned by face verification',
    fingerprint_confidence  FLOAT   COMMENT 'Confidence score returned by fingerprint verification',
    face_verified           BOOLEAN NOT NULL DEFAULT FALSE,
    fingerprint_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address              VARCHAR(45),
    voted_at                DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user      (user_id),
    INDEX idx_candidate (candidate_id),
    -- One vote per user enforced at DB level
    UNIQUE KEY uq_one_vote_per_user (user_id)
) ENGINE=InnoDB;

-- -------------------------------------------------------
-- Seed data: sample candidates
-- -------------------------------------------------------
INSERT IGNORE INTO candidates (full_name, party) VALUES
    ('Ana García',    'Partido Progresista'),
    ('Luis Morales',  'Partido Nacional'),
    ('Sara Jiménez',  'Partido Verde');

-- -------------------------------------------------------
-- Seed data: roles and users
-- -------------------------------------------------------
INSERT IGNORE INTO roles (id, name, description) VALUES 
(1, 'ADMIN', 'Administrator full access'),
(2, 'VOTER', 'Standard voter');

INSERT IGNORE INTO users (first_name, last_name, dni, email, role_id) VALUES 
('Admin', 'System', '00000000', 'admin@votesystem.local', 1),
('Test', 'User', '11111111', 'test@votesystem.local', 2);
