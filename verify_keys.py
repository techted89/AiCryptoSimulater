from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(5000)

    # Fill in the Gemini API keys
    inputs = page.locator('input[type="password"]')
    inputs.nth(0).fill("test-actor-key-12345")
    page.wait_for_timeout(500)
    inputs.nth(1).fill("test-researcher-key-67890")
    page.wait_for_timeout(500)
    inputs.nth(2).fill("test-groq-key-67890")
    page.wait_for_timeout(500)

    # Click Save
    page.get_by_role("button", name="Save Keys").click()
    page.wait_for_timeout(2000)

    # Take screenshot at the key moment showing "Saved!"
    page.screenshot(path="/home/jules/verification/screenshots/verification2.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
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
