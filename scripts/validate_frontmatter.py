import os
import re
import sys
from datetime import datetime

def validate_frontmatter(file_path):
    """
    Parses and validates the YAML frontmatter of a markdown file.
    Does not use external YAML libraries as they may not be available.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return [f"Could not read file: {e}"]

    # Match YAML frontmatter (between --- and ---)
    # Using re.MULTILINE to handle potential whitespace before/after markers if needed,
    # but typically it's at the start of the file.
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if not match:
        return ["Missing frontmatter or invalid delimiters (expected '---' at start and after frontmatter)"]

    frontmatter_raw = match.group(1)
    errors = []

    # Simple YAML parser for the expected structure
    data = {}
    current_key = None

    for line in frontmatter_raw.splitlines():
        if not line.strip():
            continue

        # Check for list items (e.g., "  - item")
        list_match = re.match(r'^\s*-\s*(.*)', line)
        if list_match:
            if current_key:
                if not isinstance(data.get(current_key), list):
                    data[current_key] = []
                val = list_match.group(1).strip().strip('"').strip("'")
                if val:
                    data[current_key].append(val)
            else:
                errors.append(f"List item found without a preceding key: {line.strip()}")
            continue

        # Check for key-value pairs (e.g., "key: value" or "key:")
        kv_match = re.match(r'^([^:]+):\s*(.*)', line)
        if kv_match:
            current_key = kv_match.group(1).strip()
            val = kv_match.group(2).strip().strip('"').strip("'")
            if val:
                data[current_key] = val
            else:
                # Value is empty, might be start of a list on following lines
                data[current_key] = None
            continue

    # Required fields validation
    required_fields = ['title', 'date', 'author', 'description', 'categories', 'tags']
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: '{field}'")
        else:
            val = data[field]
            if val is None or val == "":
                # It might be None if it was supposed to be a list but had no items
                errors.append(f"Field '{field}' is empty or not properly formatted")
            elif field in ['categories', 'tags']:
                if not isinstance(val, list):
                    errors.append(f"Field '{field}' should be a list (use '  - item' format)")
                elif len(val) == 0:
                    errors.append(f"Field '{field}' is an empty list")

    # Date validation
    if 'date' in data and data['date']:
        date_str = str(data['date'])
        try:
            # datetime.fromisoformat handles YYYY-MM-DD and YYYY-MM-DDTHH:MM:SS+HH:MM
            datetime.fromisoformat(date_str)
        except ValueError:
            errors.append(f"Invalid date format: '{date_str}'. Expected ISO 8601 (e.g., YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS+HH:MM)")

    return errors

def main():
    blog_dir = 'content/blog'
    if not os.path.exists(blog_dir):
        print(f"Error: Directory {blog_dir} not found.")
        sys.exit(1)

    all_errors = {}
    total_files = 0

    for filename in os.listdir(blog_dir):
        if filename.endswith('.md'):
            total_files += 1
            file_errors = []

            # Filename convention check YYYY-MM-DD-Title.md
            # We'll be slightly flexible with the title part (allowing spaces if they exist, but generally kebab-case)
            if not re.match(r'^\d{4}-\d{2}-\d{2}-.+\.md$', filename):
                file_errors.append(f"Filename does not follow YYYY-MM-DD-Title.md convention: '{filename}'")

            file_path = os.path.join(blog_dir, filename)
            file_errors.extend(validate_frontmatter(file_path))

            if file_errors:
                all_errors[filename] = file_errors

    if all_errors:
        print(f"Validation FAILED: Found errors in {len(all_errors)} out of {total_files} files.")
        for filename, errors in sorted(all_errors.items()):
            print(f"\n[{filename}]")
            for error in errors:
                print(f"  - {error}")
        sys.exit(1)
    else:
        print(f"Validation PASSED: All {total_files} blog posts have valid frontmatter and filenames.")
        sys.exit(0)

if __name__ == '__main__':
    main()
