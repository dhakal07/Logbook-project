-- Create users table with GDPR considerations
CREATE TABLE abc123_users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL, -- Securely hashed password
    email VARCHAR(100) UNIQUE NOT NULL, -- Encrypted in application layer if needed
    role VARCHAR(20) CHECK (role IN ('reserver', 'administrator')) NOT NULL,
    age INT CHECK (age > 15), -- Age restriction
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pseudonym VARCHAR(100) UNIQUE NOT NULL, -- Pseudonym for privacy
    consent BOOLEAN NOT NULL, -- User consent for data processing
    data_retention_period INTERVAL NOT NULL DEFAULT INTERVAL '1 year' -- Data retention period
);

-- Create resources table
CREATE TABLE abc123_resources (
    resource_id SERIAL PRIMARY KEY,
    resource_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reservations table
CREATE TABLE abc123_reservations (
    reservation_id SERIAL PRIMARY KEY,
    reserver_pseudonym VARCHAR(100) NOT NULL, -- Pseudonym instead of user ID
    resource_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NOT NULL,
    purpose VARCHAR(255) NOT NULL, -- Explicit purpose of reservation
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resource_id) REFERENCES abc123_resources (resource_id) ON DELETE CASCADE
);

-- Create public view for booked resources
CREATE VIEW abc123_booked_resources AS
SELECT 
    r.resource_name,
    rs.start_time,
    rs.end_time,
    rs.purpose
FROM abc123_reservations rs
JOIN abc123_resources r ON rs.resource_id = r.resource_id;