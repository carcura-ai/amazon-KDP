"""Convert already rendered images to web frames; does not create missing shots.

Requires Pillow. Example:
python tools/convert_frames.py renders/door media/door --width 1280 --quality 82
"""
from pathlib import Path
import argparse
import json

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    parser.add_argument('--width', type=int, default=1280)
    parser.add_argument('--quality', type=int, default=82)
    args = parser.parse_args()
    if args.width < 1 or not 1 <= args.quality <= 100:
        parser.error('width must be positive and quality must be 1..100')
    try:
        from PIL import Image
    except ImportError as error:
        raise SystemExit('Install Pillow in your Python environment first.') from error
    sources = sorted(p for p in args.source.iterdir() if p.suffix.lower() in {'.png','.jpg','.jpeg','.webp'})
    if not sources:
        raise SystemExit('No source images found; render the shot before conversion.')
    args.destination.mkdir(parents=True, exist_ok=True)
    frames = []
    for i, path in enumerate(sources, start=1):
        with Image.open(path) as image:
            image = image.convert('RGB')
            width = min(args.width, image.width)
            height = round(image.height * width / image.width)
            if image.size != (width, height):
                image = image.resize((width, height), Image.Resampling.LANCZOS)
            destination = args.destination / f'frame-{i:04d}.webp'
            image.save(destination, format='WEBP', quality=args.quality, method=6)
            with Image.open(destination) as verify:
                verify.verify()
            frames.append({'file':destination.name,'width':width,'height':height,'bytes':destination.stat().st_size})
    result = {'count':len(frames),'totalBytes':sum(f['bytes'] for f in frames),'frames':frames}
    (args.destination/'manifest.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({'count':result['count'],'totalBytes':result['totalBytes']}))

if __name__ == '__main__':
    main()
