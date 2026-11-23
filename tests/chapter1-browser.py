"""Opt-in Chromium regression checks: playwright install chromium; serve the repo over HTTP."""
from argparse import ArgumentParser
from pathlib import Path
from playwright.sync_api import sync_playwright

cli = ArgumentParser()
cli.add_argument('--url', default='http://127.0.0.1:8483/')
cli.add_argument('--chromium')
cli.add_argument('--screenshots', type=Path)
args = cli.parse_args()
url = args.url.rstrip('/') + '/'
if args.screenshots:
    args.screenshots.mkdir(parents=True, exist_ok=True)

def check_no_overflow(page):
    assert page.evaluate("""() => {
      const sheet=document.getElementById('sheet');
      return document.documentElement.scrollWidth <= innerWidth+1 &&
        sheet.scrollWidth <= sheet.clientWidth+1 && sheet.scrollHeight <= sheet.clientHeight+1;
    }""")

def go_to_chapter(page, number):
    page.get_by_role('button', name='فهرست', exact=True).click()
    buttons=page.locator('.toc button')
    buttons.nth(number-1).wait_for()
    assert buttons.count()==8
    buttons.nth(number-1).click()
    page.locator('.story-illustration img').wait_for()

def next_page(page):
    before=page.locator('#status').text_content()
    page.get_by_role('button', name='بعدی ❮').click()
    page.wait_for_function("(s) => document.querySelector('#status').textContent !== s",arg=before)

def verify_image(page):
    im=page.locator(".story-illustration img")
    page.wait_for_function("im => im.complete && im.naturalWidth > 0",arg=im.element_handle())
    state=im.evaluate("""im => [im.currentSrc, im.naturalWidth, im.naturalHeight,
        im.offsetWidth,im.offsetHeight,getComputedStyle(im).objectFit,im.alt]""")
    src,nw,nh,w,h,fit,alt=state
    assert src.startswith(url+'assets/images/') and src.endswith('.webp'),src
    assert abs(nw/nh-w/h)<0.02 and fit=='contain' and alt,state

with sync_playwright() as p:
    launch={'args':['--no-sandbox']}
    if args.chromium: launch['executable_path']=args.chromium
    browser=p.chromium.launch(**launch)
    for width,height in ((390,844),(1440,900)):
        mobile=width==390
        ctx=browser.new_context(viewport={'width':width,'height':height},is_mobile=mobile,
                                has_touch=mobile,reduced_motion='reduce')
        page=ctx.new_page()
        errors=[]; broken=[]; audio_requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('response',lambda r:broken.append((r.status,r.url))
                if r.status>=400 and r.url.startswith(url) else None)
        page.on('request',lambda r:audio_requests.append(r.url) if r.url.endswith('.mp3') else None)
        edition=ctx.request.get(url+'assets/chapter1/chapter1.json').json()
        manifest=ctx.request.get(url+'assets/audio/chapter1/manifest.json').json()
        page.goto(url,wait_until='domcontentloaded')
        assert page.locator('html').get_attribute('dir')=='rtl'
        assert page.locator('html').get_attribute('lang')=='fa-IR'
        go_to_chapter(page,1);verify_image(page);check_no_overflow(page)
        assert len(audio_requests)==0, "unexpected media request before play"
        assert page.locator('#chapter-audio').is_visible()
        for _ in range(5): page.get_by_role('button',name='بزرگ کردن قلم').click()
        check_no_overflow(page)
        if args.screenshots:
            page.locator('main').screenshot(path=args.screenshots/f'chapter1-{width}.png')
        for scene_index,scene in enumerate(edition['scenes']):
            if scene_index:
                assert page.locator('.chapter-scene h2').text_content()==scene['title']
                if scene.get('image'): verify_image(page)
                check_no_overflow(page)
            else:
                assert page.locator('#sheet > h3').text_content()==scene['title']
            for passage in scene['passages']:
                next_page(page)
                para=page.locator('.chapter-passage p').first
                assert para.get_attribute('id')==passage['id']
                assert para.text_content()==' '.join(s['text'] for s in passage['segments'])
                check_no_overflow(page)
            next_page(page)
        assert not page.locator('#chapter-audio').is_visible()
        # Chapters 2–8: verify unchanged data in a separate static check, and here
        # exercise each existing cover, image, first body page and navigation.
        for n in range(2,9):
            go_to_chapter(page,n);verify_image(page);check_no_overflow(page)
            page.keyboard.press('ArrowLeft')
            assert page.locator('#sheet > p').first.text_content().strip()
            check_no_overflow(page)
            last=page.locator('#status').text_content()
            page.reload(wait_until='domcontentloaded')
            page.wait_for_function("(text) => document.querySelector('#status').textContent === text",arg=last)
            page.keyboard.press('ArrowRight');verify_image(page)
        go_to_chapter(page,1)
        if mobile:
            page.locator('.book').evaluate("""el => {
              el.dispatchEvent(new TouchEvent('touchstart',{touches:[new Touch({identifier:1,target:el,clientX:100,clientY:180})]}));
              el.dispatchEvent(new TouchEvent('touchend',{changedTouches:[new Touch({identifier:1,target:el,clientX:250,clientY:183})]}));
            }""")
            assert page.locator('.chapter-passage').is_visible()
        go_to_chapter(page,1)
        # A real audio device is not required: Chromium decodes and plays files.
        media=page.locator('#audio-media')
        play=page.locator('#audio-play')
        if manifest['segments']:
            assert len(audio_requests)==0
            ids=list(manifest['segments'])
            for src in manifest['segments'].values():
                response=ctx.request.get(url+src)
                assert response.ok and len(response.body())>1000
            play.click()
            page.wait_for_function("() => document.querySelector('audio').currentTime>0.15")
            assert page.locator('.is-speaking').get_attribute('data-segment-id')==ids[0]
            play.click();assert media.evaluate('a => a.paused')
            t=media.evaluate('a => a.currentTime')
            assert t>0
            play.click();page.wait_for_function("(t) => document.querySelector('audio').currentTime>t+.1",arg=t)
            page.locator('#audio-next').click()
            assert page.locator('.is-speaking').get_attribute('data-segment-id')==ids[1]
            page.locator('#audio-prev').click()
            assert page.locator('.is-speaking').get_attribute('data-segment-id')==ids[0]
            # Let the first clip end naturally from the last fraction of a second.
            page.wait_for_function("() => {const a=document.querySelector('audio'); return a.readyState>=2 && Number.isFinite(a.duration)}")
            media.evaluate("a => { a.currentTime = a.duration - 0.20; }")
            page.wait_for_function("(id) => document.querySelector('.is-speaking')?.dataset.segmentId===id",arg=ids[1])
            go_to_chapter(page,2);assert media.evaluate('a => a.paused')
        else:
            assert play.is_disabled() and 'دسترس نیست' in page.locator('#audio-description').text_content()
        assert page.locator('iframe').count()==0
        assert not errors and not broken,(errors,broken)
        print(f'{width}px: chapter 1, all scene pages and images; navigation, RTL, persistent position, layout (no clipping), chapters 2–8, audio controls and no page errors: passed.')
        ctx.close()
    # Verify legacy fallback if the edition JSON is unavailable.
    ctx=browser.new_context(reduced_motion='reduce')
    pg=ctx.new_page();pg.route('**/assets/chapter1/chapter1.json',lambda r:r.abort())
    pg.goto(url);go_to_chapter(pg,1);next_page(pg)
    assert not pg.locator('#chapter-audio').is_visible() and pg.locator('#sheet > p').count()==2
    print('Original Chapter 1 fallback when enhanced JSON cannot load: passed.')
    browser.close()
