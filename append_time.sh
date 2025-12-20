#!/bin/bash



file="README.md"

# Check if the file exists
if [ ! -f "$file" ]; then
    echo "Error: File does not exist: $file"
    exit 1
fi

# Check if the file has a .md extension
if [[ "$file" != *.md ]]; then
    echo "Error: File must be a Markdown file (.md extension): $file"
    exit 1
fi

# Get current timestamp
current_time=$(date '+%Y-%m-%d %H:%M:%S')

# Append to file
echo "$current_time" >> "$file"

echo "Appended timestamp to $file: $current_time"
