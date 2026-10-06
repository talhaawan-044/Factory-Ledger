import os
import sys
from PIL import Image, ImageDraw

def generate_icons(source_image_path):
    if not os.path.exists(source_image_path):
        print(f"Error: {source_image_path} does not exist")
        sys.exit(1)

    im = Image.open(source_image_path).convert('RGBA')

    # Save to public directory
    public_dir = os.path.abspath('public')
    os.makedirs(public_dir, exist_ok=True)

    im.resize((512, 512), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'app-icon.png'))
    im.resize((180, 180), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'apple-touch-icon.png'))
    im.resize((64, 64), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'favicon.png'))
    im.resize((32, 32), Image.Resampling.LANCZOS).save(os.path.join(public_dir, 'favicon-32x32.png'))
    print("Saved public web icons.")

    # Android mipmaps
    res_dir = os.path.abspath('android/app/src/main/res')
    densities = [
        ('mipmap-mdpi', 48, 108),
        ('mipmap-hdpi', 72, 162),
        ('mipmap-xhdpi', 96, 216),
        ('mipmap-xxhdpi', 144, 324),
        ('mipmap-xxxhdpi', 192, 432),
    ]

    for folder, icon_size, fg_size in densities:
        target_folder = os.path.join(res_dir, folder)
        os.makedirs(target_folder, exist_ok=True)

        # Standard icon
        standard = im.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        standard.save(os.path.join(target_folder, 'ic_launcher.png'))

        # Round icon with circular mask
        round_icon = Image.new('RGBA', (icon_size, icon_size), (0, 0, 0, 0))
        mask = Image.new('L', (icon_size, icon_size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, icon_size - 1, icon_size - 1), fill=255)
        round_icon.paste(standard, (0, 0), mask=mask)
        round_icon.save(os.path.join(target_folder, 'ic_launcher_round.png'))

        # Foreground for adaptive icon (scaled to fit inside safe zone ~66% of canvas)
        fg_canvas = Image.new('RGBA', (fg_size, fg_size), (0, 0, 0, 0))
        inner_size = int(fg_size * 0.72)
        inner_icon = im.resize((inner_size, inner_size), Image.Resampling.LANCZOS)
        offset = (fg_size - inner_size) // 2
        fg_canvas.paste(inner_icon, (offset, offset))
        fg_canvas.save(os.path.join(target_folder, 'ic_launcher_foreground.png'))

        print(f"Generated {folder}: {icon_size}x{icon_size} and fg {fg_size}x{fg_size}")

if __name__ == '__main__':
    source = sys.argv[1] if len(sys.argv) > 1 else '/home/talhaawan/.gemini/antigravity-ide/brain/72ceb885-f01e-4a65-8bca-3328b5dee85d/coal_ledger_scale_icon_1791191524611.jpg'
    generate_icons(source)
