# دیوان دیوانه‌وار

وب‌کتاب مصور فارسی با ورق‌زدن سه‌بعدی، فهرست فصل‌ها و روایت مرد کلبه و بانوی آتش.

این مخزن برای انتشار عمومی از طریق GitHub Pages آماده می‌شود.

## نمونهٔ ویراستاری و صوت فصل اول

نسخهٔ اصلیِ فصل در `manuscript/archive/` حفظ شده است. نثر بازپرداخت‌شده و نقش‌بندی صوت در `assets/chapter1/chapter1.json` قرار دارند. اگر فایل فصل در دسترس نباشد، کتاب متن اصلی را نمایش می‌دهد. برای توضیح منبع و تغییرات، `manuscript/EDITORIAL.md`، و برای هزینه و محدودیت‌های نمونه، `manuscript/AUDIO-QA.md` را ببینید.

آزمون‌ها: `python tests/chapter1-static.py` و `node --check assets/chapter1/reader.js`. برای بازآزمایی مرورگر، مخزن را با `python -m http.server 8483` سرو کنید و پس از نصب Playwright و Chromium، `python tests/chapter1-browser.py` را اجرا کنید.
