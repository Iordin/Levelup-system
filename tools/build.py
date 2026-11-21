"""Build helpers (no dependencies).
  python3 tools/build.py preview   → dist/preview.html : single content-only file for the Artifact viewer
  python3 tools/build.py zip       → dist/vito-system-v2.zip : the files to upload to the GitHub Pages repo
"""
import os, re, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p: open(os.path.join(ROOT, p), encoding='utf-8').read()

def parts():
    html = rd('index.html')
    title = re.search(r'<title>(.*?)</title>', html, re.S).group(1).strip()
    desc = re.search(r'<meta name="description" content="(.*?)">', html).group(1)
    fonts = re.search(r'<link href="(https://fonts\.googleapis\.com/css2[^"]+)"', html).group(1)
    body = re.search(r'<body>(.*?)<script src=', html, re.S).group(1).strip()
    scripts = re.findall(r'<script src="([^"]+)"></script>', html)
    return title, desc, fonts, body, scripts

PREVIEW_CSS = """
/* preview wrapper: the host page already pads :root by the phone's safe-area insets */
#hud { top: env(safe-area-inset-top, 0px); padding-top: 8px; }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--void); }
"""

def preview():
    title, desc, fonts, body, scripts = parts()
    js = '\n;\n'.join(rd(s) for s in scripts).replace('</script', '<\\/script')
    out = f"""<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="{fonts}" rel="stylesheet">
<style>
{rd('styles.css')}{PREVIEW_CSS}</style>
<script>window.VITO_PREVIEW = true; document.documentElement.lang = 'fa'; document.documentElement.dir = 'rtl'; document.documentElement.dataset.accent = 'blue';</script>
{body}
<script>
{js}
</script>
"""
    os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
    path = os.path.join(ROOT, 'dist', 'preview.html')
    open(path, 'w', encoding='utf-8').write(out)
    print(path, f'{len(out.encode()) / 1024:.0f} KB')

README = """# سیستم ویتو — نسخه‌ی ۲

برنامه‌ی وب (PWA) برای تبدیل هدف‌ها به کوئست، XP و رتبه. فارسی، راست‌به‌چپ، بدون وابستگی و بدون مرحله‌ی build.

## نصب روی GitHub Pages (مخزن vito-system-level-up)
1. فایل‌های قدیمی مخزن رو پاک کن (index.html، achievements.js، sw.js و بقیه‌ی فایل‌های نسخه‌ی قبل).
2. محتوای این پوشه رو (index.html، styles.css، sw.js، manifest.webmanifest، پوشه‌های js و icons و فایل .nojekyll) بریز توی مخزن و commit کن.
3. چند دقیقه صبر کن تا Pages منتشر بشه، بعد سایت رو یک بار با اینترنت باز کن. sw.js جدید همه‌ی کش‌های نسخه‌ی قبل رو پاک می‌کنه و برنامه آفلاین هم کار می‌کنه.
4. توی گوشی از منوی مرورگر «Add to Home screen» رو بزن.

اطلاعات نسخه‌ی قبلی خونده نمی‌شه (کلید ذخیره‌سازی جدیده) و برنامه از صفر شروع می‌کنه.

## Gemini (اختیاری)
تنظیمات ← هوش مصنوعی. کلید رایگان رو از aistudio.google.com/apikey بگیر. گوگل از ایران جواب نمی‌ده و VPN لازمه؛ بدون کلید یا اینترنت، سیستم با قانون‌های داخلی کوئست‌های دلخواه رو بررسی می‌کنه. کلید فقط روی همین دستگاه می‌مونه و توی پشتیبان ذخیره نمی‌شه.

## ساختار
- js/engine.js: همه‌ی منطق بازی (XP، سطح، رتبه، استریک، بررسی کوئست دلخواه). فقط اینجا قانون عوض می‌شه.
- js/library.js: کتابخونه‌ی کوئست‌ها و حرفه‌ها. حرفه‌ی جدید = یک آیتم تازه توی PROFS.
- js/ai.js: کلاینت Gemini؛ فقط پیشنهاد می‌ده و engine تصمیم می‌گیره.
- js/store.js: ذخیره‌سازی، پشتیبان و بازیابی. js/views.js و js/dom.js: رابط. js/app.js: وضعیت و اکشن‌ها.
- tests/: تست منطق (node --test tests/logic.test.js tests/ai.test.js) و تست مرورگر (python3 tests/e2e.py <پوشه>، tests/e2e2.py، tests/pwa.py).
- tools/build.py: ساخت نسخه‌ی پیش‌نمایش تک‌فایل و همین بسته.
"""

DEPLOY = ['index.html', 'styles.css', 'sw.js', 'manifest.webmanifest']

def pack():
    out = os.path.join(ROOT, 'dist', 'vito-system-v2.zip')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    files = list(DEPLOY)
    for d in ('js', 'icons', 'tests', 'tools'):
        for dp, dn, fn in os.walk(os.path.join(ROOT, d)):
            dn[:] = [x for x in dn if x != '__pycache__']
            files += [os.path.relpath(os.path.join(dp, f), ROOT) for f in fn if not f.endswith('.pyc')]
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in sorted(files):
            z.write(os.path.join(ROOT, f), f)
        z.writestr('README.md', README)
        z.writestr('.nojekyll', '')
    print(out, f'{os.path.getsize(out) / 1024:.0f} KB,', len(files) + 2, 'files')

if __name__ == '__main__':
    {'preview': preview, 'zip': pack}[sys.argv[1] if len(sys.argv) > 1 else 'preview']()
