from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(2000)

    # Click Strategy tab to see update vault button
    page.get_by_role("button", name="Strategy").click()
    page.wait_for_timeout(1000)

    # Click Edit Keys button (opens modal)
    page.get_by_role("button", name="Edit Keys").click()
    page.wait_for_timeout(1000)

    # The UPDATE VAULT button should be visible
    page.get_by_role("button", name="UPDATE VAULT").click()
    page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    import os
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()