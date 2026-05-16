import bleach

def sanitize_string(value: str) -> str:
    """Strip all HTML tags and attributes from a string."""
    if not isinstance(value, str):
        return value
    return bleach.clean(value, tags=[], attributes={}, strip=True)

def sanitize_input(data: dict | list | str) -> dict | list | str:
    """Recursively sanitize string values in a nested data structure."""
    if isinstance(data, dict):
        return {k: sanitize_input(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_input(v) for v in data]
    elif isinstance(data, str):
        return sanitize_string(data)
    else:
        return data
