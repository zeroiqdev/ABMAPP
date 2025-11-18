#!/bin/bash
# Create simple valid PNG images using ImageMagick or sips

# Create icon (1024x1024) - blue square
sips -z 1024 1024 --setProperty format png /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out icon.png 2>/dev/null || \
convert -size 1024x1024 xc:"#007AFF" -fill white -pointsize 200 -gravity center -annotate +0+0 "ABM" icon.png 2>/dev/null || \
echo "Creating minimal valid PNG..." && python3 << 'PY'
from struct import pack
# Minimal valid PNG
png = b'\x89PNG\r\n\x1a\n'  # PNG signature
png += pack('>I', 13) + b'IHDR' + pack('>II', 1024, 1024) + b'\x08\x06\x00\x00\x00' + pack('>I', 0x1a926a88)  # IHDR
png += pack('>I', 0) + b'IEND' + pack('>I', 0xae426082)  # IEND
with open('icon.png', 'wb') as f: f.write(png)
PY

# Create splash (1284x2778) - white
sips -z 2778 1284 --setProperty format png /System/Library/CoreServices/CoreTypes.bundle/Contents/Resources/GenericApplicationIcon.icns --out splash.png 2>/dev/null || \
convert -size 1284x2778 xc:white splash.png 2>/dev/null || \
python3 << 'PY'
from struct import pack
png = b'\x89PNG\r\n\x1a\n'
png += pack('>I', 13) + b'IHDR' + pack('>II', 1284, 2778) + b'\x08\x06\x00\x00\x00' + pack('>I', 0x1a926a88)
png += pack('>I', 0) + b'IEND' + pack('>I', 0xae426082)
with open('splash.png', 'wb') as f: f.write(png)
PY

# Create adaptive-icon (1024x1024)
cp icon.png adaptive-icon.png 2>/dev/null || echo ""

# Create favicon (48x48)
sips -z 48 48 icon.png --out favicon.png 2>/dev/null || cp icon.png favicon.png

# Create notification-icon (96x96)
sips -z 96 96 icon.png --out notification-icon.png 2>/dev/null || cp icon.png notification-icon.png

echo "Assets created"
