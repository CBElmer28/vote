import logging
import os
from flask import request

# Configure security logger
security_logger = logging.getLogger("SECURITY")
security_logger.setLevel(logging.INFO)

# Ensure the logs directory exists
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# File handler for security events
file_handler = logging.FileHandler(os.path.join(log_dir, "security.log"))
formatter = logging.Formatter('%(asctime)s - %(levelname)s - [IP: %(remote_addr)s] - %(message)s')
file_handler.setFormatter(formatter)
security_logger.addHandler(file_handler)

def log_security_event(event_type: str, details: str, level: str = "INFO"):
    """
    Logs a security event with the remote IP address.
    """
    remote_addr = request.remote_addr if request else "INTERNAL"
    message = f"[{event_type}] {details}"
    
    extra = {"remote_addr": remote_addr}
    
    if level == "WARNING":
        security_logger.warning(message, extra=extra)
    elif level == "ERROR":
        security_logger.error(message, extra=extra)
    else:
        security_logger.info(message, extra=extra)
